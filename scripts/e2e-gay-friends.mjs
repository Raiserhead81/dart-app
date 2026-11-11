// E2E: T20 + 5 + 1 im Visit => ph-gay-friends-Clip statt Summe
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext()).newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian', lang: 'en', checkout: true, dartCalls: true, applause: false });
});
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
await page.locator('.padkey.hot', { hasText: 'T20' }).click();
await page.waitForTimeout(150);
for (const n of [5, 1]) {
  await page.locator('.padkey.num', { hasText: new RegExp('^' + n + '$') }).first().click();
  await page.waitForTimeout(150);
}
await page.waitForTimeout(2500);
const log = await page.evaluate(() => import('/js/caller-voice.js').then(m => m.callerDebugLog()));
const visitend = log.filter(e => e.ev === 'visitend').map(e => e.ids);
console.log('VISITEND:', JSON.stringify(visitend));
if (!visitend.some(ids => ids.includes('ph-gay-friends'))) throw new Error('ph-gay-friends fehlt!');
if (visitend.some(ids => ids.includes('sc-66'))) throw new Error('sc-66 darf nicht kommen!');
const plays = log.filter(e => e.ev === 'play' && String(e.url).includes('ph-gay-friends'));
console.log('PLAY:', JSON.stringify(plays));
await browser.close();
console.log('BEWEIS OK: T20+5+1 => GAAAY WITH FRIENDS');
