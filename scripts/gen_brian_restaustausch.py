#!/usr/bin/env python3
"""Ersetzt die 49 Gemini-Charon rest-Clips (453-501) im Set elevenlabs-brian
durch echte ElevenLabs-Brian-Clips (Routine: stability 0.55).
Alte Clips werden nach _charon-backup-20261111/ verschoben (nicht geloescht)."""
import json, os, shutil, sys, time, urllib.request, urllib.error

SENT = '/tmp/rest-453-501.json'
OUT = '/var/www/dart-app-caller/elevenlabs-brian/en'
BAK = '/var/www/dart-app-caller/_charon-backup-20261111'
KEY = open('/root/.elevenlabs-key').read().strip()
VOICE = 'nPczCjzI2devNBz1zQrb'
SETTINGS = {"stability": 0.55, "similarity_boost": 0.8, "style": 0.15, "speaker_boost": True}

os.makedirs(BAK, exist_ok=True)
sentences = json.load(open(SENT))
ok = fail = 0
for clip_id, text in sorted(sentences.items()):
    cid = clip_id.split('/')[-1]
    out_path = os.path.join(OUT, cid + '.mp3')
    bak_path = os.path.join(BAK, cid + '.mp3')
    if not os.path.exists(bak_path) and os.path.exists(out_path):
        shutil.move(out_path, bak_path)
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}?output_format=mp3_44100_128"
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2", "voice_settings": SETTINGS}).encode()
    req = urllib.request.Request(url, data=body, headers={"xi-api-key": KEY, "Content-Type": "application/json"})
    done = False
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            if len(data) < 2000:
                raise RuntimeError('zu klein: %d bytes' % len(data))
            with open(out_path, 'wb') as f:
                f.write(data)
            print(f"OK {cid} ({len(data)} bytes)", flush=True)
            ok += 1
            done = True
            break
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors='replace')[:120]
            print(f"HTTP {e.code} {cid}: {detail}", flush=True)
            if e.code == 429:
                time.sleep(5 + attempt * 4)
            elif e.code in (401, 422):
                print('KEY/QUOTA-PROBLEM - STOP'); sys.exit(3)
        except Exception as e:
            print(f"ERR {cid}: {e}", flush=True); time.sleep(3)
    if not done:
        fail += 1
    time.sleep(0.6)
print(f"FERTIG ok={ok} fail={fail}")
