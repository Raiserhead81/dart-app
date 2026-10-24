# NOTIZEN dart-app

## 2026-10-23 Caller-Umbau (Kay)
- KEINE Einzel-Dart-Ansage mehr im Solo-Spiel (play.js) und Online-Match (onlinematch.js); Caller spricht erst am Visit-Ende (3. Dart) die SUMME (sc-Clip, 100..179 = euphorischer visit-Clip, 180 = ph-180).
- 1+5+20 im Visit (Reihenfolge egal) => "GAAAY!!" statt Summe (ph-gay).
- Visit-Summe 1..9 => Beleidigung (ph-low-1..5, rotierend ((points-1)%5)+1).
- ph-gay/ph-low-*: Gemini-TTS-Clips (Stimme Charon, strikte Prompts) am 24.10. von Kay ABGEHÖRT und FREIGEGEBEN ("perfekt bau ein"), gespeichert in elevenlabs-brian, elevenlabs-daniel, classic-en. GERAETSTIMME nur noch Fallback, wenn ein Set den Clip nicht hat (FUN_TTS in caller-voice.js). Texte in src/caller-texts.js = exakt die Clip-Texte (nicht epischer umformulieren — Kay hat die schlichte Fassung gewählt).
- SUMMEN-BUG (24.10.): visitPoints in play.js muss leg.visitStart VOR applyDart sichern (applyDart überschreibt visitStart beim Turn-Wechsel) — sonst nur letzter Dart statt Visit-Summe. E2E beweist sc-60 bei 3xT20.
- Alte rest-Clip-Luecken mit Gemini-Charon aufgefuellt (24.10.): brian 453-501, daniel+classic-en 171-501, gemma Teilmenge. Stimm-Mix zu ElevenLabs-Clips bei hohen Rests ist bekannt und gewollt (Kay: "du brauchst elevenlabs nicht").
- gen_caller_gemini(.py/_batch.py): Manifest-Update merged jetzt bestehende Set-Eintraege (vorher wurden label/provider/complete der Ziel-Sets zerstoert), strikte Prompts gegen Gemini-Lach-Nachspiel.
- training.js behält Einzel-Dart-Calls (Trainingsmodus = Übungsfeedback).
- callDart() bleibt als API (training + Tests), nur die Match-Flows rufen es nicht mehr auf.
- settings.dartCalls-Toggle wirkt jetzt nur noch auf training.js.
- Fullscreen (24.10.): manifest.json display:fullscreen + einmaliger requestFullscreen bei erster User-Geste (app.js), play.js hatte es schon beim Spielstart.
- Server-Clips liegen in /var/www/dart-app-caller (nginx alias /caller/, ausserhalb des deploy-rsync).
- Online-Match: callVisitEnd bekommt jetzt den echten Rest NACH dem Visit (vorher Bug: Rest vor dem Visit) + echte Visit-Summe via visitStartRest-Tracking.
