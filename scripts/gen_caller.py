#!/usr/bin/env python3
"""DartPro Caller-Clip-Generator.

Provider: elevenlabs (Premium) | edge (kostenloser Fallback)
Liest Satzliste (scripts/gen-caller-texts.mjs Output) und schreibt
MP3s nach /var/www/dart-app-caller/<set>/<lang>/<clip>.mp3 + manifest.json.

Beispiele:
  python3 scripts/gen_caller.py --provider elevenlabs --voice-id nPcz... \\
      --set-name elevenlabs-brian --label "Brian (Deep Caller)" --lang en \\
      --sentences /tmp/caller-sentences.json --out /var/www/dart-app-caller
  python3 scripts/gen_caller.py --provider edge --set-name edge --label "Standard (edge-tts)" \\
      --langs en,de --sentences /tmp/caller-sentences.json --out /var/www/dart-app-caller
"""
import argparse, json, os, sys, time, subprocess, tempfile
from concurrent.futures import ThreadPoolExecutor

def post_elevenlabs(key, voice_id, text, out_path, expressive=False, model="eleven_multilingual_v2"):
    import urllib.request, urllib.error
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128"
    settings = {"stability": 0.45, "similarity_boost": 0.8, "style": 0.6, "speaker_boost": True} if expressive \
        else {"stability": 0.55, "similarity_boost": 0.8, "style": 0.15, "speaker_boost": True}
    body = json.dumps({"text": text, "model_id": model, "voice_settings": settings}).encode()
    req = urllib.request.Request(url, data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(out_path, "wb") as f:
                f.write(data)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(4 + attempt * 3)
                continue
            detail = e.read().decode(errors="replace")[:200]
            if e.code in (401, 422) and ("quota" in detail.lower() or "api_key" in detail.lower()):
                print(f"QUOTA/KEY-Problem bei {out_path}: {detail}", flush=True)
                raise SystemExit(3)
            print(f"HTTP {e.code} {out_path}: {detail}", flush=True)
            return False
        except Exception as e:
            time.sleep(2)
    print(f"FAILED nach Retries: {out_path}", flush=True)
    return False

def gen_edge(text, out_path, voice, rate="-8%"):
    for attempt in range(3):
        try:
            subprocess.run([sys.executable, "-m", "edge_tts", f"--voice={voice}", f"--rate={rate}",
                            f"--text={text}", f"--write-media={out_path}", "--no-progress"],
                           check=True, capture_output=True, timeout=60)
            return True
        except subprocess.CalledProcessError as e:
            err = (e.stderr or b"").decode(errors="replace")[:160]
            print(f"edge retry {attempt}: {out_path}: {err}", flush=True)
            time.sleep(3)
        except Exception as e:
            print(f"edge exc: {out_path}: {e}", flush=True)
            time.sleep(3)
    print(f"edge FAILED: {out_path}", flush=True)
    return False

EXPRESSIVE = ("ph-180", "ph-gameshot", "ph-mugsaway")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", required=True, choices=["elevenlabs", "edge"])
    ap.add_argument("--sentences", required=True)
    ap.add_argument("--out", default="/var/www/dart-app-caller")
    ap.add_argument("--set-name", required=True)
    ap.add_argument("--label", default=None)
    ap.add_argument("--voice-id", default=None, help="ElevenLabs voice_id")
    ap.add_argument("--key-file", default="/root/.elevenlabs-key")
    ap.add_argument("--lang", default="en", help="nur bei elevenlabs")
    ap.add_argument("--langs", default="en,de", help="nur bei edge")
    ap.add_argument("--edge-voice-en", default="en-GB-RyanNeural")
    ap.add_argument("--edge-voice-de", default="de-DE-ConradNeural")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--full", default="true")
    args = ap.parse_args()

    sentences = json.load(open(args.sentences))
    if args.provider == "elevenlabs":
        prefix = args.lang + "/"
        items = {k[len(prefix):]: v for k, v in sentences.items() if k.startswith(prefix)}
        key = open(args.key_file).read().strip()
        outdir = os.path.join(args.out, args.set_name, args.lang)
        os.makedirs(outdir, exist_ok=True)
        voice = args.voice_id

        def work(pair):
            clip, text = pair
            path = os.path.join(outdir, clip + ".mp3")
            if os.path.exists(path) and os.path.getsize(path) > 1000:
                return True
            expressive = any(clip.startswith(p) for p in EXPRESSIVE)
            return post_elevenlabs(key, voice, text, path, expressive)

        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            results = list(ex.map(work, items.items()))
        done = sum(1 for r in results if r)
    else:
        edge_voices = {"en": args.edge_voice_en, "de": args.edge_voice_de}
        total_ok, total = 0, 0
        for lang in [l.strip() for l in args.langs.split(",")]:
            prefix = lang + "/"
            items = {k[len(prefix):]: v for k, v in sentences.items() if k.startswith(prefix)}
            outdir = os.path.join(args.out, args.set_name, lang)
            os.makedirs(outdir, exist_ok=True)

            def work(pair):
                clip, text = pair
                path = os.path.join(outdir, clip + ".mp3")
                if os.path.exists(path) and os.path.getsize(path) > 1000:
                    return True
                rate = "-12%" if clip.startswith("ph-180") else "-8%"
                return gen_edge(text, path, edge_voices[lang], rate)

            with ThreadPoolExecutor(max_workers=max(4, args.workers * 2)) as ex:
                results = list(ex.map(work, items.items()))
            total_ok += sum(1 for r in results if r)
            total += len(items)
        done, count = total_ok, total

    ok = done == len(items) if args.provider == "elevenlabs" else done == count
    label = args.label or args.set_name
    print(f"SET {args.set_name}: {done}/{len(items) if args.provider == 'elevenlabs' else count} Clips ok", flush=True)

    # Manifest aktualisieren
    mp = os.path.join(args.out, "manifest.json")
    manifest = {"sets": []}
    if os.path.exists(mp):
        try:
            manifest = json.load(open(mp))
        except Exception:
            pass
    entry = {
        "id": args.set_name,
        "label": label,
        "provider": args.provider,
        "voice": args.voice_id or "",
        "langs": [args.lang] if args.provider == "elevenlabs" else [l.strip() for l in args.langs.split(",")],
        "full": (str(args.full).lower() == "true") and ok
    }
    manifest["sets"] = [s for s in manifest["sets"] if s["id"] != args.set_name] + [entry]
    manifest["sets"].sort(key=lambda s: (s["provider"] != "elevenlabs", s["id"]))
    json.dump(manifest, open(mp, "w"), ensure_ascii=False, indent=1)
    print("manifest:", mp, flush=True)

if __name__ == "__main__":
    main()
