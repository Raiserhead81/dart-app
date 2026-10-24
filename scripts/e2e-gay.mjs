import { chromium } from 'playwright';
const BASE = process.env.BASE || 'https://dart.gemivo.de';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian', lang: 'en', checkout: true, dartCalls: true, applause: false });
});
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
await page.getByRole('button', { name: 'SINGLE' }).click().catch(() => {});
for (const n of [1, 5, 20]) {
  await page.locator('.padkey.num', { hasText: new RegExp('^' + n + '$') }).first().click();
  await page.waitForTimeout(200);
}
await page.waitForTimeout(3000);
const log = await page.evaluate(() => import('/js/caller-voice.js').then(m => m.callerDebugLog()));
const visitend = log.filter(e => e.ev === 'visitend').map(e => e.ids);
const plays = log.filter(e => e.ev === 'play').map(e => e.url);
console.log('VISITEND:', JSON.stringify(visitend));
console.log('PLAYS:', JSON.stringify(plays)); console.log('VOLL:', JSON.stringify(log.filter(e => ['play','ended','missing','tts','tts-fallback','enqueue','visitend'].includes(e.ev)), null, 1));
await browser.close();
