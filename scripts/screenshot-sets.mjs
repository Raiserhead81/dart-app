// STUMME Screens: Setup mit Sets-Optionen + Result + Statistik-nach-Spiel.
// Run: node scripts/screenshot-sets.mjs [BASE] [OUTDIR]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';
const OUT = process.argv[3] || (process.env.HOME + '/Pictures/dartpro-shots-v2/after');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
await page.goto(BASE + '/#/play', { waitUntil: 'domcontentloaded' });

// 1) Setup mit Sets-Chips
await page.getByRole('button', { name: 'Best of 3 Sets' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + '/setup-sets.png' });
console.log('setup-sets.png');

// 2) Spiel: Best of 3, First to 1 -> 2 Legs -> Match
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'First to 1' }).click();
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
await page.getByRole('button', { name: 'DOUBLE', exact: true }).click();

for (let leg = 0; leg < 2; leg++) {
  await page.evaluate(() => { window.__DARTPRO.state.session.state.leg.remaining[0] = 40; });
  await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
  if (leg === 0) {
    await page.waitForFunction(() => !!document.querySelector('.bigevent'), null, { timeout: 8000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: OUT + '/game-set-flash.png' });
    console.log('game-set-flash.png');
    await page.waitForFunction(() => !document.querySelector('.bigevent'), null, { timeout: 12000 });
    await page.waitForSelector('.padkey', { timeout: 10000 });
  }
}
await page.waitForSelector('text=Statistik ansehen', { timeout: 15000 });
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + '/result-screen.png' });
console.log('result-screen.png');

// 3) Statistik nach dem Spiel (Hero + Match-Karte)
await page.getByRole('button', { name: /Statistik ansehen/ }).click();
await page.waitForSelector('#lastmatch', { timeout: 10000 });
await page.waitForTimeout(900);
await page.screenshot({ path: OUT + '/stats-after-match.png' });
const hero = await page.$('.stathero');
if (hero) await hero.screenshot({ path: OUT + '/stats-after-match-hero.png' });
const lm = await page.$('#lastmatch');
if (lm) await lm.screenshot({ path: OUT + '/stats-after-match-card.png' });
console.log('stats-after-match*.png');

// 4) Persistenz: 'Neues Spiel' -> Kombi vorausgewaehlt (Best of 3, First to 1, 'Legs pro Satz')
await page.evaluate(() => { location.hash = '#/play'; });
await page.waitForSelector('.chip', { timeout: 10000 });
await page.waitForTimeout(500);
const chipsOn = await page.locator('.chip.on').evaluateAll(els => els.map(e => e.textContent).join('|'));
console.log('Persistenz-Chips:', chipsOn);
await page.screenshot({ path: OUT + '/setup-persisted.png' });
console.log('setup-persisted.png');
await browser.close();
