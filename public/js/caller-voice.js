// Caller-Stimme: echte Audio-Clips von /caller/<set>/<lang>/ (ElevenLabs, Gemini, edge)
// oder Web-Speech als EXPLIZITES Set ("Gerätstimme"). Strikt serielle Queue: genau EIN
// Audio-Element spielt jezeit, der nächste Clip startet erst nach 'ended' + Gap-Wert.
//
// Kein Auto-Fallback mehr (Kays Ton-Bug): Fehlt ein Clip im gewählten Set -> STILLE.
// Bisher fiel fehlende rest-171..501-Clips mitten in der Sequenz auf speechSynthesis
// (weibliche Gerätstimme) zurück = Stimmmix + Timing-Chaos. Web-Speech läuft nur noch,
// wenn das Set "device" explizit gewählt ist.
//
// iOS-PWA: Audio-Element-Pool wird beim Spielstart vorab erstellt (warmAudioPool) und
// bei der ersten User-Geste entsperrt (unlockAudio) — kein Element wird mehr mitten
// in einer Sequenz neu erzeugt/entsperrt, Reihenfolge 100%.

import { remainingCallerWords, checkoutCallWords, throwCallerWords, gameShotCallerWords } from '/js/core/caller.js';
import { suggestCheckout } from '/js/core/checkout.js';
import { visitSequence, endSequence } from '/js/core/caller-sequence.js';

export const DEVICE_SET = 'device'; // Web-Speech — nur manuell wählbar, nie Auto-Mix

const audioCache = new Map();   // url -> Audio-Element (wird wiederverwendet)
const missing = new Set();      // URLs, die es im Set nicht gibt -> Stille
const sparePool = [];           // vorgebaute, entsperrende Elemente (iOS)
let queue = [];
let playing = false;
let drainWaiters = [];

let settings = { enabled: true, checkout: true, dartCalls: true, lang: 'en', rate: 1.0, voiceURI: null, voiceSet: 'gemma', applause: true };

export function configureCaller(s) { settings = { ...settings, ...s }; if (!settings.voiceSet) settings.voiceSet = 'gemma'; }
export function callerSettings() { return settings; }

// Stimm-Sets: Verzeichnisse unter /caller/<set>/<lang>/. Manifest liefert die Auswahl;
// "Gerätstimme" wird als eigenes Set ans Ende gehängt.
let manifest = null;
export async function loadCallerManifest() {
  if (!manifest) {
    try {
      const res = await fetch('/caller/manifest.json', { cache: 'no-store' });
      if (res.ok) manifest = await res.json();
    } catch (e) { /* offline */ }
    manifest = manifest || { sets: [{ id: 'edge', label: 'Caller (Standard)', provider: 'edge', full: true }] };
    if (!manifest.sets.some(s => s.id === DEVICE_SET)) {
      manifest.sets.push({ id: DEVICE_SET, label: 'Gerätstimme', provider: 'device', full: true });
    }
  }
  return manifest;
}

