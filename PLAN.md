# Dart-App: Kay-Feedback 1. Spiel (11.11.)

## Etappe A: Pad + Average (Pkt 3+4)
- [x] Pad aufsteigend 1..20 (Telefon-Prinzip: 1 oben links) — play.js
- [x] averages(state,i) pure in src/x01.js: Leg-Ø + Match-Ø (legEvents-Reste + aktuelle Leg)
- [x] Spielerkarte play.js: 2 Zahlen "Leg Ø x" "Match Ø y" immer sichtbar
- [x] onlinematch.js pcard: gleiche 2 Averages
- [x] npm run sync + Tests + Deploy

## Etappe B: Spieler lokal+online gleich + Statistik (Pkt 1+2)
- [x] Login verknüpft Profil mit accountId (storage profiles.accountId)
- [x] Freunde als Spieler-Chips im Setup (aus store, lokal spielbar)
- [x] Game-Record: accountIds parallel zu players
- [x] Server syncPush: Spiel an ALLE beteiligten Accounts ausliefern (game_shares)
- [x] Stats: Vergleichsansicht 2 Spieler (gemeinsame Spiele, H2H)
- [x] Tests + Deploy (Server-Restart)

## Etappe C: Caller-Gemurmel (Pkt 5/6)
- [x] Brian rest-453..501 = Gemini-Charon-Mix => mit ElevenLabs Brian neu generieren, ersetzen
- [x] Manifest + Deploy-Clips (kein per-Clip-Manifest, nichts zu updaten) updaten

## Etappe D: Aufräumen
- [ ] NOTIZEN.md, lessons, commit+push, deploy-Beweis
