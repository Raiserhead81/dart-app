import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const vp of [{ width: 390, height: 700 }, { width: 820, height: 1180 }, { width: 1280, height: 800 }]) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[data-pi]', 'Kay');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await page.waitForSelector('.padkey', { timeout: 10000 });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const g = document.querySelector('.view-game');
    const scale = (g.style.transform.match(/[\d.]+/) || [1])[0];
    const railH = document.querySelector('.rail')?.offsetHeight || 0;
    const fits = g.getBoundingClientRect().bottom <= window.innerHeight - (getComputedStyle(document.querySelector('.rail')).position !== 'sticky' ? 0 : 0) + 2;
    const noScroll = document.documentElement.scrollHeight <= window.innerHeight + 2;
    return { scale: +scale, noScroll, bottom: Math.round(g.getBoundingClientRect().bottom), ih: window.innerHeight, railH };
  });
  console.log(`${vp.width}x${vp.height}: scale=${r.scale} noScroll=${r.noScroll} bottom=${r.bottom}/${r.ih} rail=${r.railH}`);
  await ctx.close();
}
await browser.close();
