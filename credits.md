# Credits & Lizenzen

## Applaus-Sound (`/caller/shared/applause.mp3` am Server)

- **Quelle:** Mixkit SFX, Sample-ID 2973 ("Audience/Crowd Applause"), direkt geladen von `https://assets.mixkit.co/active_storage/sfx/2973/2973-preview.mp3`
- **Lizenz:** [Mixkit Stock SFX Free License](https://mixkit.co/license/#sfxFree) — kostenfrei, kommerzielle Nutzung erlaubt, keine Namensnennung erforderlich, keine Weiterveräußerung als eigener Sound. Anwendung hier: Wiedergabe als Effekt in der App (erlaubt).
- **Dauer:** 10,5 s (App spielt 4 s bei Game Shot bzw. 5 s bei Match mit Fade-out, siehe `src/caller-sequence.js` → `playMs`)
- **Austauschen:** Datei am Server ersetzen (`/var/www/dart-app-caller/shared/applause.mp3`), Clip-ID/Code bleibt unverändert.

## Caller-Stimmen

- **ElevenLabs** (Sets `elevenlabs-brian`, `elevenlabs-daniel` + Vorschau-Stimmen): erzeugt mit dem ElevenLabs-API-Key des Accounts; Lizenz der erzeugten Audio-Dateien folgt dem ElevenLabs-Abo (commercial use je nach Plan).
- **edge-tts** (`classic-en`, Stimme `en-GB-RyanNeural`): Microsoft Azure Speech Voices, Nutzung über das edge-tts-CLI (nicht-kommerzielle Nutzung laut Microsoft-Bedingungen — bei Zweifeln Satz deaktivieren).

## Sonstiges

- Alle Icons/SVGs: selbst gezeichnet (inline SVG, kein Fremdmaterial).
- Dartboard-SVG, Heatmap, Charts: eigenes Rendering.
