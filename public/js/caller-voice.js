// Caller-Stimme: echte Audio-Clips von /caller/<lang>/ (edge-tts, Server) mit
// Web-Speech-Fallback. Serielle Queue, Preload, iOS-Unlock bei erster Interaktion.

import { remainingCallerWords, checkoutCallWords, throwCallerWords, gameShotCallerWords } from '/js/core/caller.js';

const audioCache = new Map();   // url -> Audio
const missing = new Set();      // urls, die 404 liefern
let queue = [];
let playing = false;

let settings = { enabled: true, checkout: true, dartCalls: true, lang: 'en', rate: 1.0, voiceURI: null };

export function configureCaller(s) { settings = { ...settings, ...s }; }
export function callerSettings() { return settings; }

function clipUrl(kind, a, b) {
  const lang = settings.lang === 'de' ? 'de' : 'en';
  switch (kind) {
    case 'rest': return `/caller/${lang}/rest-${a}.mp3`;
    case 'checkout': return `/caller/${lang}/co-${a}.mp3`;
    case 'double': return `/caller/${lang}/dx-${a}${b ? '-' + b : ''}.mp3`;
    case 'score': return `/caller/${lang}/sc-${a}.mp3`;
    case 'seg': return `/caller/${lang}/seg-${a}.mp3`;
    case 'phrase': return `/caller/${lang}/ph-${a}.mp3`;
    default: return null;
  }
}

function getAudio(url) {
  if (missing.has(url)) return null;
  let a = audioCache.get(url);
  if (!a) {
    a = new Audio(url);
    a.preload = 'auto';
    a.addEventListener('error', () => missing.add(url));
    audioCache.set(url, a);
    if (audioCache.size > 80) {
      const first = audioCache.keys().next().value;
      const old = audioCache.get(first);
      old.pause(); old.src = '';
      audioCache.delete(first);
    }
  }
  return a;
}

export function preloadClips(urls) {
  for (const u of urls) {
    if (!u || missing.has(u)) continue;
    const a = getAudio(u);
    if (a) { try { a.load(); } catch (e) { /* egal */ } }
  }
}

// Relevante Clips für einen Rest vorladen (Restscore + Checkout + Doppel-Enden)
export function preloadForRest(rest) {
  const urls = [clipUrl('rest', rest), clipUrl('checkout', rest)];
  if (rest % 2 === 0 && rest >= 2 && rest <= 40) {
    urls.push(clipUrl('double', 'D' + (rest / 2), 'match'), clipUrl('double', 'D' + (rest / 2), 'game'));
  }
  if (rest === 50) urls.push(clipUrl('double', 'Bull', 'match'), clipUrl('double', 'Bull', 'game'));
  preloadClips(urls);
}

// ---------- Unlock (iOS) ----------
let unlocked = false;
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  try {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch (e) { /* egal */ }
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
}

