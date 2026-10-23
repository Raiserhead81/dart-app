#!/usr/bin/env python3
"""DartPro Caller-Batch-Generator: VIELE Clips pro Gemini-TTS-Request.

Warum: Der TTS-Modell-Key hat ein hartes Tageslimit (100 Requests/Tag beim
Paid-Key, 10/Tag beim Gratis-Key). Einzelsatz-Generierung (979 Requests) ist
damit unmoeglich. Stattdessen: 25 Saetze pro Request generieren und die
Audio-Datei an der Stille zwischen den Saetzen schneiden (ffmpeg silencedetect).
848 Clips == ~34 Requests — passt in ein Tageslimit.

Resume-sicher: fertige Clips (>1000 Bytes) werden uebersprungen, ein Lauf mit
kleinerem --batch-size moppt Reste auf. Reihenfolge im Batch == Reihenfolge im
Text == chronologische Segment-Reihenfolge im Audio.

Nur am gemivo-Server ausfuehren (Key bleibt serverseitig):
  nohup python3 scripts/gen_caller_gemini_batch.py \
    --sentences /tmp/caller-sentences.json --out /var/www/dart-app-caller \
    --set-name gemma --label "Gemma (Laomedeia)" --voice Laomedeia \
    --key-file /opt/gemma-live/gemini-key-paid --batch-size 25 \
    > /tmp/gemma-batch.log 2>&1 &
"""
import argparse, base64, datetime, json, os, re, subprocess, sys, tempfile, time
import urllib.request, urllib.error

MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts"]
EUPHORIC_PREFIXES = ("ph-180", "ph-gameshot-high", "ph-match", "ph-bigfish", "ph-gameshot", "visit-", "sc-180")
ROUTINE_PROMPT = "You are a professional darts caller at the oche. Announce each of the following phrases one after another, with a clear pause between phrases: "
HIGH_PROMPT = "You are an ecstatic professional darts caller. Announce each of the following huge moments loudly and excitedly, one after another, with a clear pause between phrases: "

found_model = None


def log(msg):
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def tts_request(key, voice, prompt_text, model):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=240) as r:
        data = json.loads(r.read())
    part = data["candidates"][0]["content"]["parts"][0]
    return base64.b64decode(part["inlineData"]["data"])  # PCM s16le 24kHz mono


def pcm_to_wav(pcm, wav_path):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1",
                    "-i", "pipe:0", wav_path], input=pcm, check=True, capture_output=True, timeout=120)


def detect_segments(wav_path, min_silence=0.30, noise="-42dB"):
    """Liefert sortierte (start, end) Sekunden der Sprachsegmente."""
    r = subprocess.run(["ffmpeg", "-i", wav_path, "-af",
                        f"silencedetect=noise={noise}:d={min_silence}",
                        "-f", "null", "-"], capture_output=True, text=True, timeout=120)
    err = r.stderr
    silences = []  # (start, end)
    cur_start = None
    for line in err.splitlines():
        m = re.search(r"silence_start:\s*([\d.]+)", line)
        if m:
            cur_start = float(m.group(1))
        m = re.search(r"silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)", line)
        if m and cur_start is not None:
            silences.append((cur_start, float(m.group(1))))
            cur_start = None
    # Dauer bestimmen
    r2 = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                         "-of", "default=nw=1:nk=1", wav_path], capture_output=True, text=True, timeout=60)
    dur = float(r2.stdout.strip())
    # Sprachsegmente = Intervalle zwischen den Stille-Phasen
    segs = []
    pos = 0.0
    for s, e in silences:
        if s - pos > 0.2:
            segs.append((pos, s))
        pos = e
    if dur - pos > 0.2:
        segs.append((pos, dur))
    return segs, dur


def extract_mp3(wav_path, start, end, out_path):
    dur = max(0.05, end - start)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}",
                    "-i", wav_path, "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
                    out_path], check=True, capture_output=True, timeout=60)


def update_manifest(out, set_name, label, voice, lang, full):
    mp = os.path.join(out, "manifest.json")
    manifest = {"sets": []}
    if os.path.exists(mp):
        try:
            manifest = json.load(open(mp))
        except Exception:
            pass
    entry = {
        "id": set_name,
        "label": label,
        "provider": "gemini",
        "voice": voice,
        "model": found_model or MODELS[0],
        "langs": [lang],
        "full": bool(full),
    }
    manifest["sets"] = [s for s in manifest["sets"] if s["id"] != set_name] + [entry]
    manifest["sets"].sort(key=lambda s: (s["id"] != set_name, s.get("provider") != "elevenlabs", s["id"]))
    json.dump(manifest, open(mp, "w"), ensure_ascii=False, indent=1)
    log("manifest aktualisiert: " + mp)