function clipUrlFor(set, kind, a, b) {
  if (!set || set === DEVICE_SET) return null;
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

// GENAU EIN Kandidat je Clip: das gewählte Set. Kein Set-übergreifender Stimm-Mix.
function clipCandidates(kind, a, b) {
  return [clipUrlFor(settings.voiceSet || 'gemma', kind, a, b)].filter(Boolean);
}
const clipUrl = (kind, a, b) => clipCandidates(kind, a, b)[0];

// ---------- Audio-Elemente: Pool statt "new Audio" mitten im Spiel ----------
const CACHE_MAX = 120;

function newAudioElement() {
  const a = new Audio();
  a.preload = 'auto';
  return a;
}

function acquireAudio(url) {
  if (missing.has(url)) return null;
  let a = audioCache.get(url);
  if (a) return a;
  a = sparePool.pop() || newAudioElement(); // Pool-Element = auf iOS schon entsperrt
  audioCache.set(url, a);
  evictCache();
  return a;
}

// URL an ein Element binden (nur bei Wechsel — kein Reload bei Wiederverwendung).
// Der error-Listener wird PRO URL gescopet: Ein VERSPÄTETER 404-Error eines alten
// Preloads darf NIE die gerade geladene URL als "missing" markieren (hat exakt die
// verschwundenen "You require"-Sätze erzeugt — Kays Gebrabbel-Lücken).
function attachUrl(a, url) {
  if (a.__loadedUrl === url) return false;
  if (a.__errFn) a.removeEventListener('error', a.__errFn);
  a.__loadedUrl = url;
  a.__errFn = () => missing.add(url);
  a.addEventListener('error', a.__errFn);
  try { a.src = url; } catch (e) { /* egal */ }
  return true;
}

// Cache klein halten — aber NIE ein Element verdraengen, das gerade spielt
function evictCache() {
  if (audioCache.size <= CACHE_MAX) return;
  for (const [u, el] of audioCache) {
    if (audioCache.size <= CACHE_MAX) break;
    if (!el.paused) continue;
    audioCache.delete(u);
    sparePool.push(el);
  }
}

export function preloadClips(urls) {
  for (const u of urls) {
    if (!u || missing.has(u)) continue;
    const a = acquireAudio(u);
    if (!a) continue;
    attachUrl(a, u);
    try { a.load(); } catch (e) { /* egal */ }
  }
}

export function preloadForRest(rest) {
  if (rest < 2 || rest > 501) return;
  const urls = [clipUrl('rest', rest)];
  if (rest <= 170) urls.push(clipUrl('checkout', rest));
  preloadClips(urls);
}

// iOS-PWA: Pool beim Spielstart vorab erstellen (noch ohne Entsperrung).
export function warmAudioPool(n = 6) {
  if (typeof Audio === 'undefined') return 0;
  let created = 0;
  while (sparePool.length < n) { sparePool.push(newAudioElement()); created++; }
  return created;
}

const SILENCE_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

let unlocked = false;
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  warmAudioPool();
  // Pool-Elemente in der User-Geste entsperren (iOS-Regel: play() nur im Gesture-Context)
  for (const a of sparePool) {
    try {
      if (!a.src) a.src = SILENCE_WAV;
      a.volume = 0;
      const p = a.play();
      if (p && p.catch) p.catch(() => { /* Headless/autoplay-Politik: egal */ });
    } catch (e) { /* egal */ }
  }
  try {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  } catch (e) { /* egal */ }
}
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });
}

