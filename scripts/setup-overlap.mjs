import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 360, height: 752 } })).newPage();
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const d = await page.evaluate(() => {
  const els = [...document.querySelectorAll('.view .chip, .view .btn, .view input, .view .panel, .view h2, .view .panel > div')];
  const rects = els.map((e, i) => { const r = e.getBoundingClientRect(); return { i, tag: (e.className || e.tagName).toString().split(' ')[0].slice(0, 14), txt: (e.textContent || e.value || '').trim().slice(0, 8), x: r.x, y: r.y, w: r.width, h: r.height }; });
  const ovl = [];
  for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
    const A = rects[a], B = rects[b];
    const inParent = (A.x <= B.x && A.y <= B.y && A.x + A.w >= B.x + B.w && A.y + A.h >= B.y + B.h) || (B.x <= A.x && B.y <= A.y && B.x + B.w >= A.x + A.w && B.y + B.h >= A.y + A.h);
    if (inParent) continue; // Eltern-Kind ok
    const ix = Math.max(0, Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x));
    const iy = Math.max(0, Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y));
    if (ix > 4 && iy > 4) ovl.push(`${A.tag}"${A.txt}" x ${B.tag}"${B.txt}" = ${Math.round(ix)}x${Math.round(iy)}px`);
  }
  return { count: els.length, overlaps: ovl.slice(0, 10), keine: ovl.length === 0, docH: document.documentElement.scrollHeight };
});
console.log(JSON.stringify(d, null, 1));
await browser.close();