def main():
    global found_model
    ap = argparse.ArgumentParser()
    ap.add_argument("--sentences", required=True)
    ap.add_argument("--out", default="/var/www/dart-app-caller")
    ap.add_argument("--set-name", required=True)
    ap.add_argument("--label", default=None)
    ap.add_argument("--voice", required=True)
    ap.add_argument("--key-file", default="/opt/gemma-live/gemini-key-paid")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--batch-size", type=int, default=25)
    ap.add_argument("--min-mp3-bytes", type=int, default=1000)
    ap.add_argument("--max-requests", type=int, default=95, help="hartes Tagesbudget (Paid-Key: 100/Tag)")
    ap.add_argument("--full", default="true")
    args = ap.parse_args()

    sentences = json.load(open(args.sentences))
    prefix = args.lang + "/"
    items = {k[len(prefix):]: v for k, v in sentences.items() if k.startswith(prefix)}
    key = open(args.key_file).read().strip()
    outdir = os.path.join(args.out, args.set_name, args.lang)
    os.makedirs(outdir, exist_ok=True)

    # Resume: nur fehlende Clips; Euphorische und Routine NICHT im Batch mischen
    def is_euphoric(clip):
        return clip.startswith(EUPHORIC_PREFIXES)

    todo = []
    for clip, text in sorted(items.items()):
        path = os.path.join(outdir, clip + ".mp3")
        if os.path.exists(path) and os.path.getsize(path) > args.min_mp3_bytes:
            continue
        todo.append((clip, text, path))
    log(f"{args.set_name}: {len(items)} Clips total, {len(todo)} fehlen")

    batches = []
    routine = [t for t in todo if not is_euphoric(t[0])]
    euphoric = [t for t in todo if is_euphoric(t[0])]
    for group in (routine, euphoric):
        for i in range(0, len(group), args.batch_size):
            batches.append(group[i:i + args.batch_size])
    log(f"{len(batches)} Batches (Gruppe: {len(routine)} Routine / {len(euphoric)} euphorisch, je max {args.batch_size})")

    requests_used = 0
    ok_total = 0
    fail_clips = []

    for bi, batch in enumerate(batches):
        if requests_used >= args.max_requests:
            log(f"REQUEST-BUDGET {args.max_requests} erreicht — Abbruch. Rest: {sum(len(b) for b in batches[bi:])} Clips in {len(batches) - bi} Batches")
            fail_clips += [t[0] for b in batches[bi:] for t in b]
            break
        clips = [(c, t) for c, t, _ in batch]
        prompt = (HIGH_PROMPT if is_euphoric(batch[0][0]) else ROUTINE_PROMPT) + " ".join(
            t if t.endswith((".", "!", "?")) else t + "." for _, t in clips)
        attempts = 0
        while attempts < 4:
            attempts += 1
            requests_used += 1
            try:
                pcm = tts_request(key, args.voice, prompt, MODELS[0] if found_model is None else found_model)
                if found_model is None:
                    found_model = MODELS[0]
                    log("Modell ok: " + found_model)
                break
            except Exception as e:
                msg = str(e)[:300]
                m = re.search(r"retry in ([\dhms.]+)", msg)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                    log(f"429 bei Batch {bi + 1} (Request {requests_used}). retry-Hinweis: {m.group(1) if m else '?'} | {msg[:180]}")
                    if "per_day" in msg or (m and ("h" in m.group(1))):
                        log("TAGESLIMIT erreicht — kein Weiterkommen heute. Abbruch.")
                        fail_clips += [t[0] for b in batches[bi:] for t in b]
                        sys.exit(3)
                    time.sleep(45)
                    continue
                log(f"Fehler Batch {bi + 1} (Versuch {attempts}): {msg[:160]}")
                time.sleep(20)
        else:
            log(f"Batch {bi + 1} endgueltig fehlgeschlagen ({len(batch)} Clips)")
            fail_clips += [t[0] for t, _, _ in [(t, c, p) for c, t, p in batch]]
            continue

        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, "b.wav")
            pcm_to_wav(pcm, wav)
            segs, dur = detect_segments(wav)
            expected = len(batch)
            if len(segs) < expected:
                log(f"Batch {bi + 1}: nur {len(segs)}/{expected} Segmente erkannt ({dur:.1f}s) — Clips einzeln nachziehen (naechster Lauf/Resume)")
                # was da ist: der Reihe nach zuordnen, Rest als fehlend melden
            written = 0
            for (clip, text, path), (s, e) in zip(batch, segs):
                try:
                    extract_mp3(wav, s, e, path)
                    if os.path.getsize(path) > args.min_mp3_bytes:
                        written += 1
                except Exception as ex:
                    log(f"Segment-Fehler {clip}: {str(ex)[:100]}")
            ok_total += written
            missing_here = expected - written
            if missing_here:
                fail_clips += [c for c, _, _ in batch[written:]]
                log(f"Batch {bi + 1}: {written}/{expected} geschrieben, {missing_here} fehlen")
            else:
                log(f"Batch {bi + 1}: {written}/{expected} Clips OK ({len(batch[0][0])} … {batch[-1][0]})")
        time.sleep(2)

    log(f"FERTIG: {ok_total} Clips neu, {len(fail_clips)} fehlen noch")
    if fail_clips:
        log(f"FEHLENDE ({len(fail_clips)}): {' '.join(fail_clips[:40])}{' …' if len(fail_clips) > 40 else ''} — einfach Lauf wiederholen (Resume)")
    if os.path.isdir(outdir):
        n = len([f for f in os.listdir(outdir) if f.endswith(".mp3")])
        log(f"Bestand {args.set_name}/{args.lang}: {n} mp3-Dateien")
    update_manifest(args.out, args.set_name, args.label or args.set_name, args.voice, args.lang, args.full)
    sys.exit(3 if fail_clips else 0)


if __name__ == "__main__":
    main()
