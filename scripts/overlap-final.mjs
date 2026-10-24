import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
for (const vp of [{ width: 360, height: 792 }, { width: 844, height: 390 }]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
  await page.fill('input[data-pi]', 'Kay');
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await page.waitForSelector('.padkey', { timeout: 10000 });
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.padkey, .dartpill, .padmode')];
    const rects = els.map(e => { const r = e.getBoundingClientRect(); return { tag: (e.className.split(' ')[0]) + ':' + (e.textContent.trim().slice(0, 4)), x: r.x, y: r.y, w: r.width, h: r.height }; });
    const o = [];
    for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
      const A = rects[a], B = rects[b];
      const ix = Math.max(0, Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x));
      const iy = Math.max(0, Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y));
      if (ix > 3 && iy > 3) o.push(A.tag + 'x' + B.tag);
    }
    const spec = document.querySelector('.padspecial');
    return { overlap: o.length ? o : 'KEINE', letzteReihe: Math.round(spec.getBoundingClientRect().bottom), vh: innerHeight, ok: spec.getBoundingClientRect().bottom <= innerHeight };
  });
  console.log(`${vp.width}x${vp.height}:`, JSON.stringify(r));
  await page.screenshot({ path: `/tmp/design-${vp.width}.png` });
  await ctx.close();
}
await browser.close();
