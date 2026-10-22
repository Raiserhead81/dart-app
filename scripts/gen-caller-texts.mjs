// Erzeugt die Satzliste fuer den TTS-Generator — aus DENSELBEN Funktionen wie die App
// (buildCallerSentences aus src/caller-texts.js), damit Clip-Inhalt und UI-Text nie driften.
// Output: JSON { "<lang>/<clip-id>": "Text" }
import { buildCallerSentences } from '../src/caller-texts.js';

console.log(JSON.stringify(buildCallerSentences(), null, 1));