// ---------- Web-Speech-Fallback ----------
let voices = [];
function loadVoices() {
  if (!('speechSynthesis' in window)) return [];
  voices = speechSynthesis.getVoices();
  return voices;
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
function speakFallback(text) {
  if (!('speechSynthesis' in window)) return;
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = settings.lang === 'de' ? 'de-DE' : 'en-GB';
    u.rate = Math.min(1.4, Math.max(.8, settings.rate || 1));
    if (settings.voiceURI) {
      const v = voices.find(v => v.voiceURI === settings.voiceURI);
      if (v) u.voice = v;
    } else {
      const pref = loadVoices().find(v => v.lang.toLowerCase().startsWith(u.lang.slice(0, 2)));
      if (pref) u.voice = pref;
    }
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}

// ---------- Queue ----------
function enqueue(items) {
  if (!settings.enabled) return;
  queue.push(...items);
  if (!playing) drain();
}
export function clearQueue() {
  queue = [];
  if (playing) {
    // laufenden Clip stoppen
    for (const a of audioCache.values()) { try { a.pause(); } catch (e) {} }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  playing = false;
}

async function drain() {
  playing = true;
  while (queue.length) {
    const item = queue.shift();
    if (!item) continue;
    const played = await playItem(item);
    if (!played && item.text) await speakFallback(item.text);
  }
  playing = false;
}

function playItem(item) {
  return new Promise(resolve => {
    if (item.url && !missing.has(item.url)) {
      const a = getAudio(item.url);
      if (a) {
        a.playbackRate = item.rate || settings.rate || 1;
        const done = () => { a.removeEventListener('ended', done); a.removeEventListener('error', err); resolve(true); };
        const err = () => { a.removeEventListener('ended', done); a.removeEventListener('error', err); resolve(false); };
        a.addEventListener('ended', done);
        a.addEventListener('error', err);
        a.play().catch(() => resolve(false));
        return;
      }
    }
    resolve(false); // Fallback: TTS mit text
  });
}

const dNum = n => ({ code: 'D' + n, n });
const dCodeName = dcode => dcode.slice(1);

// ---------- High-Level-Ansagen ----------
// Nach jedem Dart (optional): Segment-Punkte
export function callThrow(thr) {
  if (!settings.enabled || !settings.dartCalls) return;
  if (thr.k === 'sum') {
    enqueue([{ url: clipUrl('score', thr.v), text: throwCallerWords(thr, settings.lang) }]);
    return;
  }
  if (thr.v === 180) {
    enqueue([{ url: clipUrl('phrase', '180'), text: 'One hundred and eighty!', rate: 1.08 }]);
    return;
  }
  const segCode = thr.k === 'miss' ? 'miss' : thr.k === 'bull' ? 'bull' : thr.k === 'outer' ? '25' : (thr.k[0] + thr.n);
  enqueue([{ url: clipUrl('seg', segCode), text: throwCallerWords(thr, settings.lang) }]);
}

// Nach dem Wurfsatz: Restscore (immer) + Checkout-Weg (optional)
export function callVisitEnd(rest, { forMatch = false } = {}) {
  if (!settings.enabled) return;
  const items = [{ url: clipUrl('rest', rest), text: remainingCallerWords(rest, settings.lang) }];
  if (settings.checkout) {
    const co = checkoutCallWords(rest, settings.lang, forMatch ? 'match' : 'plain', true);
    if (co) {
      const isDouble = rest === 50 || (rest >= 2 && rest <= 40 && rest % 2 === 0);
      if (isDouble) {
        const d = rest === 50 ? 'Bull' : 'D' + (rest / 2);
        items.push({ url: clipUrl('double', d, forMatch ? 'match' : null), text: co });
      } else {
        items.push({ url: clipUrl('checkout', rest), text: co });
      }
    }
  }
  enqueue(items);
}

// Zwischenruf: nur noch ein Doppel noetig
export function callDoubleRequired(dNumber, forMatch = false) {
  if (!settings.enabled || !settings.checkout) return;
  const code = dNumber === 50 ? 'Bull' : 'D' + dNumber;
  const words = checkoutCallWords(dNumber === 50 ? 50 : dNumber * 2, settings.lang, forMatch ? 'match' : 'plain', false);
  enqueue([{ url: clipUrl('double', code, forMatch ? 'match' : null), text: words || `Double ${dNumber}` }]);
}

export function callGameShot(legsLeft = 0) {
  if (!settings.enabled) return;
  const key = legsLeft > 0 ? 'gameshot-' + Math.min(3, legsLeft) : 'gameshot';
  enqueue([{ url: clipUrl('phrase', key), text: gameShotCallerWords(settings.lang, legsLeft) }]);
}

export function callBust() {
  if (!settings.enabled || !settings.dartCalls) return;
  enqueue([{ url: clipUrl('phrase', 'bust'), text: settings.lang === 'de' ? 'Kein Score!' : 'No score!' }]);
}

// Alle URLs fuer Service-Worker-Precache (haeufigste)
export function precacheList() {
  const urls = [clipUrl('phrase', 'gameshot'), clipUrl('phrase', 'bust'), clipUrl('phrase', '180')];
  for (let n = 2; n <= 170; n++) urls.push(clipUrl('rest', n));
  return urls;
}
