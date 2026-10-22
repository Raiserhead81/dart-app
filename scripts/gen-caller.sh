#!/usr/bin/env bash
# DartPro-Caller-Clip-Generierung (am gemivo-Server ausfuehren).
#
# Usage:
#   TTS_PROVIDER=elevenlabs ./scripts/gen-caller.sh --voice-id <id> --set-name elevenlabs-brian --label "Brian (Deep Caller)" [--lang en] [--key-file /root/.elevenlabs-key]
#   TTS_PROVIDER=gemini ./scripts/gen-caller.sh --voice-id Laomedeia --set-name gemma --label "Gemma (Laomedeia)" [--key-file /opt/gemma-live/gemini-key-paid]
#   TTS_PROVIDER=edge ./scripts/gen-caller.sh --set-name edge --label "Standard" [--langs en,de]
#
# Sätze werden aus der App-Logik erzeugt (src/caller-texts.js: rest 2..501), damit
# Clip-Inhalt == UI-Text. Output: /var/www/dart-app-caller/<set>/<lang>/*.mp3 + manifest.json
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=${OUT:-/var/www/dart-app-caller}
PROVIDER=${TTS_PROVIDER:-elevenlabs}
SENTENCES=${SENTENCES:-/tmp/caller-sentences.json}

node scripts/gen-caller-texts.mjs > "$SENTENCES"
echo "Satzliste: $SENTENCES ($(python3 -c "import json;print(len(json.load(open('$SENTENCES'))))") Clips)"

if [ "$PROVIDER" = "gemini" ]; then
  # Gemini Native-TTS ("wie Gemma"): --voice-id = prebuilt Voice (Kore, Puck, Laomedeia …)
  [ -n "${VOICE_ID:-}" ] || { echo "VOICE_ID fehlt (Gemini-Stimme, z.B. Kore)"; exit 1; }
  python3 scripts/gen_caller_gemini.py \
    --sentences "$SENTENCES" \
    --out "$OUT" \
    --set-name "${SET_NAME:?SET_NAME noetig}" \
    --label "${LABEL:-$SET_NAME}" \
    --voice "$VOICE_ID" \
    --key-file "${KEY_FILE:-/opt/gemma-live/gemini-key-paid}" \
    --lang "${LANG:-en}" \
    --workers "${WORKERS:-3}" \
    --full "${FULL:-true}"
  exit 0
fi

KEY_ARGS=()
if [ "$PROVIDER" = "elevenlabs" ]; then
  KEY_ARGS=(--key-file "${KEY_FILE:-/root/.elevenlabs-key}")
  [ -n "${VOICE_ID:-}" ] || { echo "VOICE_ID fehlt (--voice-id)"; exit 1; }
fi

python3 scripts/gen_caller.py \
  --provider "$PROVIDER" \
  --sentences "$SENTENCES" \
  --out "$OUT" \
  --set-name "${SET_NAME:?SET_NAME noetig}" \
  --label "${LABEL:-$SET_NAME}" \
  ${VOICE_ID:+--voice-id "$VOICE_ID"} \
  "${KEY_ARGS[@]}" \
  --lang "${LANG:-en}" \
  --langs "${LANGS:-en,de}" \
  --full "${FULL:-true}"
