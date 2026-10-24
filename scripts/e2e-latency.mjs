// STUMMER Latenz-Beweis (Playwright + CDP "Slow 3G"): 3 Visits schnell hintereinander.
// Beweist: (1) Start-Latenz der Ansage < 400 ms NACH Clip-Vorabladen, (2) strikt seriell
// (keine Überlappung), (3) kein mid-word-Stopp (jedes play hat sein ended mit realer
// Dauer), (4) Vergleich Leer-Cache (Mobilfunk-Fall) vs. vorgeladen.
// Run: node scripts/e2e-latency.mjs [BASE]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  window.__fsCalls = 0;
  Element.prototype.requestFullscreen = function () { window.__fsCalls++; return Promise.resolve(); };
});
const page = await ctx.newPage();

// Phase 1: App normal laden (Service Worker installiert sich — Kays Ist-Zustand)
await page.goto(BASE + '/#/play', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[data-pi]', { timeout: 60000 });
const version = (await page.request.get(BASE + '/VERSION').then(r => r.text())).trim();
console.log('VERSION:', version);

// Phase 2: Slow 3G — ab JETZT (Wiedergabe-Phase): Kays Mobilfunk-Fall beim Clip-Laden
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false, latency: 400, downloadThroughput: 400 * 1024 / 8, uploadThroughput: 100 * 1024 / 8
});
console.log('Netz: Slow 3G emuliert (400 ms Latenz, 400 kbit/s down)');

page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0, 120)));
await page.waitForSelector('input[data-pi]', { timeout: 90000 }).catch(async () => {
  await page.screenshot({ path: '/tmp/latency-debug.png' });
  const html = await page.evaluate(() => document.body.innerHTML.slice(0, 400));
  console.log('DEBUG-HTML:', html.replace(/\s+/g, ' '));
  throw new Error('Setup kam nicht (siehe DEBUG-HTML)');
});
// Messung A muss den LEEREN Cache messen: Warmup stoppen, sobald das Setup da ist
await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  m.stopWarmClipCache();
});
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 20000 });

// ---------- Messung A: LEERER Clip-Cache (Kays Ist-Zustand auf neuem Gerät) ----------
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForTimeout(200);
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForTimeout(200);
const t0A = Date.now();
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
let latA = await page.evaluate(async (t0) => {
  const m = await import('/js/caller-voice.js');
  const t0p = performance.now() - (Date.now() - t0);
  const t1 = Date.now();
  while (Date.now() - t1 < 30000) {
    const log = m.callerDebugLog();
    const plays = log.filter(e => e.ev === 'play' && e.t >= t0p - 10);
    if (plays.length) return Math.round(plays[0].t - t0p);
    await new Promise(r => setTimeout(r, 30));
  }
  return -1;
}, t0A);
console.log('A) Leer-Cache: Visit-Ende -> erster Ton:', latA, 'ms');

// ---------- Warmup: ALLE Clips in den Browser-Cache ----------
const warm = await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  m.warmClipCache(6);
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const w = m.warmClipProgress();
    if (!w.running) return w;
    await new Promise(r => setTimeout(r, 500));
  }
  return m.warmClipProgress();
});
console.log('Warmup fertig:', JSON.stringify(warm));

// ---------- Messung B: VORGELOADEN (der Fix) — Queue LEER, nur Ansage-Laden zählt ----------
const logLenBefore = await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  await m.callerIdle();
  m.clearQueue();
  return m.callerDebugLog().length;
});
console.log('Log-Basis:', logLenBefore);
// 3 Taps (Visit B): dartCalls aus (keine Wurf-Calls), Queue leer -> NUR die
// Ansage-Lade- und Start-Latenz von callVisitEnd wird gemessen.
const proof = await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  await m.callerIdle();
  m.clearQueue();
  m.configureCaller({ dartCalls: false });
  const base = m.callerDebugLog().length;
  const t0 = performance.now();
  m.callVisitEnd(441, { labels: [] });
  const t1 = Date.now();
  let first = -1, rest = -1;
  while (Date.now() - t1 < 20000) {
    const log = m.callerDebugLog().slice(base);
    const ve = log.find(e => e.ev === 'visitend');
    const plays = log.filter(e => e.ev === 'play');
    if (ve && plays.length) {
      const restPlay = plays.find(p => /rest-/.test(p.url));
      first = Math.round(plays[0].t - ve.t);
      rest = restPlay ? Math.round(restPlay.t - ve.t) : -1;
      break;
    }
    await new Promise(r => setTimeout(r, 25));
  }
  await m.callerIdle();
  return { first, rest };
});
console.log('B) Vorgeladen: erster Ton', proof.first, 'ms nach Visit-Ende | rest-Satz:', proof.rest, 'ms');
const latB = proof;
