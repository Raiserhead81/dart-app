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
- KEIN SCROLLEN (24.10.): fitGameScreen() in app.js skaliert .view-game per transform:scale auf den Viewport (Hoehe mitschrumpfen!). padBottom nur auf Mobile abziehen (Rail), Desktop zahlt voll. Regressionstest scripts/e2e-fit.mjs (390x700/820x1180/1280x800 => noScroll).
- Server-Clips liegen in /var/www/dart-app-caller (nginx alias /caller/, ausserhalb des deploy-rsync).
- Online-Match: callVisitEnd bekommt jetzt den echten Rest NACH dem Visit (vorher Bug: Rest vor dem Visit) + echte Visit-Summe via visitStartRest-Tracking.

## Kamera-Assistent (Branch feature/kamera-assist, Stand 24.10. abends)
- Vollauto: Setup-Toggle + Kamera-Button im laufenden Spiel (Toggle, 'Kamera: AN/AUS')
- PiP: eigene Zeile ueber dem gtop, volle Breite, 26vh, object-fit CONTAIN
- WICHTIG: Tap-Kalibrierung rechnet contain-letterbox zurueck (camera.js mountCam)
- Engine v2 in src/camera-engine.js (pure): Schwerpunkt-Diff im Board-Crop, 6 Unit-Tests gruen
- APK: CAMERA-Permission + Runtime-Grant + onPermissionRequest(grant) + onBackPressed(goBack)
- beforeunload-Dialog nur noch im Browser (nicht APK-WebView, UA '; wv)')
- OFFEN (naechste Session!): App-WebView laedt nach Deploys teils ALTE Module (Klick-Handler
  verhielt sich nach 15:12-Deploy noch alt trotz no-cache+clearCache) -> Ursache finden:
  vermutlich SW-Modul-Cache in der WebView; ggf. App-Start mit ?v=Cache-Bust laden
- OFFEN: echte Erkennungs-Quote an Kays Scheibe messen (10 Darts), Schwellwerte tunen
- Kay-Regeln: ERST selbst via WebView-CDP testen (volltest-Muster), Screenshots nur bei
  wachem Display (wake+Pixelcheck), keine Toggle-Zombie-Zustaende raten

## Kamera-Assistent FINALER STAND (24.10., Abend - Session beendet auf Kays Wunsch)
- WAS GEHT: Vollbild-Kamera im Spiel (fixed 55vh), Weitwinkel-Linse (camera 4, per
  Label in localStorage 'dartpro.camera.lenslabel' gespeichert, Oppo deviceIds wechseln!),
  Zoom-Slider 0,3-5x (Start 0,5x weit), Rec-Aufnahme in IndexedDB, Beenden-Button direkt,
  Kamera stoppt sauber beim Spielende, Linsen-Auswahl im Kamera-Assistent
- ENGINE v4 (src/camera-engine.js): Spitze = oberes Blob-Drittel (Pfeile haengen nach
  unten), 8 Unit-Tests gruen - aber NOCH NICHT an echter Scheibe verifiziert!
- SCHEIBE GEMESSEN (aus Kays Video, glm-Analyse): Steel-Board!, Mitte ~(53-56%/44-47%),
  Radius ~22-30% Breite. E-Dart-Vermutung war FALSCH - Kay spielt STEEL.
- MEDIA-RECORDER-Videos sind KAPUTT ("File ended prematurely", Cluster-Rettung scheitert)
  => DEAD END, nicht weiter verfolgen!
- NAechster Schritt (frische Session!): LIVE-FRAMES statt Video: App offen + Kamera an,
  via CDP canvas.drawImage(video) -> toDataURL -> volle Aufloesung. Pfeile drin/raus =
  2 Frames => Kalibrierung pixelgenau => Engine an echten Pfeilen verifizieren/tunen.
  Kay-Zitat Ablauf: er sagt "jetzt", Frame ziehen. Display muss AN sein (sonst schwarz).
- Kays Regeln heute gelernt: ERST selbst messen/beweisen dann Kay (Screenshot-Routine mit
  wake+PIL-check), keine Toggle-Verwirrung, Beenden ohne Rueckfrage, Kabel nur zum Uebertragen

## Tap-Eingabe Stand (24.10. spät)
- TAP-AUF-DIE-SCHEIBE funktioniert (zaehlt), Felder "teilweise" richtig
- Zoom-sichere Kalibrierung + Bull-Feintuning (Kontroll-Tipp) sind DEPLOYED - Kay
  hat evtl. noch nicht mit der neuesten Version neu kalibriert!
- Kay's 2 Referenzfotos: camera-ref/kay-scheibe1+2.jpg (Oppo-Fotokamera 4416x5888,
  Pfeile auf S20/D11/S19 etc. per glm erkannt) - fuer naechste Kalibrier-Session
- NAECHSTE SESSION: 1. App-Frame via CDP ziehen (Display AN, App VORDERGRUND!)
  2. glm vermisst Scheibe im STREAM-Raum (nicht Foto-Raum!) 3. cameraCal direkt
  setzen (ohne Kay-Tipps) 4. Kay testet Taps. Alternativ Kay kalibriert neu mit
  der neuen Feintuning-Version (Bull-Kontrolltipp).

## FINALER STAND 24./25.10. (Session-Ende, alles auf main gemerged)
- KAMERA KOMPLETT: v5-Engine (PCA-Ellipsen-Fit, Normierraum, Phasen-Rotation,
  Pfeil als starrer Koerper mit Breitenprofil), Bounce-Out-Schutz (nach OMNI-Recherche),
  max. Handy-Cam-Optimierung (1920p/30fps, Fokus continuous-video, Torch-Button),
  Profil-Kamerastudio (Kamera+Weitwinkel-Auto+Zoom+Auto-Kalibrierung+manueller Fallback),
  Tap-Eingabe im Spiel mit TIPP-JETZT-Banner + GESPEICHERT-Bestaetigung
- 169 Unit-Tests gruen inkl. Schraegsicht/Dunkelheit/Rotation/Zoom-Tap-Beweise
- Diagnose-Skripte im Repo: e2e-browser-analyse, e2e-kamera-sim, console-check u.a.
- NOCH OFFEN (naechste Session): BUST/ph-din-Clips per Gemini sauber generieren
  (Edge-TTS-Interims), Daniel-rest-Clips, Kays 4 Verkaufsentscheidungen (PLAN.md),
  Auto-Erkennung an echter Scheibe final verifizieren (Kay-Quote einholen)
- Omni-Recherche: 4 Kameras = 99,7% - Single-Cam Grenze ~90-95%. 2. Handy als
  Zweitkamera = moeglicher Ausbau (gratis), Kay wollte erst keine Hardware kaufen
