// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Caller-Satzliste (pure): genau die Texte, die in die TTS-Clips generiert werden.
// Quelle fuer scripts/gen-caller-texts.mjs UND tests/caller-texts.test.js — damit
// Clip-Inhalt, Clip-Mapping und UI-Text nie driften.
//
// REST_MAX = 501: rest-Clips KOMPLETT 2..501. Vorher gab es nur 2..170 -> bei Rest
// 171..501 (normal bei 501-Spielen!) fehlte der Clip und die App fiel mitten in der
// Sequenz auf die Weibliche Geraetestimme (speechSynthesis) zurueck = Kays Ton-Bug.

import { suggestCheckout } from './checkout.js';
import { numberToCallerWords, checkoutCallWords, remainingCallerWords, throwCallerWords } from './caller.js';

export const REST_MIN = 2;
export const REST_MAX = 501;
export const CHECKOUT_MAX = 170;
export const VISIT_HIGH_MIN = 100;
export const VISIT_HIGH_MAX = 179;
// Nicht checkoutbar (kein Doppel-Start moeglich) -> kein co-Clip
export const IMPOSSIBLE = new Set([159, 162, 163, 165, 166, 168, 169]);

export function buildCallerSentences() {
  const out = {};

  for (const lang of ['en', 'de']) {
    // Restscore KOMPLETT 2..501 ("You require ...") — der Kern-Fix
    for (let n = REST_MIN; n <= REST_MAX; n++) out[`${lang}/rest-${n}`] = remainingCallerWords(n, lang);
    // Checkout-Routen (nur checkoutbar bis 170)
    for (let n = 2; n <= CHECKOUT_MAX; n++) {
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
    for (let n = 0; n <= 180; n++) out[`${lang}/sc-${n}`] = numberToCallerWords(n, lang);
    // 100+-Visit-Jubel (nur EN — euphorischer Call bei Visit >= 100)
    if (lang === 'en') {
      for (let n = VISIT_HIGH_MIN; n <= VISIT_HIGH_MAX; n++) out[`en/visit-${n}`] = `${numberToCallerWords(n, 'en')}!!`;
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

  // Phrasen (nur EN als Voll-Sets; DE-Caller laeuft ueber edge/Geraetestimme)
  // High-/Euphorische Varianten: gen-euphoric.py (Server) nutzt eigene Schreibweise
  // ("GAME SHOT!!") mit mehr style — die Basis-Phrasen hier bleiben die ruhige Version.
  out['en/ph-gameshot'] = 'Game shot!';
  out['en/ph-set'] = 'SET!';
  out['en/ph-perf'] = 'What a performance!!';
  out['en/ph-gameshot-1'] = 'Game shot! One leg to play.';
  out['en/ph-gameshot-2'] = 'Game shot! Two legs to play.';
  out['en/ph-gameshot-3'] = 'Game shot! Three legs to play.';
  out['en/ph-bust'] = 'No score!';
  out['en/ph-180'] = 'ONE HUNDRED AND EIGHTY!';
  out['en/ph-mugsaway'] = 'Mugs away!';
  out['en/ph-bigfish'] = 'BIG FISH!! ONE HUNDRED AND SEVENTY!!';
  out['en/ph-gameshot-high'] = 'GAME SHOT!!';
  out['en/ph-match'] = 'Game, set and match!!';
  out['en/ph-gameshot'] = 'Game shot!';
  out['en/ph-bust'] = 'No score!';

  // KAY-FUN: 1+5+20 = "GAAAY!!" (statt Summe 26) + Trash-Talk bei Visit < 10
  out['en/ph-gay'] = 'GAAAY!!';
  out['de/ph-gay'] = 'GAAAY!!';
  out['en/ph-low-1'] = 'You call that darts?! Appalling!';
  out['en/ph-low-2'] = 'Absolutely dreadful!';
  out['en/ph-low-3'] = 'Shocking! Simply shocking!';
  out['en/ph-low-4'] = 'Embarrassing. Truly embarrassing!';
  out['en/ph-low-5'] = 'My grandmother throws better than you!';
  out['de/ph-low-1'] = 'Das soll Darts sein?! Grauenhaft!';
  out['de/ph-low-2'] = 'Absolut grausig!';
  out['de/ph-low-3'] = 'Schockierend! Einfach schockierend!';
  out['de/ph-low-4'] = 'Peinlich. Wirklich peinlich!';
  out['de/ph-low-5'] = 'Meine Oma wirft besser als du!';
  out['de/ph-gameshot'] = 'Game Shot!';
  out['de/ph-bust'] = 'Kein Score!';

  return out;
}
