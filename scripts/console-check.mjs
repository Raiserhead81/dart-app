import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 360, height: 792 } })).newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + String(e).slice(0, 150)));
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForTimeout(2500);
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForTimeout(600);
const state = await page.evaluate(() => {
  const g = document.querySelector('.view-game');
  return {
    spiel: !!document.querySelector('.padkey'),
    pills: [...document.querySelectorAll('.dartpill')].map(p => p.textContent),
    rest: document.querySelector('.sc-rest')?.textContent,
    scale: g?.style.transform || '1',
    bodyBg: getComputedStyle(document.body).backgroundColor
  };
});
console.log('FEHLER:', errors.length ? errors : 'keine');
console.log('STATE:', JSON.stringify(state));
await page.screenshot({ path: '/tmp/check-live.png' });
await browser.close();