// ---------- Web-Speech: NUR für das explizite "Gerätstimme"-Set ----------
let voices = [];
function loadVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  voices = speechSynthesis.getVoices();
  return voices;
}
if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}
function speakFallback(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return Promise.resolve();
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

// ---------- Queue (STRIKT seriell: ein Satz, dann Gap, dann der nächste) ----------
// enqueue/flushPending stehen unten beim PRIO-MODELL.
// HART: sofort alles stoppen — nur für Undo/Spielende/Set-Wechsel (niemals im Wurf-Flow!)
export function clearQueue() {
  queue = [];
  for (const a of audioCache.values()) { try { a.pause(); } catch (e) {} }
  current = null;
  if (typeof speechSynthesis !== 'undefined') { try { speechSynthesis.cancel(); } catch (e) {} }
  playing = false;
  resolveIdle();
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- Tracing (Murmel-Diagnose): jede Play-Entscheidung mit Zeit + Dauer ----------
const dbg = [];
const now = () => (typeof performance !== 'undefined' ? Math.round(performance.now()) : Date.now());
function trace(ev, extra = {}) {
  dbg.push({ t: now(), ev, ...extra });
  if (dbg.length > 300) dbg.shift();
}
export function callerDebugLog() { return dbg.slice(); }

let current = null; // { url, startedAt, durationMs } — laufender Clip für callerBusyMs()
// Rest-Beschäftigungsdauer der Queue in ms (für "Anzeige halten bis Caller fertig")
export function callerBusyMs() {
  let ms = 0;
  if (current) {
    const dur = current.durationMs || 1600;
    ms += Math.max(0, dur - (now() - current.startedAt));
  }
  for (const it of queue) {
    const hasClip = (it.urls && it.urls.length) || !it.text;
    ms += (it.gapBeforeMs || 0) + (hasClip ? 1400 : 900);
  }
  return Math.round(ms);
}

async function drain() {
  playing = true;
  while (queue.length) {
    const item = queue.shift();
    if (!item) continue;
    if (item.gapBeforeMs) { trace('gap', { ms: item.gapBeforeMs }); await sleep(item.gapBeforeMs); }
    if (settings.voiceSet === DEVICE_SET) {
      trace('tts', { text: item.text });
      await speakFallback(item.text); // explizites Gerätstimme-Set
      continue;
    }
    // Clip-Fallback-AUS: fehlt der Clip -> Stille. Kein speechSynthesis-Auto-Mix.
    await playItem(item);
  }
  playing = false;
  resolveIdle();
}
function resolveIdle() {
  if (queue.length || playing) return;
  const w = drainWaiters; drainWaiters = [];
  for (const r of w) r();
}
// Für Tests/Smoke: resolved, sobald Queue leer und nichts mehr spielt.
export function callerIdle() {
  if (!playing && !queue.length) return Promise.resolve();
  return new Promise(r => drainWaiters.push(r));
}

async function playItem(item) {
  const candidates = item.urls || (item.url ? [item.url] : []);
  // Ein Satz = GENAU EIN Element: falls je ein Element leaket (alter Bug-Pfad),
  // wird es hier angehalten, bevor der nächste Satz startet. Keine Überlappung.
  for (const a of audioCache.values()) { if (!a.paused) { try { a.pause(); } catch (e) {} } }
  for (const url of candidates) {
    if (!url || missing.has(url)) continue;
    const a = acquireAudio(url);
    if (!a) continue;
    attachUrl(a, url);
    try { a.load(); } catch (e) { /* egal */ }
    const r = await new Promise(resolve => {
      a.playbackRate = item.rate || settings.rate || 1;
      a.volume = item.volume != null ? item.volume : 1;
      try { a.currentTime = 0; } catch (e) { /* egal */ }
      let fadeTimer = null;
      let watchdog = null;
      let finished = false;
      const t0 = now();
      current = { url, startedAt: t0, durationMs: null };
      const cleanup = () => {
        a.removeEventListener('ended', done); a.removeEventListener('error', err);
        if (fadeTimer) clearInterval(fadeTimer);
        if (watchdog) clearTimeout(watchdog);
      };
      const finish = (v) => {
        if (finished) return;
        finished = true; cleanup(); resolve(v);
        trace(v === 'ok' ? 'ended' : v, { url: url.split('/').pop(), ms: now() - t0 });
        if (current && current.url === url) current = null;
      };
      const done = () => finish('ok');
      const err = () => { missing.add(url); finish('missing'); };
      a.addEventListener('ended', done);
      a.addEventListener('error', err);
      trace('play', { url: url.split('/').pop() });
      a.play().then(() => {
        // Sicherheitsnetz: 'ended' feuert auf manchen Mobil-Browsern nicht zuverlässig.
        // Bekannte Clip-Dauer (Metadata) + Puffer beendet den Satz sicher — nicht 20s warten.
        const durMs = (isFinite(a.duration) && a.duration > 0) ? Math.round(a.duration * 1000) : 8000;
        if (current) current.durationMs = durMs;
        watchdog = setTimeout(() => finish('ok'), durMs + 900);
        if (item.playMs) {
          const t1 = Date.now();
          fadeTimer = setInterval(() => {
            const left = item.playMs - (Date.now() - t1);
            if (left <= 300) { a.volume = Math.max(0, (item.volume || 1) * left / 300); }
            if (left <= 0) { clearInterval(fadeTimer); a.pause(); finish('ok'); }
          }, 60);
        }
      }).catch(() => finish('blocked'));
    });
    if (r === 'ok') return 'ok';
    if (r === 'blocked') return 'blocked';
  }
  return 'missing';
}

// ---------- Clip-IDs -> URLs + Gerätstimme-Texte ----------
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

function enqueueSequence(seq, { prio = 1, replace = false } = {}) {
  if (!settings.enabled) return;
  enqueue(seq.map(s => ({ clipId: s.clipId, urls: clipCandidatesForId(s.clipId), gapBeforeMs: s.gapBeforeMs || 0, volume: s.volume, playMs: s.playMs, text: textForClipId(s.clipId), prio })), { replace });
}

// ---------- High-Level ----------
// PRIO-MODELL (Murmel + verschluckte Rest-Sätze):
//   prio 0 = flüchtig (einzelner Dart-Call) — darf verfallen, wenn Kay schneller
//            wirft als gesprochen wird.
//   prio 1 = aktuelle Wahrheit (Visit-Ende mit "You require <rest>", 180, Game Shot,
//            Bust) — übersteht schnelle Würfe UND ersetzt wartende Ansagen.
function enqueue(items, { replace = false } = {}) {
  if (!settings.enabled) return;
  if (replace) queue.length = 0; // neues Ereignis macht alle wartenden Ansagen obsolet
  queue.push(...items);
  trace('enqueue', { n: items.length, replace, ids: items.map(i => i.clipId).join(',') });
  if (!playing) drain();
}
// Wartende FLÜCHTIGE verwerfen; laufender Clip + prio-1 (You require!) bleiben.
export function flushPending() {
  queue = queue.filter(i => (i.prio || 1) >= 1);
  resolveIdle();
}
// Dart-Call (je Wurf, einzeln mit 220ms Luft via Gap) — flüchtig
export function callDart(thr) {
  if (!settings.enabled || !settings.dartCalls) return;
  if (thr.k === 'sum') {
    enqueueSequence([{ clipId: 'sc-' + thr.v, gapBeforeMs: 220 }], { prio: 0 });
    return;
  }
  if (thr.v === 180) { call180(); return; }
  const segCode = thr.k === 'miss' ? 'miss' : thr.k === 'bull' ? 'bull' : thr.k === 'outer' ? '25' : (thr.k[0] + thr.n);
  enqueueSequence([{ clipId: 'seg-' + segCode, gapBeforeMs: 220 }], { prio: 0 });
}

// Visit-Ende: voller require-Satz + Checkout-Weg (Kays Sequenz) — ersetzt Wartendes
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
  const seq = visitSequence({ labels, rest, bust, visit180, visitHigh }, coId);
  trace('visitend', { rest, ids: seq.map(s => s.clipId).join(',') });
  enqueueSequence(seq, { replace: true });
}

export function call180() {
  if (!settings.enabled) return;
  enqueueSequence([{ clipId: 'ph-180', gapBeforeMs: 220 }], { replace: true });
}

export function callVisitHigh(points) {
  if (!settings.enabled) return;
  enqueueSequence([{ clipId: 'visit-' + points, gapBeforeMs: 220 }], { replace: true });
}

// ---------- High-Level (prio 1, replace) ----------
export function callBigFish() {
  if (!settings.enabled) return;
  enqueueSequence([{ clipId: 'ph-bigfish', gapBeforeMs: 220 }], { replace: true });
}

export function callDoubleRequired(dNumber, forMatch = false) {
  if (!settings.enabled || !settings.checkout) return;
  const code = dNumber === 50 ? 'Bull' : 'D' + dNumber;
  const words = checkoutCallWords(dNumber === 50 ? 50 : dNumber * 2, settings.lang, forMatch ? 'match' : 'plain', false);
  enqueue([{ urls: clipCandidates('double', code, forMatch ? 'match' : null), text: words || `Double ${dNumber}`, gapBeforeMs: 250, prio: 0 }]);
}

export function callGameShot(legsWonMe = 0, legsWonOpp = 0, matchOver = false) {
  if (!settings.enabled) return;
  enqueueSequence(endSequence({ matchOver, legsWonMe, legsWonOpp, applause: settings.applause !== false }), { replace: true });
}

export function callBust() {
  // Bust wird jetzt ueber callVisitEnd(bust:true) angesagt; hier nur UI-Kompatibilitaet
}

export function previewSet(setId) {
  unlockAudio();
  if (setId === DEVICE_SET) { speakFallback('Game shot!'); return; } // Preview direkt, ohne Queue
  enqueue([{ urls: [clipUrlFor(setId, 'phrase', 'gameshot')].filter(Boolean), text: 'Game shot!' }]);
}

export function precacheList() {
  const urls = [clipUrl('phrase', 'gameshot'), clipUrl('phrase', 'bust'), clipUrl('phrase', '180'), '/caller/shared/applause.mp3'];
  for (let n = 2; n <= 170; n++) urls.push(clipUrl('rest', n));
  return urls;
}
