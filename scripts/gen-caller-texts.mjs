// Erzeugt die Satzliste fuer den TTS-Generator — aus DENSELBEN Funktionen wie die App
// (checkout-Tabelle + Caller-Wortbildung), damit Clip-Inhalt und UI-Text nie driften.
// Output: JSON { "<lang>/<clip-id>": "Text" }
import { suggestCheckout } from '../src/checkout.js';
import { numberToCallerWords, checkoutCallWords, remainingCallerWords, throwCallerWords } from '../src/caller.js';

const IMPOSSIBLE = new Set([159, 162, 163, 165, 166, 168, 169]);
const out = {};

for (const lang of ['en', 'de']) {
  // Restscore 2..170 (auch nicht checkoutbare: Ansage des Rests bleibt sinnvoll)
  for (let n = 2; n <= 170; n++) out[`${lang}/rest-${n}`] = remainingCallerWords(n, lang);
  // Checkout-Routen (nur checkoutbar)
  for (let n = 2; n <= 170; n++) {
    if (IMPOSSIBLE.has(n)) continue;
    const c = checkoutCallWords(n, lang, 'plain', true);
    if (c) out[`${lang}/co-${n}`] = c;
  }
  // Doppel-Enden: dx-<code>[-match|-game]
  for (let d = 1; d <= 20; d++) {
    const rest = d * 2;
    out[`${lang}/dx-D${d}`] = checkoutCallWords(rest, lang, 'plain', true);
    out[`${lang}/dx-D${d}-match`] = checkoutCallWords(rest, lang, 'match', true);
    out[`${lang}/dx-D${d}-game`] = checkoutCallWords(rest, lang, 'game', true);
  }
  out[`${lang}/dx-Bull`] = checkoutCallWords(50, lang, 'plain', true);
  out[`${lang}/dx-Bull-match`] = checkoutCallWords(50, lang, 'match', true);
  out[`${lang}/dx-Bull-game`] = checkoutCallWords(50, lang, 'game', true);
  // Score-Zahlen 0..180 (Zahlworte; 0 = No score)
  for (let n = 0; n <= 180; n++) {
    if (lang === 'en') out[`en/sc-${n}`] = numberToCallerWords(n, 'en');
    else out[`de/sc-${n}`] = numberToCallerWords(n, 'de');
  }
  // Segment-Calls
  out[`${lang}/seg-miss`] = throwCallerWords({ k: 'miss', n: 0, v: 0 }, lang);
  out[`${lang}/seg-bull`] = throwCallerWords({ k: 'bull', n: 50, v: 50 }, lang);
  out[`${lang}/seg-25`] = throwCallerWords({ k: 'outer', n: 25, v: 25 }, lang);
  for (let n = 1; n <= 20; n++) {
    out[`${lang}/seg-s${n}`] = throwCallerWords({ k: 'single', n, v: n }, lang);
    out[`${lang}/seg-d${n}`] = throwCallerWords({ k: 'double', n, v: n * 2 }, lang);
    out[`${lang}/seg-t${n}`] = throwCallerWords({ k: 'triple', n, v: n * 3 }, lang);
  }
}

// Phrasen (nur EN als Voll-Sets; DE-Caller laeuft ueber edge/Web-Speech)
out['en/ph-gameshot'] = 'Game shot!';
out['en/ph-gameshot-1'] = 'Game shot! One leg to play.';
out['en/ph-gameshot-2'] = 'Game shot! Two legs to play.';
out['en/ph-gameshot-3'] = 'Game shot! Three legs to play.';
out['en/ph-bust'] = 'No score!';
out['en/ph-180'] = 'ONE HUNDRED AND EIGHTY!';
out['en/ph-mugsaway'] = 'Mugs away!';
out['de/ph-gameshot'] = 'Game Shot!';
out['de/ph-bust'] = 'Kein Score!';

console.log(JSON.stringify(out, null, 1));
