# Diag-Upload: Live-Beweise 06.11.2026

## Backend (dart.gemivo.de)
- `curl -s -X POST https://dart.gemivo.de/api/diag -d '{"ts":1,"hell":123,"q":45,"info":"test"}'` → `{"ok":true,"id":1}`
- `curl -s https://dart.gemivo.de/api/diag/latest` → `{"id":1,"ts":1,"hell":123,"q":45,...,"info":"test","created_at":"2026-11-06T16:50:08.975Z"}`
- Spamschutz: 2. POST < 1 s → HTTP 429; nach 1,1 s → `{"ok":true}`
- `systemctl is-active dart-app-api` → `active` (Port laut Unit: 3121, nginx proxy_pass passt)
- Vorab-Smoke-Test der Server-Logik mit :memory:-DB auf Port 3999: erfolgreich

## Frontend
- `curl -o /dev/null -w '%{http_code}' https://dart.gemivo.de/js/views/camera.js` → `200`
- grep in Live-Datei auf `diagStart|__diagSende|api/diag` → 7 Treffer (Sender ist live)
- `https://dart.gemivo.de/VERSION` → `1.0.1793983789`, `sw.js` → `VERSION '1-0-2'` (Cache-Tick erzwingt Client-Update)
- Imports geprueft: `frameGrab`, `analyseBoardInFrame` (Import Zeile 5 camera.js), canvas lazy — alles im selben Modul vorhanden

## Offen (echtes Geraet)
- Live-Rotation am Stativ-Handy: folgt, sobald Kay die App am Stativ oeffnet (Zweck dieses Features)
