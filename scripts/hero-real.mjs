import { chromium } from 'playwright';
import { readFileSync } from 'fs';
const store = readFileSync('/tmp/kay-store.json', 'utf8');
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 360, height: 752 } })).newPage();
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.evaluate(s => localStorage.setItem('dartpro.v1', s), store);
await page.goto('https://dart.gemivo.de/#/stats', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const d = await page.evaluate(() => {
  const probs = [];
  for (const el of document.querySelectorAll('.hero-num, .heromini .v, .hero-sub, .stathero-name, .reckpi .v')) {
    const r = el.getBoundingClientRect();
    const parent = el.closest('.hero-kpi, .heromini, .stathero, .reckpi');
    const pr = parent ? parent.getBoundingClientRect() : r;
    if (el.scrollWidth > el.clientWidth + 1 || r.right > pr.right + 2 || r.left < pr.left - 2) probs.push({ txt: (el.textContent || '').trim().slice(0, 10), elW: el.clientWidth, scW: el.scrollWidth, kachel: Math.round(pr.width) });
  }
  const kpis = [...document.querySelectorAll('.hero-kpi')].map(k => ({ l: k.querySelector('.hero-sub')?.textContent?.slice(0, 12), v: k.querySelector('.hero-num')?.textContent, font: getComputedStyle(k.querySelector('.hero-num') || k).fontSize, kw: Math.round(k.getBoundingClientRect().width) }));
  return { probs: probs.slice(0, 8), kpis };
});
console.log('TEXT:', page.evaluate(() => document.body.innerText.replace(/\n+/g,' | ').slice(0, 250)));
console.log(JSON.stringify(d, null, 1));
await page.screenshot({ path: '/tmp/stats-real.png' });
await browser.close();
