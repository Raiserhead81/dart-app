# NOTIZEN dart-app

## 2026-10-25 Licht-Gate-Fix + Torch (abends, Deploy 1.0.1792945895)
- KAY-MELDUNG "schlechtes Licht obwohl viel Licht": BEWIESEN als False Negative des Echtheits-Gates. Repro scripts/repro-licht.mjs (Node, ruft analyseBoardInFrame direkt auf selbst gemaltes Board-Array): helle Wand + perfektes Board (ring 0.83, alt 0.7, bal 0.49) bekam q=45 FAIL, weil der K.O. `randDunkel<0.08` blind zuschlug - der Rand UNTER der Scheibe ist bei Tageslicht/heller Wand einfach nie dunkel. Ueberbelichtung 30% genauso gecapt.
- FIX: randDunkel-K.O. entfernt; der eigentliche False-Positive-Schutz steht (ring<0.5 UND alt<0.65 -> Cap 45, TV/Wand weiterhin abgelehnt, 8/8 Tests). Neue Werte: helle Szenarien q=76 PASS, 50%-Auswaeschung weiterhin q=24 FAIL. randDunkel bleibt als 15-Punkte-Bonus (Anreiz dunkle Umgebung), kostet aber nicht mehr den Durchbruch.
- KAY-MELDUNG "Taschenlampe geht nicht": (a) setzeTorch hielt applyConstraints-Erfolg fuer granted - Android-WebView resolved teils OHNE Fehler obwohl die Geraete-LED keine torch-capability hat (stiller Scheinerfolg). Jetzt getCapabilities().torch-Check -> ehrliches false -> Button zeigt 'kein Blitz'. (b) Torch existierte NUR im Profil-Assistenten - JETZT auch Blitz-Button im Spiel-PiP (mountCam, oben links, 💡).
- Suite 190/190 vitest; E2E Stativ 3/3 + Homographie 6/6. Deploy 1.0.1792945895, Commit ee5d05a.

