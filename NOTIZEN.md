# NOTIZEN dart-app

## 2026-10-23 Caller-Umbau (Kay)
- KEINE Einzel-Dart-Ansage mehr im Solo-Spiel (play.js) und Online-Match (onlinematch.js); Caller spricht erst am Visit-Ende (3. Dart) die SUMME (sc-Clip, 100..179 = euphorischer visit-Clip, 180 = ph-180).
- 1+5+20 im Visit (Reihenfolge egal) => "GAAAY!!" statt Summe (ph-gay).
- Visit-Summe 1..9 => Beleidigung (ph-low-1..5, rotierend ((points-1)%5)+1).
- ph-gay/ph-low-* haben NOCH KEINE MP3-Clips: laufen bewusst über GERAETSTIMME (FUN_TTS-Flag in caller-voice.js, Ausnahme vom Stimm-Mix-Verbot). Nach Clip-Generierung (gen-caller.sh, Texte stehen in src/caller-texts.js) Flag entfernen und Clips in fullClipList() aufnehmen.
- training.js behält Einzel-Dart-Calls (Trainingsmodus = Übungsfeedback).
- callDart() bleibt als API (training + Tests), nur die Match-Flows rufen es nicht mehr auf.
- settings.dartCalls-Toggle wirkt jetzt nur noch auf training.js.
- Online-Match: callVisitEnd bekommt jetzt den echten Rest NACH dem Visit (vorher Bug: Rest vor dem Visit) + echte Visit-Summe via visitStartRest-Tracking.
