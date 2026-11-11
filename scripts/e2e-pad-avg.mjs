// E2E-Beweis Etappe A: Pad-Reihenfolge aufsteigend (1 oben links) + 2 Averages in Spielerkarte.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padgrid .padkey.num', { timeout: 10000 });
const nums = await page.locator('.padgrid .padkey.num').allTextContents();
const first4 = nums.slice(0, 4).map(Number);
console.log('PAD ERSTE 4:', JSON.stringify(first4), '| letzte:', nums[nums.length - 1]);
if (first4[0] !== 1) throw new Error('Pad: oben links ist nicht 1!');
// 3 Darts T20 werfen (SINGLE-Reset: T20-Hotkey 3x)
for (let i = 0; i < 3; i++) {
  await page.locator('.padkey.hot', { hasText: 'T20' }).click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(400);
const meta = await page.locator('.scorecard').first().locator('.sc-meta').innerText();
console.log('KARTE META:', JSON.stringify(meta));
if (!/LEG Ø\s*180/i.test(meta)) throw new Error('Leg-Average fehlt/falsch: ' + meta);
if (!/MATCH Ø\s*180/i.test(meta)) throw new Error('Match-Average fehlt/falsch: ' + meta);
console.log('BEWEIS OK: Pad 1-oben-links + LegØ/MatchØ sichtbar');
await browser.close();
