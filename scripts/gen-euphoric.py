#!/usr/bin/env python3
"""Euphorische HIGH-Moment-Clips (Brian): 180, Game Shot, Match, 100+-Visits,
Doppel-Aus, Big Fish. Routine-Calls bleiben unberuehrt (von Kay abgenommen)."""
import json, urllib.request, time, os

key = open("/root/.elevenlabs-key").read().strip()
VID = "nPczCjzI2devNBz1zQrb"
base = "/var/www/dart-app-caller/elevenlabs-brian/en"

ONES = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"]
TENS = ["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"]

def en(n):
    if n == 0: return "no score"
    if n < 20: return ONES[n]
    if n < 100:
        t, o = divmod(n, 10)
        return TENS[t] if o == 0 else TENS[t] + " " + ONES[o]
    h, r = divmod(n, 100)
    h = ONES[h] + " hundred"
    if r == 0: return h
    return h + " and " + en(r)

sentences = {
    "ph-180": "ONE HUNDRED AND EIGHTY!!",
    "ph-gameshot-high": "GAME SHOT!!",
    "ph-match": "Game, set and match!!",
    "ph-bigfish": "BIG FISH!! ONE HUNDRED AND SEVENTY!!",
}
for n in range(100, 180):
    sentences["visit-{}".format(n)] = en(n).upper() + "!!"
for d in range(1, 21):
    sentences["dx-D{}-match".format(d)] = "DOUBLE {}!! WHAT A FINISH!".format(en(d).upper())
    sentences["dx-D{}-game".format(d)] = "DOUBLE {}!! WHAT A FINISH!".format(en(d).upper())
sentences["dx-Bull-match"] = "BULLSEYE!! WHAT A FINISH!"
sentences["dx-Bull-game"] = "BULLSEYE!! WHAT A FINISH!"

ok, fail = 0, 0
for clip, text in sentences.items():
    path = os.path.join(base, clip + ".mp3")
    if os.path.exists(path) and os.path.getsize(path) > 800:
        ok += 1
        continue
    body = json.dumps({"text": text, "model_id": "eleven_multilingual_v2", "voice_settings": {
        "stability": 0.32, "similarity_boost": 0.85, "style": 0.78, "speaker_boost": True}}).encode()
    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/text-to-speech/{}?output_format=mp3_44100_128".format(VID),
        data=body, headers={"xi-api-key": key, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            open(path, "wb").write(r.read())
        ok += 1
    except Exception as e:
        fail += 1
        print("FAIL", clip, str(e)[:90])
    time.sleep(0.25)
print("euphorisch: {}/{} ok, {} fail".format(ok, len(sentences), fail))
