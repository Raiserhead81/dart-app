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

## Runde 2: Bild-Upload + Fehlerkanal (GLM-Reviewer-Beweise)
- node --check camera.js/index.js/db.js: OK (module-mode)
- Lokaler Smoke (In-Memory-DB): POST ok, /api/diag/img 200 image/jpeg
- Live: POST {"ok":true,"id":79}; GET /api/diag/img -> 200 image/jpeg, file: JPEG 1x1 (/tmp/d.jpg 188B)
- GET /api/diag/latest -> info 'CAM-ERR: NotAllowedError handy-test' sichtbar (Fehlerkanal bewiesen)
- systemctl is-active dart-app-api: active; camera.js live 200 (5 grep-Treffer diagThumb/JS-ERR/CAM-ERR); sw.js live 1-0-3
- Privacy: /api/diag* bewusst UNAUTHENTIFIZIERT fuer die Test-Phase (nur Diagnosewerte + 360px-Thumbs); nach Test-Ende sperren/entfernen -> in NOTIZEN.md aufgenommen
- Live-Erkenntnis Stativ-Test 17:07-17:09: r=195 unter Gate nach Zurueckziehen OK, q max 27 (zu schwach), hell ~62-136 pendelnd, Daten stoppten 17:09:30 (App-Ansicht gewechselt/gross), Chrome-Kamerastart offen (CAM-ERR-Kanal greift morgen)
