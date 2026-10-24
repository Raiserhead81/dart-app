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
EUPHORIC_PREFIXES = ("ph-180", "ph-gameshot-high", "ph-match", "ph-bigfish", "ph-gameshot", "ph-gay", "visit-", "sc-180")
ROUTINE_PROMPT = "You are a professional darts caller at the oche. Announce in your steady, clear caller voice. Speak ONLY the exact phrase, nothing else, no laughing, no sounds before or after: "
HIGH_PROMPT = "You are an ecstatic professional darts caller. Announce this huge moment loudly and excitedly. Speak ONLY the exact phrase, nothing else, no laughing, no sounds before or after: "
MOCK_PREFIXES = ("ph-low-",)
MOCK_PROMPT = "You are a professional darts caller. Mock the player who just threw an embarrassingly low score. Deliver this taunt with disdain. Speak ONLY the exact phrase, nothing else, no laughing, no sounds before or after: "

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
    ap = argparse.ArgumentParser()
    ap.add_argument("--sentences", required=True)
    ap.add_argument("--out", default="/var/www/dart-app-caller")
    ap.add_argument("--set-name", required=True)
    ap.add_argument("--label", default=None)
    ap.add_argument("--voice", required=True, help="Gemini prebuilt voice, z.B. Kore, Puck, Laomedeia")
    ap.add_argument("--key-file", default="/opt/gemma-live/gemini-key-paid")
    ap.add_argument("--lang", default="en")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--min-interval", type=float, default=4.0,
                    help="Mindestabstand zwischen Request-Starts (Sekunden, global ueber alle Worker) — haelt RPM-Limit ein")
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
    state = {"model": None, "next_ok": 0.0, "done": 0}

    # Globales Throttling: alle Worker teilen sich ein Mindestintervall zwischen
    # Request-STARTS — ohne das fliegt der Key in 429/RESOURCE_EXHAUSTED.
    def reserve_slot():
        with lock:
            now = time.time()
            wait = state["next_ok"] - now
            state["next_ok"] = max(now, state["next_ok"]) + args.min_interval
            return wait if wait > 0 else 0.0

    def parse_retry_delay(msg):
        import re
        m = re.search(r'"retryDelay":\s*"(\d+)s"', msg)
        return int(m.group(1)) if m else None

    def work(pair):
        clip, text, path = pair
        if clip.startswith(MOCK_PREFIXES):
            prompt = MOCK_PROMPT + text
        elif clip.startswith(EUPHORIC_PREFIXES):
            prompt = HIGH_PROMPT + text
        else:
            prompt = ROUTINE_PROMPT + text
        models = [args.model] if args.model else MODELS
        for attempt in range(10):  # 10 Versuche mit Exponential-Backoff (429-Kuehlphasen)
            for model in models:
                wait = reserve_slot()
                if wait:
                    time.sleep(wait)
                try:
                    pcm = tts_request(key, args.voice, prompt, model)  # timeout 90s pro Request
                    with lock:
                        if not state["model"]:
                            state["model"] = model
                            print(f"Modell ok: {model}", flush=True)
                        state["done"] += 1
                        if state["done"] % 10 == 0 or state["done"] == len(todo):
                            import datetime
                            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Fortschritt: {state['done']}/{len(todo)} ({clip})", flush=True)
                    return pcm_to_mp3(pcm, path)
                except Exception as e:
                    msg = str(e)[:300]
                    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                        # retryDelay aus der Quota-Antwort respektieren (cap 90s), sonst exponentiell
                        delay = parse_retry_delay(msg)
                        time.sleep(min(90, delay) if delay else min(60, 4 ** attempt))
                        continue
                    if "404" in msg or "NOT_FOUND" in msg:
                        continue  # naechstes Modell probieren
                    if "400" in msg and "voiceName" in msg:
                        print(f"UNBEKANNTE STIMME '{args.voice}' bei {clip}: {msg}", flush=True)
                        raise SystemExit(4)
                    print(f"HTTP-Fehler {clip} (Versuch {attempt + 1}): {msg[:160]}", flush=True)
                    time.sleep(min(30, 3 * (attempt + 1)))
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
        "model": state["model"] or args.model or MODELS[0],
        "langs": [args.lang],
        "full": str(args.full).lower() == "true",
    }
    # BUGFIX: Bestehenden Eintrag NICHT komplett ersetzen — label/provider/complete
    # eines vorhandenen Sets bleiben erhalten (sonst zerstoert ein Gemini-Nachtrag
    # die Metadaten von ElevenLabs/edge-Sets, siehe 24.10.2026).
    existing = next((s for s in manifest["sets"] if s["id"] == args.set_name), None)
    if existing:
        for k, v in existing.items():
            if k != "langs":
                entry[k] = v
        entry["langs"] = sorted(set(existing.get("langs", [])) | {args.lang})
    manifest["sets"] = [s for s in manifest["sets"] if s["id"] != args.set_name] + [entry]
    manifest["sets"].sort(key=lambda s: (s["id"] != args.set_name, s.get("provider") != "elevenlabs", s["id"]))
    json.dump(manifest, open(mp, "w"), ensure_ascii=False, indent=1)
    print("manifest:", mp, flush=True)


if __name__ == "__main__":
    main()
