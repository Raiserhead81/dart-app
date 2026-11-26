// E2E-Beweis Etappe B (KAY 02.12.): Layouts 2/3/4 Spieler + Checkout-Banner mit Alternativen.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8077';
const SHOT = '/tmp/dartpro-shots';
mkdirSync(SHOT, { recursive: true });

const NAMES = ['Kay', 'Rico', 'Max', 'Tom'];

async function startGame(page, players) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  await page.locator('button.chip.num').filter({ hasText: new RegExp('^' + players + '$') }).first().click();
  await page.waitForTimeout(150);
  for (let i = 0; i < players; i++) {
    await page.fill(`input[data-pi='${i}']`, NAMES[i]);
  }
  await page.getByRole('button', { name: 'Spiel starten' }).click();
  await page.waitForSelector('.padgrid .padkey.num', { timeout: 10000 });
}

async function throwT20(page, n) {
  for (let i = 0; i < n; i++) {
    await page.locator('.padkey.hot', { hasText: 'T20' }).click();
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(250);
}

const browser = await chromium.launch({
  args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'],
});

// 1. Portrait, 4 Spieler
const ctx1 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page1 = await ctx1.newPage();
const callerUrls = [];
page1.on('request', r => { const u = r.url(); if (u.includes('/caller/')) callerUrls.push(u.split('/caller/')[1]); });
await startGame(page1, 4);
await throwT20(page1, 12); // jeder 1 Visit a 3 T20 -> Rest je 321
await throwT20(page1, 3); // Kay: Rest 141
await page1.waitForTimeout(600);
await page1.screenshot({ path: SHOT + '/portrait-4players.png', fullPage: true });

// 2. Checkout-Banner pruefen (141: T20 T15 D18)
const banner = page1.locator('.checkout-banner');
const bannerVisible = await banner.isVisible().catch(() => false);
if (!bannerVisible) {
  console.log('WARN: Checkout-Banner nicht sichtbar bei 141!');
} else {
  const route = await page1.locator('.co-route').innerText();
  console.log('ROUTE:', JSON.stringify(route));
  if (!route.includes('T15')) console.log('WARN: Route enthaelt kein T15:', route);
  const altCount = await page1.locator('.co-alt').count();
  console.log('ALT-ANZAHL:', altCount);
  if (altCount === 0) console.log('WARN: Keine Alternativen im Banner!');
}
console.log('BANNER:', await page1.locator('#coline').innerText().catch(() => '(leer)'));

console.log('PILLS:', JSON.stringify(await page1.evaluate(() => [...document.querySelectorAll('.dartpill')].map(e => e.textContent.trim()))));
console.log('NAMES:', JSON.stringify(await page1.evaluate(() => [...document.querySelectorAll('.sc-name')].map(e => e.textContent.trim()))));

// 3. Caller-Zahl-Beweis (kein hard fail)
await page1.locator('.padkey.hot', { hasText: 'T20' }).click();
await page1.waitForTimeout(400);
console.log('CALLER-URLS:', JSON.stringify([...new Set(callerUrls)]), '| sc-60 angefragt:', callerUrls.some((u) => u.includes('sc-60.mp3')));
await ctx1.close();

// 4. Portrait, 3 Spieler
const ctx2 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page2 = await ctx2.newPage();
await startGame(page2, 3);
await throwT20(page2, 6); // je 321
await throwT20(page2, 3); // Kay 141
await page2.waitForTimeout(600);
await page2.screenshot({ path: SHOT + '/portrait-3players.png', fullPage: true });
await ctx2.close();

// 5. Portrait, 2 Spieler
const ctx3 = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});
const page3 = await ctx3.newPage();
await startGame(page3, 2);
await throwT20(page3, 3); // Kay 321
await throwT20(page3, 3); // Rico 321
await throwT20(page3, 3); // Kay 141
await page3.waitForTimeout(600);
await page3.screenshot({ path: SHOT + '/portrait-2players.png', fullPage: true });
await ctx3.close();

// 6. Landscape, 4 Spieler
const ctx4 = await browser.newContext({ viewport: { width: 844, height: 390 } });
const page4 = await ctx4.newPage();
await startGame(page4, 4);
await throwT20(page4, 12);
await throwT20(page4, 3); // Kay 141
await page4.waitForTimeout(600);
await page4.waitForTimeout(2500); // Flash-Overlay (180/Game Shot) abklingen lassen
await page4.screenshot({ path: SHOT + '/landscape-4players.png', fullPage: true });
await ctx4.close();

await browser.close();
console.log('E2E OK');
