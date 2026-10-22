// Darts-Caller-Texte: Zahlen als ausgeschriebene Caller-Worte (EN/DE), pure + testbar.

import { suggestCheckout } from './checkout.js';

const EN_ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const EN_TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const DE_ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const DE_TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

export function numberToCallerWords(n, lang = 'en') {
  n = Math.max(0, Math.floor(Number(n) || 0));
  if (lang === 'de') return deWords(n);
  return enWords(n);
}

function enWords(n) {
  if (n === 0) return 'no score';
  if (n < 20) return EN_ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return o === 0 ? EN_TENS[t] : `${EN_TENS[t]} ${EN_ONES[o]}`;
  }
  if (n === 100) return 'one hundred';
  const hundreds = Math.floor(n / 100), rest = n % 100;
  const h = `${EN_ONES[hundreds]} hundred`;
  if (rest === 0) return h;
  if (rest < 20) return `${h} and ${EN_ONES[rest]}`;
  const t = Math.floor(rest / 10), o = rest % 10;
  return o === 0 ? `${h} and ${EN_TENS[t]}` : `${h} and ${EN_TENS[t]} ${EN_ONES[o]}`;
}

function deWords(n) {
  if (n === 0) return 'kein Score';
  if (n < 20) return DE_ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    if (o === 0) return DE_TENS[t];
    return o === 1 ? 'einund' + DE_TENS[t] : `${DE_ONES[o]}und${DE_TENS[t]}`;
  }
  if (n === 100) return 'hundert';
  const hundreds = Math.floor(n / 100), rest = n % 100;
  const h = hundreds === 1 ? 'hundert' : `${DE_ONES[hundreds]}hundert`;
  if (rest === 0) return h;
  return `${h}${deWords(rest)}`;
}

// Segment-Call (nach jedem Dart, optional): T20 -> "treble twenty", 180-Spezial
export function throwCallerWords(thr, lang = 'en') {
  if (thr.k === 'sum') return numberToCallerWords(thr.v, lang);
  if (thr.k === 'miss') return lang === 'de' ? 'daneben' : 'no score';
  if (thr.k === 'bull') return lang === 'de' ? 'Bullseye' : 'bullseye';
  if (thr.k === 'outer') return lang === 'de' ? 'fünfundzwanzig' : 'twenty five';
  const n = numberToCallerWords(thr.n, lang);
  if (thr.k === 'triple') return lang === 'de' ? `dreifach ${thr.n}` : `treble ${n}`;
  if (thr.k === 'double') return lang === 'de' ? `doppel ${thr.n}` : `double ${n}`;
  return n;
}

// Rest-Call: "You require one hundred and seventy" / "Du brauchst noch einhundertsiebzig"
export function remainingCallerWords(rest, lang = 'en') {
  const num = numberToCallerWords(rest, lang);
  return lang === 'de' ? `Du brauchst noch ${num}` : `You require ${num}`;
}

export function gameShotCallerWords(lang = 'en', legsLeft = 0) {
  if (lang === 'de') return legsLeft > 0 ? `Game Shot! Noch ${legsLeft} Legs` : 'Game Shot!';
  return legsLeft > 0 ? `Game shot! ${legsLeft} legs to go` : 'Game shot!';
}

function routeCodeWords(code, lang) {
  if (code === 'Bull') return lang === 'de' ? 'Bullseye' : 'bullseye';
  const m = code.match(/^([TD])(\d{1,2})$/);
  if (!m) return numberToCallerWords(parseInt(code, 10) || 0, lang);
  const num = numberToCallerWords(parseInt(m[2], 10), lang);
  if (m[1] === 'T') return lang === 'de' ? `dreifach ${num}` : `treble ${num}`;
  return lang === 'de' ? `doppel ${num}` : `double ${num}`;
}

// Checkout-Ansage. mode: 'plain' (nur der Weg), 'match' ("for the match"),
// 'game' ("for the game"). Route-Faelle bekommen "You require ..." als Prefix.
export function checkoutCallWords(rest, lang = 'en', mode = 'plain', withPrefix = true) {
  const route = suggestCheckout(rest, 3);
  if (!route || route.length === 0) return null;
  const suffix = lang === 'de' ? 'zum Sieg' : (mode === 'match' ? 'for the match' : mode === 'game' ? 'for the game' : '');
  const suffixPart = suffix ? ` ${suffix}` : '';
  // Spezialfall: nur ein Doppel noetig -> kurz und knackig
  if (route.length === 1 && /^D\d+$/.test(route[0])) {
    return routeCodeWords(route[0], lang) + suffixPart;
  }
  const words = route.map(c => routeCodeWords(c, lang)).join(', ');
  if (!withPrefix) return words;
  return lang === 'de' ? `Du brauchst ${words}` : `You require ${words}`;
}
