import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [name, vp] of [['phone-land', { width: 844, height: 390 }], ['se-land', { width: 667, height: 375 }], ['ipad-land', { width: 1180, height: 820 }]]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[data-pi]', 'Kay');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await page.waitForSelector('.padkey', { timeout: 10000 });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const g = document.querySelector('.view-game');
    const sp = document.querySelector('.padspecial');
    return {
      scale: (g.style.transform.match(/[\d.]+/) || [1])[0],
      specialBottom: Math.round(sp.getBoundingClientRect().bottom),
      ih: window.innerHeight,
      cut: sp.getBoundingClientRect().bottom > window.innerHeight
    };
  });
  console.log(name, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