## 2026-10-25 Lernfunktion (Korrektur-Tap) + Orientierungswechsel-Auto (Stativ-Paket)
- Kays Anforderung: Stativ schraeg, HOCH und QUER beide perfekt; App zaehlt Wuerfe, Kay tippt bei Fehler die ECHTE Pfeilposition -> App korrigiert Zaehlung UND lernt die Kalibrierung nach.
- BAUTEIL 1 ENGINE (src/camera-engine.js): lerneAusKorrektur(px, py, kind, nummer, cal) - Radius-Nachfuehrung 35% gedaempft (Faktor istR/sollR, Clamp 0.8-1.25, Abweis wenn Ist-Punkt >1.35 Scheibenradien), Rotations-Nachfuehrung 50% (|dRot|<=26 Grad, >0.2 Grad), h via baueHomographie mitgelernt, erg.gelernt zaehlt. Richtungs-Beweise in tests/lernen.test.js (6 Tests): Konvergenz r 0.636->0.596 gegen 0.578, rx 81->87.2 gegen 90, rot gegen Abweichung.
- BAUTEIL 2: startAuto wirft onThrow(seg, {x, y}) - Automatik-Punkt als Ist-Referenz fuer das Lernen.
- BAUTEIL 3: starteKorrekturTap(videoEl, fertig) - einmaliger Capture-Handler mit stopPropagation, Vorrang vor normalem Tap (tapEingabeAnbinden prueft istKorrekturAktiv), 12s-Sicherheits-Timeout, Mapping Zoom+Letterbox.
- BAUTEIL 4 ORIENTIERUNGSWECHSEL: cal.ar persistiert; mountCam-resize-Handler vergleicht neuAR vs cal.ar, >15% Abweichung -> cal verwerfen + AUTO-Nachkalibrierung (Stativ steht still, Scheibe auch) + onStatus('orient'/'orient-ok'/'orient-fail'). Bugfix: Handler rief zeichneBoardOverlay (in camera.js UNDEFINIERT, stumm gefangen) -> jetzt internes zeichneRaster. WICHTIG: Handler haengt NUR am mountCam-Video (Spiel-View); das Profil-Video baut profile.js selbst (dort kein Handler noetig, cal ist geteilt).
- BAUTEIL 5 UI (play.js): zeigeKorrekturBanner - Banner "T20 GEZAEHLT - falsch?" 6s + korrigieren-Button -> starteKorrekturTap -> Tap ausserhalb Scheibe = nur Toast (kein Undo-Missbrauch); sonst Undo + firePad + "Korrigiert: <label>"; Lernpfad nur bei mitgegebenem Automatik-Punkt: lerneAusKorrektur -> setCal/saveCal -> Overlay neu (zeichneBoardOverlay-Hook in play.js) -> "Kalibrierung gelernt (N. Korrektur)". BEIDE Zaehl-Stellen (Auto-Callback + Play-Kamera) nutzen jetzt zeigeKorrekturBanner. mountCam-onStatus in play.js setzt camHinweis-Text/Farbe (gold=kalibriere neu, gruen=fertig, rot=manuell tippen).
- E2E NEU (scripts/e2e-stativ-schraeg.mjs, 3 Checks): (1) Schraegkalibrierung psi=0.30/phi=0.18 -> q=100, rx=352, ar=1.778. (2) Korrektur-Tap: T20-Position via normierraumZuBild + Screen-Mapping -> echter MouseEvent-click -> erkanntes Segment = T20 exakt (745/233 vs erwartet 746/235). (3) Orientierungswechsel: Portrait-Fake = echter 720x1280-Zweitstream (gleiche Sicht um 90 Grad gerollt, srcObject-Wechsel) -> resize feuert ECHT -> Handler re-kalibriert: ar 0.5625, q=100. Lektion: defineProperty-Luege auf videoWidth reicht NICHT (drawImage-Verzerrung killt die Board-Analyse).
- Suite 190/190 vitest gruen + E2E: Stativ 3/3, Homographie 6/6. Deploy 1.0.1792943521, Commit 0ab6ebb.

## 2026-10-25 Homographie-Engine v6 (echte Schrägsicht-Korrektur)
- UMBAU: Ellipsen-Näherung → echte PROJEKTIVE Korrektur (Homographie) ohne Kamera-Intrinsics. Versatz Bull-Zentrum M′ vs. Ellipsenzentrum liefert den fehlenden Projektionsparameter. Neu in src/camera-engine.js: m3mul, baueHomographie (Guards: tp>=0.6 unplausibel→affin, tp<0.03 frontal→affin), normierraumZuBild, inNormierraum (Cramer-Inversion, det-Gate 1e-12).
- BULL-ERKENNUNG v6.2 (nach 2 Fehlversuchen): M′ = 16-Richtungs-Scan um Ellipsenzentrum, Score = grüne Pixel im 0.11r-Kern − 2×grüne im 0.30r-Ring. Grün-Zentroid-Richtung versagt (zeigt zur Triple-Masse!), affiner Normierraum-Radius-Filter auch (Triple wirkt bei Schrägsicht affin klein). Der 25er-Ring ist der EINZIGE grüne Cluster mit grün-freier Umgebung (0.094..0.527 kein Grün).
- ALLE Sampling-Stellen projektiv: rot-Phasenkorrelation, alternanz-bins (binRot/binGruen), Echtheits-ringAnteil via inNormierraum mit h. ncal um h erweitert; zeichneRaster malt Rand als 72-Segment-Polygon projektiv (affiner Fallback ctx.arc).
- autoKalibriere (camera.js): medAng() zirkularer Median für rot, h-Median über ≥2 Frames, resolve jetzt mit rx/ry/theta/rot/h/qualitaet (vorher verworfen).
- TDZ-FALLE: Destrukturierung [h,sv,vv]=rgb2hsv() shadowte früheres h im selben Block → TDZ-ReferenceError, node --check findet das NICHT. Umbenannt zu [hsv,sv,vv].
- E2E (scripts/e2e-homographie.mjs, perspektivisch geneigtes Mock-Board psi=0.22/phi=0.60): 6/6 GRÜN - q=91, cal.h 3×3, rx=353/ry=278/theta=0.122, rot=1°, Bull-Punkt err 15.5px, T20-Mitte→T20 projektiv (affin wäre OK gewesen, projektiv jetzt auch bei stärkerer Schrägsicht korrekt).
- NACHGERÜSTET (gleicher Tag, Deploy 1.0.1792935641): (a) alternanz-Sampling als Radius-Integral (f 0.55-0.64 und 0.91-1.0, Schritt 0.02, erste Farbklassifikation gewinnt) - Double-Band ist bei Schrägsicht oben nur ~3px breit, feste Radien landeten auf Bandkanten. (b) bullM-Score zählt ROT im Frei-Ring mit: um Triple-Grün liegt zwingend Rot benachbart (Sektoren alternieren im Band), um den 25er-Ring nicht (Rot erst ab 0.527r). Ergebnis: q=94-100 und Mp-Fehler 3-8px über den GESAMTEN Tilt-Bereich 13-29° (vorher K.O. ab 17°, Mp bis 37px daneben). Suite 184 Tests grün, E2E 6/6.
- Suite 24 Dateien / 184 Tests grün. Deploy 1.0.1792932780.

