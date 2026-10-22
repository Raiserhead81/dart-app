// Caller-Stimme: echte Audio-Clips von /caller/<set>/<lang>/ (ElevenLabs, edge) mit
// Web-Speech-Fallback. Serielle Queue MIT sauberen Pausen (Kays Timing), Applaus bei
// Game Shot / Match. Preload + iOS-Unlock bei erster Interaktion.

import { remainingCallerWords, checkoutCallWords, throwCallerWords, gameShotCallerWords } from '/js/core/caller.js';
import { suggestCheckout } from '/js/core/checkout.js';
import { visitSequence, endSequence } from '/js/core/caller-sequence.js';

const audioCache = new Map();
const missing = new Set();
let queue = [];
let playing = false;

let settings = { enabled: true, checkout: true, dartCalls: true, lang: 'en', rate: 1.0, voiceURI: null, voiceSet: 'elevenlabs', applause: true };

export function configureCaller(s) { settings = { ...settings, ...s }; }
export function callerSettings() { return settings; }

// Stimm-Sets: Verzeichnisse unter /caller/<set>/<lang>/. Manifest liefert die Auswahl.
let manifest = null;
export async function loadCallerManifest() {
  if (manifest) return manifest;
  try {
    const res = await fetch('/caller/manifest.json', { cache: 'no-store' });
    if (res.ok) manifest = await res.json();
  } catch (e) { /* offline */ }
  return manifest || { sets: [{ id: 'edge', label: 'Caller (Standard)', provider: 'edge', full: true }] };
}

function clipUrlFor(set, kind, a, b) {
  if (!set) return null;
  const lang = settings.lang === 'de' ? 'de' : 'en';
  switch (kind) {
    case 'rest': return `/caller/${set}/${lang}/rest-${a}.mp3`;
    case 'checkout': return `/caller/${set}/${lang}/co-${a}.mp3`;
    case 'double': return `/caller/${set}/${lang}/dx-${a}${b ? '-' + b : ''}.mp3`;
    case 'score': return `/caller/${set}/${lang}/sc-${a}.mp3`;
    case 'seg': return `/caller/${set}/${lang}/seg-${a}.mp3`;
    case 'visit': return `/caller/${set}/${lang}/visit-${a}.mp3`;
    case 'phrase': return `/caller/${set}/${lang}/ph-${a}.mp3`;
    default: return null;
  }
}

function clipCandidatesForId(clipId) {
  if (clipId === 'applause') return ['/caller/shared/applause.mp3'];
  let m;
  if ((m = clipId.match(/^rest-(\d+)$/))) return clipCandidates('rest', +m[1]);
  if ((m = clipId.match(/^co-(\d+)$/))) return clipCandidates('checkout', +m[1]);
  if ((m = clipId.match(/^sc-(\d+)$/))) return clipCandidates('score', +m[1]);
  if ((m = clipId.match(/^visit-(\d+)$/))) return clipCandidates('visit', +m[1]);
  if ((m = clipId.match(/^dx-(.+?)(-(match|game))?$/))) return clipCandidates('double', m[1], m[3] || null);
  if ((m = clipId.match(/^seg-(.+)$/))) return clipCandidates('seg', m[1]);
  if ((m = clipId.match(/^ph-(.+)$/))) return clipCandidates('phrase', m[1]);
  return [];
}

function clipCandidates(kind, a, b) {
  const out = [];
  const set = settings.voiceSet || 'elevenlabs';
  if (set !== 'edge') out.push(clipUrlFor(set, kind, a, b));
  out.push(clipUrlFor('edge', kind, a, b));
  return out.filter(Boolean);
}
const clipUrl = (kind, a, b) => clipCandidates(kind, a, b)[0];

