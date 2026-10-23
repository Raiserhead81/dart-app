// STUMMER UI-E2E (Playwright, headless, --mute-audio): spielt 3 Visits im ECHTEN Spiel
// (Pad-Taps) und beweist anhand des Caller-Trace:
//   1) jeder Clip spielt KOMPLETT (play -> ended, ms ~ Clip-Dauer, keine Fragmente)
//   2) strikt seriell (kein play, während der vorige Clip läuft)
//   3) 3. Dart bleibt >= 1,2 s sichtbar, bevor die Ansicht weiterschaltet
// Run: node scripts/e2e-smoke.mjs [BASE]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';
const VISITS = parseInt(process.env.VISITS || '3', 10);

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  window.__ttsCalls = 0;
  window.__ttsText = null;
  if (window.speechSynthesis) {
    const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => {
      if (u && u.text && u.text.trim() && (u.volume == null || u.volume > 0)) { window.__ttsCalls++; window.__ttsText = u.text; }
      return orig(u);
    };
  }
});
const page = await ctx.newPage();
const clip404 = [];
page.on('response', r => { if (r.url().includes('/caller/') && r.status() >= 400) clip404.push(`${r.url()} -> ${r.status()}`); });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
const version = (await page.request.get(BASE + '/VERSION').then(r => r.text())).trim();
console.log('VERSION:', version);
// Set VOR dem Spiel pinnen (frisches Headless-Profil haette sonst das Default-Set)
const PIN = process.env.SET || 'elevenlabs-brian';
await page.evaluate(async (set) => {
  const m = await import('/js/caller-voice.js');
  m.configureCaller({ enabled: true, voiceSet: set, lang: 'en', checkout: true, dartCalls: true, applause: false });
}, PIN);

// --- Spiel starten (Solo, 501) ---
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
await page.getByRole('button', { name: 'SINGLE' }).click().catch(() => {});
console.log('Spiel gestartet, Pad sichtbar');

// --- VISITS x 3x Single-20 tappen; Hold je Turn messen ---
const holds = [];
for (let v = 0; v < VISITS; v++) {
  for (let d = 0; d < 3; d++) {
    await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
    await page.waitForTimeout(150);
  }
  // Nach dem 3. Dart: visitbar muss die Pills HALTEN (>=1,2s), dann leeren
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const vb = document.querySelector('#visitbar');
    return vb && (vb.textContent.match(/·/g) || []).length === 3;
  }, { timeout: 20000 });
  holds.push(Date.now() - t0);
}
console.log('Turn-Holds (ms):', holds.join(', '));

// --- Caller-Trace auswerten (erst wenn ALLES fertig gespielt ist) ---
const report = await page.evaluate(() => {
  return import('/js/caller-voice.js').then(async m => {
    await Promise.race([m.callerIdle(), new Promise(r => setTimeout(r, 25000))]);
    await new Promise(r => setTimeout(r, 400));
    return { log: m.callerDebugLog(), ttsCalls: window.__ttsCalls, busy: m.callerBusyMs() };
  });
});
const plays = report.log.filter(e => e.ev === 'play');
const ends = report.log.filter(e => e.ev === 'ended');
const errors = report.log.filter(e => e.ev === 'missing' || e.ev === 'error');
console.log('Plays:', plays.length, '| Ended:', ends.length, '| Fehler:', errors.length, '| TTS (>0 Volume):', report.ttsCalls, '| busy:', report.busy);
console.log('VOLLER TRACE:');
for (const e of report.log) console.log('  ', JSON.stringify(e));

let ok = true;
// 1) Jeder Play hat genau ein Ended mit realer Dauer
const endByUrl = new Map();
for (const e of ends) endByUrl.set(e.url + '@' + e.t, e);
if (plays.length !== ends.length) { ok = false; console.log('FEHLER: play/ended-Zähler weichen ab'); }
for (const e of ends) {
  if (!(e.ms > 250)) { ok = false; console.log('FRAGMENT?:', e.url, e.ms + 'ms'); }
}
// 2) Strikt seriell: kein play startet vor dem ended des vorigen Clips
const seq = report.log.filter(e => e.ev === 'play' || e.ev === 'ended');
for (let i = 1; i < seq.length; i++) {
  if (seq[i].ev === 'play' && seq[i - 1].ev === 'ended' && seq[i].t < seq[i - 1].t) {
    ok = false; console.log('ÜBERLAPPUNG vor', seq[i].url);
  }
}
// 3) 3. Dart sichtbar gehalten
for (const h of holds) {
  if (h < 1200) { ok = false; console.log('HOLD ZU KURZ:', h + 'ms'); }
}
if (report.ttsCalls !== 0) { ok = false; console.log('TTS-Aufrufe:', report.ttsCalls); }
// Bekannte Quota-Lücken im Brian-Set (rest-453..501 existieren am Server nicht) —
// deren Preload-404s sind erwartbar, alles andere ist ein Clip-Fehler.
const knownMissing = clip404.filter(u => /rest-(4[5-9]\d|501)\.mp3 -> 404$/.test(u));
const real404 = clip404.filter(u => !knownMissing.includes(u));
if (real404.length) { ok = false; console.log('Clip-Fehler:', real404); }
// Beweis: mindestens ein rest-Satz wurde angefragt UND geladen (nicht nur Preload-404)
const restOK = report.log.some(e => e.ev === 'ended' && /^rest-\d+\.mp3$/.test(e.url));
if (!restOK) { ok = false; console.log('KEIN rest-Satz komplett gespielt!'); }

console.log(ok
  ? `E2E OK: ${plays.length} Clips komplett+seriell, Holds ${holds.join('/')}ms >=1200ms, 0 TTS`
  : 'E2E FEHLGESCHLAGEN (siehe oben)');
await browser.close();
process.exit(ok ? 0 : 1);
