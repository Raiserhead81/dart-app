import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 360, height: 752 } })).newPage();
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  // Testspieler + Spiele anlegen, damit die Stats was zeigt (Kays Fall)
  const st = { version: 1, players: [{ player: 'Kay', games: [] }], settings: {}, statsPlayer: 'Kay' };
  const today = Date.now();
  for (let g = 0; g < 6; g++) {
    st.players[0].games.push({ date: today - g * 86400000 * 4, start: 501, avg: 52.3 + g * 1.7, best: 140 + (g % 3) * 20, hundreds: 2 + (g % 4), darts: 60 + g * 5 });
  }
  localStorage.setItem('dartpro.v1', JSON.stringify(st));
});
await page.goto('https://dart.gemivo.de/#/stats', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const d = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.hero-num, .heromini .v, .hero-sub, .heromini .l, .stathero-name, .kpi .value')) {
    const r = el.getBoundingClientRect();
    const ueberlauf = el.scrollWidth > el.clientWidth + 1;
    const parent = el.closest('.hero-kpi, .heromini, .stathero, .kpi');
    const pr = parent ? parent.getBoundingClientRect() : r;
    const raushaengen = r.right > pr.right + 2 || r.left < pr.left - 2;
    if (ueberlauf || raushaengen) out.push({ txt: (el.textContent || '').trim().slice(0, 12), elW: el.clientWidth, scrollW: el.scrollWidth, kachel: Math.round(pr.width) });
  }
  const kpis = [...document.querySelectorAll('.hero-kpi')].map(k => { const r = k.getBoundingClientRect(); const num = k.querySelector('.hero-num'); return { label: k.querySelector('.hero-sub')?.textContent, wert: num?.textContent, kachelW: Math.round(r.width), zahlW: num ? Math.round(num.getBoundingClientRect().width) : 0, font: num ? getComputedStyle(num).fontSize : '' }; });
  return { probleme: out.slice(0, 8), kpis };
});
console.log(JSON.stringify(d, null, 1));
await browser.close();