## 2026-10-25 Zoom-Fix (WebView) + Echtheits-Gate (Auto-Kalibrierung)
- ZOOM-BUG (Kay: "Zoom-Regler nach links -> verschwindet ploetzlich"): Ursache ist Android-WebView - <video> wird als eigene Surface gerendert, transform:scale(<1) kippt das Compositing, Bild verschwindet schlagartig. Desktop-Chrome/Headless-Playwright zeigt das NICHT (dort nur kontinuierliches Schrumpfen).
- FIX: Zoom <= 1x jetzt per LAYOUT (width:% + margin:auto, zentriert), transform nur noch fuer Zoom > 1x. Gemeinsame Helfer in camera.js: setzeAnsichtsZoom(v,z) / leseAnsichtsZoom(v). Umgestellt: profile.js-Slider, camera.js mountCam-Slider (Standard 0,5x), Kamera-Assistent, alle Klick-Mappings (Tap-Kalibrierung, manuelle Kalibrierung, zeichneRaster, play.js-Overlay) nutzen leseAnsichtsZoom (bei Layout-Zoom = 1, contain-Mapping stimmt automatisch).
- E2E-Beweis (scripts/e2e-zoom-slider.mjs): val 80..30 -> videoTransform bleibt "none", Video schrumpft 342x192 -> 103x58 px, Slider permanent sichtbar.
- ECHTHEITS-CHECK in analyseBoardInFrame (src/camera-engine.js): qualitaet 0-100 = Ringstruktur(40)+Alternanz(30)+dunkler Rand(15)+Farb-Balance(15); K.O.-Cap 45 bei (ring<0.5 UND alt<0.65) ODER randDunkel<0.08. autoKalibriere akzeptiert nur Frames mit qualitaet>=60 (kein "Kalibriert!" mehr auf Fernseher/Wand), Median-Qualitaet steht im Ergebnis.
- Grenzen dokumentiert: sehr dunkel (Faktor ~0.3-0.55 + Rauschen) -> Radius-Schaetzung kippt (r zu gross), Auto lehnt ab -> Torch an oder heller stellen oder Tap-Fallback (window.__manuellKalib). Tests (tests/board-echtheit.test.js, 8 Tests) sichern genau das.
- 404 im E2E = /favicon.ico (Chrome-Anfrage trotz link rel=icon; Icons selbst 200) - kosmetisch, ignoriert.
- Suite: 23 Dateien / 177 Tests gruen; Deploy 1.0.1792927571.

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
