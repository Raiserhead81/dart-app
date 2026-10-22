// Screenshots aller Haupt-Screens, Desktop + Mobile.
// Usage: node scripts/screenshots.mjs <base-url> <out-dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] || 'http://127.0.0.1:8077';
const OUT = process.argv[3] || '/tmp/shots';
mkdirSync(OUT, { recursive: true });

const screens = [
  ['play-setup', '#/play'],
  ['training', '#/training'],
  ['stats', '#/stats'],
  ['online', '#/online'],
  ['profile', '#/profile']
];

const b = await chromium.launch({ channel: 'chrome' });
const errs = [];

for (const [tag, w, h] of [['desktop', 1280, 900], ['mobile', 390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', e => errs.push(tag + ': ' + e.message));
  for (const [name, hash] of screens) {
    await p.goto(BASE + '/' + hash, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${tag}-${name}.png` });
  }
  // Spielbildschirm mit laufendem Spiel (3 Wuerfe), Desktop + Mobile
  await p.goto(BASE + '/#/play', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const hasSetup = await p.$('input[data-pi="0"]');
  if (hasSetup) {
    await p.fill('input[data-pi="0"]', 'Kay');
    const ft1 = await p.$('text=First to 1');
    if (ft1) await p.click('text=First to 1');
    await p.click('text=Spiel starten');
    await p.waitForSelector('.dartboard');
    await p.click('div.modebar >> text=Zahlen').catch(() => {});
    for (const s of ['T20', 'T20', 'T5']) {
      await p.fill('input[placeholder*="Summe"]', s);
      const btn = await p.$('text=Wurf eintragen');
      if (btn) await p.click('text=Wurf eintragen');
      await p.waitForTimeout(120);
    }
    await p.waitForTimeout(600);
  }
  await p.screenshot({ path: `${OUT}/${tag}-game.png`, fullPage: false });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  console.log(`${tag} overflow: ${overflow}`);
  await p.close();
}
console.log('ERRORS:', errs.length ? errs.join(' | ') : 'none');
console.log('OUT:', OUT);
await b.close();
