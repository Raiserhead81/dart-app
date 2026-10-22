#!/usr/bin/env bash
# DartPro Caller-Clip-Generierung (am gemivo-Server ausfuehren).
#
# Usage:
#   TTS_PROVIDER=elevenlabs ./scripts/gen-caller.sh --voice-id <id> --set-name elevenlabs-brian --label "Brian (Deep Caller)" [--lang en] [--key-file /root/.elevenlabs-key]
#   TTS_PROVIDER=edge ./scripts/gen-caller.sh --set-name edge --label "Standard" [--langs en,de]
#
# Sätze werden aus der App-Logik erzeugt (scripts/gen-caller-texts.mjs), damit
# Clip-Inhalt == UI-Text. Output: /var/www/dart-app-caller/<set>/<lang>/*.mp3 + manifest.json
set -euo pipefail
cd "$(dirname "$0")/.."

OUT=${OUT:-/var/www/dart-app-caller}
PROVIDER=${TTS_PROVIDER:-elevenlabs}
SENTENCES=${SENTENCES:-/tmp/caller-sentences.json}

node scripts/gen-caller-texts.mjs > "$SENTENCES"
echo "Satzliste: $SENTENCES ($(python3 -c "import json;print(len(json.load(open('$SENTENCES'))))") Clips)"

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