function getAudio(url) {
  if (missing.has(url)) return null;
  let a = audioCache.get(url);
  if (!a) {
    a = new Audio(url);
    a.preload = 'auto';
    a.addEventListener('error', () => missing.add(url));
    audioCache.set(url, a);
    if (audioCache.size > 90) {
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

export function preloadForRest(rest) {
  if (rest < 2 || rest > 170) return;
  const urls = [clipUrl('rest', rest), clipUrl('checkout', rest)];
  preloadClips(urls);
}

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
  if (!('speechSynthesis' in window) || !text) return Promise.resolve();
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

// ---------- Queue (seriell mit Pausen) ----------
function enqueue(items) {
  if (!settings.enabled) return;
  queue.push(...items);
  if (!playing) drain();
}
export function clearQueue() {
  queue = [];
  if (playing) {
    for (const a of audioCache.values()) { try { a.pause(); } catch (e) {} }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  playing = false;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function drain() {
  playing = true;
  while (queue.length) {
    const item = queue.shift();
    if (!item) continue;
    if (item.gapBeforeMs) await sleep(item.gapBeforeMs);
    const result = await playItem(item);
    if (result === 'missing' && item.text) await speakFallback(item.text);
    // 'blocked' (Headless/kein Audio-Backend): Clip existiert, Wiedergabe unmoeglich -> kein TTS
  }
  playing = false;
}

async function playItem(item) {
  const candidates = item.urls || (item.url ? [item.url] : []);
  for (const url of candidates) {
    if (!url || missing.has(url)) continue;
    let available = true;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      if (head.status === 404) available = false;
    } catch (e) { /* offline: Wiedergabe versuchen */ }
    if (!available) { missing.add(url); continue; }
    const a = getAudio(url);
    if (!a) continue;
    const r = await new Promise(resolve => {
      a.playbackRate = item.rate || settings.rate || 1;
      a.volume = item.volume != null ? item.volume : 1;
      let fadeTimer = null;
      const cleanup = () => { a.removeEventListener('ended', done); a.removeEventListener('error', err); if (fadeTimer) clearInterval(fadeTimer); a.volume = 1; };
      const done = () => { cleanup(); resolve('ok'); };
      const err = () => { cleanup(); resolve('missing'); };
      a.addEventListener('ended', done);
      a.addEventListener('error', err);
      a.play().then(() => {
        if (item.playMs) {
          const t0 = Date.now();
          fadeTimer = setInterval(() => {
            const left = item.playMs - (Date.now() - t0);
            if (left <= 300) { a.volume = Math.max(0, (item.volume || 1) * left / 300); }
            if (left <= 0) { clearInterval(fadeTimer); a.pause(); done(); }
          }, 60);
        }
      }).catch(() => { cleanup(); resolve('blocked'); });
    });
    if (r === 'ok') return 'ok';
    if (r === 'blocked') return 'blocked';
    missing.add(url);
  }
  return 'missing';
}

// ---------- Clip-IDs -> URLs + Fallback-Texte ----------
function textForClipId(id) {
  let m;
  if ((m = id.match(/^rest-(\d+)$/))) return remainingCallerWords(+m[1], settings.lang);
  if ((m = id.match(/^co-(\d+)$/))) return checkoutCallWords(+m[1], settings.lang, 'plain', true);
  if ((m = id.match(/^dx-(.+?)(-(match|game))?$/))) {
    const code = m[1];
    const rest = code === 'Bull' ? 50 : parseInt(code.slice(1), 10) * 2;
    return checkoutCallWords(rest, settings.lang, m[3] || 'plain', true);
  }
  if ((m = id.match(/^seg-(.+)$/))) {
    const k = m[1];
    if (k === 'miss') return throwCallerWords({ k: 'miss', n: 0, v: 0 }, settings.lang);
    if (k === 'bull') return throwCallerWords({ k: 'bull', n: 50, v: 50 }, settings.lang);
    if (k === '25') return throwCallerWords({ k: 'outer', n: 25, v: 25 }, settings.lang);
    const kind = k[0] === 't' ? 'triple' : k[0] === 'd' ? 'double' : 'single';
    return throwCallerWords({ k: kind, n: parseInt(k.slice(1), 10), v: 0 }, settings.lang);
  }
  if ((m = id.match(/^visit-(\d+)$/))) return throwCallerWords({ k: 'sum', v: +m[1] }, settings.lang) + '!!';
  if (id === 'ph-180') return 'One hundred and eighty!';
  if (id === 'ph-bust') return settings.lang === 'de' ? 'Kein Score!' : 'No score!';
  if (id === 'ph-match') return 'Game, set and match!';
  if (id === 'ph-bigfish') return 'Big fish!';
  if (id === 'ph-gameshot-high') return gameShotCallerWords(settings.lang);
  if ((m = id.match(/^ph-leg-(\d)-(\d)$/))) return `${m[1]}-${m[2]}`;
  if (id === 'applause') return '';
  return '';
}

function enqueueSequence(seq) {
  if (!settings.enabled) return;
  enqueue(seq.map(s => ({ clipId: s.clipId, urls: clipCandidatesForId(s.clipId), gapBeforeMs: s.gapBeforeMs || 0, volume: s.volume, playMs: s.playMs, text: textForClipId(s.clipId) })));
}

// ---------- High-Level ----------
// Dart-Call (je Wurf, einzeln mit 220ms Luft via Gap)
export function callDart(thr) {
  if (!settings.enabled || !settings.dartCalls) return;
  if (thr.k === 'sum') {
    enqueueSequence([{ clipId: 'sc-' + thr.v, gapBeforeMs: 220 }]);
    return;
  }
  if (thr.v === 180) { call180(); return; }
  const segCode = thr.k === 'miss' ? 'miss' : thr.k === 'bull' ? 'bull' : thr.k === 'outer' ? '25' : (thr.k[0] + thr.n);
  enqueueSequence([{ clipId: 'seg-' + segCode, gapBeforeMs: 220 }]);
}

// Visit-Ende: voller require-Satz + Checkout-Weg (Kays Sequenz)
export function callVisitEnd(rest, { forMatch = false, bust = false, visit180 = false, visitHigh = null, labels = [] } = {}) {
  if (!settings.enabled) return;
  let coId = null;
  if (settings.checkout && rest >= 2 && rest <= 170) {
    const route = suggestCheckout(rest, 3);
    if (route) {
      coId = (rest === 50 || (rest >= 2 && rest <= 40 && rest % 2 === 0))
        ? ('dx-' + (rest === 50 ? 'Bull' : 'D' + (rest / 2)) + (forMatch ? '-match' : ''))
        : ('co-' + rest);
    }
  }
  enqueueSequence(visitSequence({ labels, rest, bust, visit180, visitHigh }, coId));
}

export function call180() {
  if (!settings.enabled) return;
  enqueueSequence([{ clipId: 'ph-180', gapBeforeMs: 220 }]);
}

export function callVisitHigh(points) {
  if (!settings.enabled) return;
  enqueueSequence([{ clipId: 'visit-' + points, gapBeforeMs: 220 }]);
}

export function callBigFish() {
  if (!settings.enabled) return;
  enqueueSequence([{ clipId: 'ph-bigfish', gapBeforeMs: 220 }]);
}

export function callDoubleRequired(dNumber, forMatch = false) {
  if (!settings.enabled || !settings.checkout) return;
  const code = dNumber === 50 ? 'Bull' : 'D' + dNumber;
  const words = checkoutCallWords(dNumber === 50 ? 50 : dNumber * 2, settings.lang, forMatch ? 'match' : 'plain', false);
  enqueue([{ urls: clipCandidates('double', code, forMatch ? 'match' : null), text: words || `Double ${dNumber}`, gapBeforeMs: 250 }]);
}

export function callGameShot(legsWonMe = 0, legsWonOpp = 0, matchOver = false) {
  if (!settings.enabled) return;
  enqueueSequence(endSequence({ matchOver, legsWonMe, legsWonOpp, applause: settings.applause !== false }));
}

export function callBust() {
  // Bust wird jetzt ueber callVisitEnd(bust:true) angesagt; hier nur UI-Kompatibilitaet
}

export function previewSet(setId) {
  unlockAudio();
  enqueue([{ urls: [clipUrlFor(setId, 'phrase', 'gameshot'), clipUrlFor('edge', 'phrase', 'gameshot')].filter(Boolean), text: 'Game shot!' }]);
}

export function precacheList() {
  const urls = [clipUrl('phrase', 'gameshot'), clipUrl('phrase', 'bust'), clipUrl('phrase', '180'), '/caller/shared/applause.mp3'];
  for (let n = 2; n <= 170; n++) urls.push(clipUrl('rest', n));
  return urls;
}
