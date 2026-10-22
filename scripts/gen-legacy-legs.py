#!/usr/bin/env python3
"""Legstands- + Match-Clips fuer das Default-Set (Brian) nachgenerieren."""
import json, urllib.request, time, os

key = open("/root/.elevenlabs-key").read().strip()
VID = os.environ.get("VOICE_ID", "nPczCjzI2devNBz1zQrb")  # Brian (Default)
base = os.environ.get("SET_DIR", "/var/www/dart-app-caller/elevenlabs-brian/en")
os.makedirs(base, exist_ok=True)

def word(n):
    return ["zero", "one", "two", "three"][n]

sentences = {"ph-match": "Game, set and match!"}
for a in range(1, 4):
    for b in range(0, 4):
        plural = "legs" if a > 1 else "leg"
        if a == b:
            t = word(a).capitalize() + " " + plural + " all"
        else:
            t = word(a).capitalize() + " " + plural + " to " + ("nil" if b == 0 else word(b))
        sentences["ph-leg-{}-{}".format(a, b)] = t

ok = 0
for clip, text in sentences.items():
    path = os.path.join(base, clip + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 800:
        ok += 1
        continue
    expressive = clip == "ph-match"
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2", "voice_settings": {
        "stability": 0.45 if expressive else 0.55, "similarity_boost": 0.8,
        "style": 0.5 if expressive else 0.15, "speaker_boost": True}}).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/{}?output_format=mp3_44100_128".format(VID),
        data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            open(path, "wb").write(r.read())
        ok += 1
    except Exception as e:
        print("FAIL", clip, str(e)[:100])
    time.sleep(0.3)
print("{}/{} Zusatzclips ok".format(ok, len(sentences)))
