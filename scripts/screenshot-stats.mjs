// STUMMER Stats-Screenshot: injiziert 12 Wochen Demo-Games und macht Screens.
// Run: node scripts/screenshot-stats.mjs [BASE] [OUTDIR]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';
const OUT = process.argv[3] || (process.env.HOME + '/Pictures/dartpro-shots-v2/after');
mkdirSync(OUT, { recursive: true });

// 12 Wochen, steigende Form, letzte Woche Bestmarke
const games = [];
const now = new Date();
for (let w = 11; w >= 0; w--) {
  const avg = 52 + (11 - w) * 1.7 + (w === 0 ? 2.4 : 0); // letzte Woche: Rekord
  const n = 2 + (w % 2);
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() - w * 7 * 864e5 - i * 2 * 864e5);
    const pts = 501, darts = Math.round(pts * 3 / (avg + i * 0.6));
    games.push({
      kind: 'x01', date: d.toISOString(), label: '501',
      players: ['Kay'],
      results: [{
        player: 'Kay', darts, points: pts,
        first9: { points: 280 + i * 12, darts: 9 },
        checkouts: { hits: 3 + (i % 2), attempts: 6 },
        doubles: { hits: 9 + i, attempts: 14 },
        counts: { c100: 3 + i, c140: 1, c180: w % 3 === 0 ? 1 : 0 },
        legsWon: 2, legsPlayed: 3, bestVisit: 121, visits: 15
      }],
      boardThrows: Array.from({ length: 21 }, (_, k) => ({
        p: 'Kay', c: ['T20', 'T20', 'T19', 'T18', 'D20', 'D16', '20', '50', '25', 'T15', '5', 'MISS'][k % 12]
      }))
    });
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE + '/#/stats', { waitUntil: 'domcontentloaded' });
await page.evaluate(async (g) => {
  const s = window.__DARTPRO;
  s.state.games = g;
  s.state.statsPlayer = 'Kay';
  const app = await import('/js/app.js');
  app.rerender();
}, games);
await page.waitForSelector('.stathero', { timeout: 8000 });
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + '/stats-mobile-full.png', fullPage: true });
const hero = await page.$('.stathero');
if (hero) await hero.screenshot({ path: OUT + '/stats-hero.png' });
const heat = await page.$('.heat-dark');
if (heat) await heat.screenshot({ path: OUT + '/stats-trefferbild.png' });
const pb = await page.$('.pbcard');
if (pb) await pb.screenshot({ path: OUT + '/stats-bestmarke.png' });
console.log('Screens nach', OUT);
await browser.close();
