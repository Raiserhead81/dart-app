// Sichtpruefung Etappe B: Stats-Vergleichsblock mit 2 Spielern (Screenshot).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const mk = (id, date, aWon) => ({
  id, kind: 'x01', mode: 'x01', label: '501 Double Out', date,
  players: ['Kay', 'Chris'],
  results: [
    { player: 'Kay', won: aWon, legsWon: aWon ? 2 : 1, legsPlayed: 3, points: aWon ? 1002 : 900, darts: 60, avg3: aWon ? 50.1 : 45, first9: { points: 130, darts: 9 }, doubles: { hits: 2, attempts: 8, pct: 25 }, checkouts: { hits: 2, attempts: 5, pct: 40 }, counts: { c100: 3, c140: 1, c180: 1 } },
    { player: 'Chris', won: !aWon, legsWon: aWon ? 1 : 2, legsPlayed: 3, points: aWon ? 900 : 1002, darts: 60, avg3: aWon ? 45 : 50.1, first9: { points: 120, darts: 9 }, doubles: { hits: 1, attempts: 6, pct: 16.7 }, checkouts: { hits: 1, attempts: 4, pct: 25 }, counts: { c100: 2, c140: 0, c180: 0 } }
  ], boardThrows: []
});
await page.addInitScript((games) => {
  localStorage.setItem('dartpro.v1', JSON.stringify({ schema: 1, profiles: [{ name: 'Kay' }], activeProfile: 'Kay', games, settings: {}, auth: null }));
}, [mk('t1', '2026-11-10T20:00:00Z', true), mk('t2', '2026-11-11T20:00:00Z', false)]);
await page.goto(BASE + '/#/stats', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#compare', { timeout: 8000 });
const box = await page.locator('#compare').boundingBox();
await page.evaluate(() => window.scrollTo(0, 0));
await page.setViewportSize({ width: 390, height: Math.min(1600, Math.round(box.y + box.height + 20)) });
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/dart-cmp.png', fullPage: false });
const txt = await page.locator('#compare').innerText();
console.log('COMPARE-TEXT:', JSON.stringify(txt));
console.log('TXT:', txt.slice(0,120)); if (!/Gegeneinander/i.test(txt)) throw new Error('Vergleich fehlt: ' + txt.slice(0,80));
if (!/1\s*:\s*1/.test(txt)) throw new Error('H2H falsch: ' + txt.slice(0,120));
console.log('BEWEIS OK: Vergleichsblock mit H2H');
await browser.close();
