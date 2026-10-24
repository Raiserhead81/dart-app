import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
await page.getByRole('button', { name: 'TRIPLE' }).click();
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForTimeout(300);
const r1 = await page.evaluate(() => ({
  pill: document.querySelector('.dartpill:not(.empty)')?.textContent,
  mode: document.querySelector('.padmode.on')?.textContent
}));
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForTimeout(300);
const r2 = await page.evaluate(() => ({
  pills: [...document.querySelectorAll('.dartpill')].map(p => p.textContent),
  mode: document.querySelector('.padmode.on')?.textContent
}));
console.log('nach T20:', JSON.stringify(r1), '| naechster Wurf:', JSON.stringify(r2));
await browser.close();
