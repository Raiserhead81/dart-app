import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const [name, vp] of [['iphone14', { width: 390, height: 844 }], ['se', { width: 375, height: 667 }], ['ipad', { width: 820, height: 1180, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[data-pi]', 'Kay');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await page.waitForSelector('.padkey', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `/tmp/shot-${name}.png` });
  const r = await page.evaluate(() => {
    const g = document.querySelector('.view-game');
    const grid = document.querySelector('.padgrid');
    return {
      scale: (g.style.transform.match(/[\d.]+/) || [1])[0],
      gridBottom: Math.round(grid.getBoundingClientRect().bottom),
      special: Math.round(document.querySelector('.padspecial').getBoundingClientRect().bottom),
      ih: window.innerHeight,
      docH: document.documentElement.scrollHeight,
      gridCut: document.querySelector('.padspecial').getBoundingClientRect().bottom > window.innerHeight
    };
  });
  console.log(name, JSON.stringify(r));
  await ctx.close();
}
await browser.close();
