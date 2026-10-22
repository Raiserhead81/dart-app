#!/usr/bin/env bash
# DartPro-Deploy: statisch -> /var/www/dart-app, API -> /opt/dart-app-api
# Server-Daten vom --delete ausgeschlossen: caller-Clips (eigenes Verzeichnis), DB (server/data).
set -euo pipefail
cd "$(dirname "$0")/.."

SERVER=${SERVER:-root@116.203.204.226}
KEY=${KEY:-$HOME/.ssh/gemivo}

rs() { rsync -az "$@" -e "ssh -i $KEY -o BatchMode=yes" "$SERVER:"; }
ssho() { ssh -i "$KEY" -o BatchMode=yes "$SERVER" "$@"; }

node bin/sync-src.js >/dev/null
node bin/stamp.js "${1:-}" >/dev/null 2>&1 || node bin/stamp.js

# 1) Statische PWA (Caller-Clips + assetlinks sind Server-Daten und bleiben erhalten)
rsync -az --delete -e "ssh -i $KEY -o BatchMode=yes" --exclude .well-known public/ "$SERVER:/var/www/dart-app/"

# 2) API-Code (DB + node_modules bleiben am Server); Struktur wie im Repo: server/ + src/
rsync -az --delete -e "ssh -i $KEY -o BatchMode=yes" --exclude node_modules --exclude data server/ "$SERVER:/opt/dart-app-api/server/"
rsync -az --delete -e "ssh -i $KEY -o BatchMode=yes" src/ "$SERVER:/opt/dart-app-api/src/"
rsync -az -e "ssh -i $KEY -o BatchMode=yes" package.json package-lock.json "$SERVER:/opt/dart-app-api/"

ssho 'cd /opt/dart-app-api && mkdir -p data && npm install --omit=dev --no-audit --no-fund >/dev/null 2>&1 && systemctl restart dart-app-api && sleep 1 && systemctl is-active dart-app-api && curl -s http://127.0.0.1:3121/api/health'
echo "deploy ok: $(cat public/VERSION)"
