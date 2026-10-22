#!/usr/bin/env python3
"""DartPro Caller-Clip-Generator fuer Google Gemini Native-TTS (Stimmen wie "Gemma").

Nutzt dieselbe Satzliste wie die App (scripts/gen-caller-texts.mjs -> buildCallerSentences).
Response ist PCM (24 kHz s16le mono) -> ffmpeg wandelt zu mp3_44100.

Beispiel (am Server):
  python3 scripts/gen_caller_gemini.py \
    --sentences /tmp/caller-sentences.json \
    --out /var/www/dart-app-caller --set-name gemma --label "Gemma (Laomedeia)" \
    --voice Laomedeia --key-file /opt/gemma-live/gemini-key-paid --lang en

Key bleibt serverseitig, erscheint NIE in Logs/Repo. Bei 429/503 Retry mit Backoff;
bei Quota-Ende (RESOURCE_EXHAUSTED ohne Retry-Sinn) Abbruch mit Meldung der Rest-Clips.
"""
import argparse, base64, json, os, subprocess, sys, tempfile, time
from concurrent.futures import ThreadPoolExecutor

MODELS = ["gemini-2.5-flash-preview-tts", "gemini-2.5-pro-preview-tts", "gemini-2.5-flash-tts"]
EUPHORIC_PREFIXES = ("ph-180", "ph-gameshot-high", "ph-match", "ph-bigfish", "ph-gameshot", "visit-", "sc-180")
ROUTINE_PROMPT = "You are a professional darts caller at the oche. Announce in your steady, clear caller voice: "
HIGH_PROMPT = "You are an ecstatic professional darts caller. Announce this huge moment loudly and excitedly: "

found_model = None


def tts_request(key, voice, prompt_text, model):
    import urllib.request, urllib.error
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read())
    part = data["candidates"][0]["content"]["parts"][0]
    return base64.b64decode(part["inlineData"]["data"])  # PCM s16le 24kHz mono


def pcm_to_mp3(pcm, out_path):
    with tempfile.NamedTemporaryFile(suffix=".pcm", delete=False) as tf:
        tf.write(pcm)
        tmp = tf.name
    try:
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "s16le", "-ar", "24000", "-ac", "1",
                        "-i", tmp, "-codec:a", "libmp3lame", "-b:a", "128k", "-ar", "44100", out_path],
                       check=True, capture_output=True, timeout=60)
        return True
    finally:
        os.unlink(tmp)


def main():
    global found_model
    ap = argparse.ArgumentParser()
    ap.add_argument("--sentences", required=True)
    ap.add_argument("--out", default="/var/www/dart-app-caller")
    ap.add_argument("--set-name", required=True)
    ap.add_argument("--label", default=None)
    ap.add_argument("--voice", required=True, help="Gemini prebuilt voice, z.B. Kore, Puck, Laomedeia")
    ap.add_argument("--key-file", default="/opt/gemma-live/gemini-key-paid")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--full", default="true")
    ap.add_argument("--model", default=None, help="fix; sonst Auto-Probe")
    args = ap.parse_args()

    sentences = json.load(open(args.sentences))
    prefix = args.lang + "/"
    items = {k[len(prefix):]: v for k, v in sentences.items() if k.startswith(prefix)}
    key = open(args.key_file).read().strip()
    outdir = os.path.join(args.out, args.set_name, args.lang)
    os.makedirs(outdir, exist_ok=True)

    todo = []
    for clip, text in sorted(items.items()):
        path = os.path.join(outdir, clip + ".mp3")
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            continue
        todo.append((clip, text, path))
    print(f"{args.set_name}: {len(items)} Clips total, {len(todo)} zu generieren", flush=True)

    lock = __import__("threading").Lock()

    def work(pair):
        clip, text, path = pair
        prompt = (HIGH_PROMPT if clip.startswith(EUPHORIC_PREFIXES) else ROUTINE_PROMPT) + text
        models = [args.model] if args.model else MODELS
        for attempt in range(4):
            for model in models:
                try:
                    pcm = tts_request(key, args.voice, prompt, model)
                    with lock:
                        if not found_model:
                            found_model = model
                            print(f"Modell ok: {model}", flush=True)
                    return pcm_to_mp3(pcm, path)
                except Exception as e:
                    msg = str(e)[:160]
                    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                        time.sleep(5 + attempt * 8)
                        continue
                    if "404" in msg or "NOT_FOUND" in msg:
                        continue  # naechstes Modell probieren
                    if "400" in msg and "voiceName" in msg:
                        print(f"UNBEKANNTE STIMME '{args.voice}' bei {clip}: {msg}", flush=True)
                        raise SystemExit(4)
                    print(f"HTTP-Fehler {clip}: {msg}", flush=True)
                    time.sleep(2)
        print(f"FAILED nach Retries: {clip}", flush=True)
        return False

    if todo:
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            results = list(ex.map(work, todo))
        ok = sum(1 for r in results if r)
        fail = [pair[0] for pair, r in zip(todo, results) if not r]
    else:
        ok, fail = 0, []
    print(f"SET {args.set_name}: {ok}/{len(todo)} neue Clips ok", flush=True)
    if fail:
        print(f"FEHLENDE ({len(fail)}): {fail[:20]}{' …' if len(fail) > 20 else ''}", flush=True)
    if fail:
        sys.exit(3)

    # Manifest aktualisieren (gemma-Sets zuerst, dann elevenlabs, dann Rest)
    mp = os.path.join(args.out, "manifest.json")
    manifest = {"sets": []}
    if os.path.exists(mp):
        try:
            manifest = json.load(open(mp))
        except Exception:
            pass
    entry = {
        "id": args.set_name,
        "label": args.label or args.set_name,
        "provider": "gemini",
        "voice": args.voice,
        "model": found_model or args.model or MODELS[0],
        "langs": [args.lang],
        "full": str(args.full).lower() == "true",
    }
    manifest["sets"] = [s for s in manifest["sets"] if s["id"] != args.set_name] + [entry]
    manifest["sets"].sort(key=lambda s: (s["id"] != args.set_name, s.get("provider") != "elevenlabs", s["id"]))
    json.dump(manifest, open(mp, "w"), ensure_ascii=False, indent=1)
    print("manifest:", mp, flush=True)


if __name__ == "__main__":
    main()
