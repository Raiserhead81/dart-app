// Lokaler E2E-Smoke: App laden, X01 solo spielen (Board + Zahlen), Statistik pruefen.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8077';
const shots = process.env.SHOT_DIR || '/tmp/dartpro-shots';
import { mkdirSync } from 'node:fs';
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(BASE + '/', { waitUntil: 'networkidle' });

// 1) Setup: 101er, First to 1, Name Kay
await page.fill('input[data-pi="0"]', 'Kay');
await page.click('text=101');
await page.click('text=First to 1');
await page.click('text=Spiel starten');
await page.waitForSelector('.dartboard');

// 2) Board-Klick: Triple 20 (3. Pfad des ersten Sektors = T20)
await page.click('svg.dartboard path:nth-of-type(3)');
await page.waitForTimeout(150);

// 3) Zahlen-Modus: T20 schon geworfen (Rest 41) -> S9 -> D16 = Finish
await page.click('div.modebar >> text=Zahlen');
await page.fill('input[placeholder*="Summe"]', 'S9');
await page.click('text=Wurf eintragen');
await page.waitForTimeout(120);
await page.fill('input[placeholder*="Summe"]', 'D16');
await page.click('text=Wurf eintragen');
await page.waitForTimeout(300);

const body = await page.textContent('body');
const ok1 = /Game Shot|gewinnt/.test(body);
console.log('MATCH_END:', ok1);
await page.screenshot({ path: shots + '/01-result.png', fullPage: false });

// 4) Statistik
await page.click('text=Zur Statistik');
await page.waitForTimeout(400);
const statsBody = await page.textContent('body');
const ok2 = statsBody.includes('Kay') && statsBody.includes('Verlauf') && statsBody.includes('KW');
console.log('STATS_OK:', ok2);
const avgVisible = /101/.test(statsBody);
console.log('AVG_101:', avgVisible);
await page.screenshot({ path: shots + '/02-stats.png', fullPage: true });

// 5) Training-Ansicht
await page.click('.rail a[data-nav="training"]');
await page.waitForTimeout(250);
await page.screenshot({ path: shots + '/03-training.png' });

// 6) Mobile-Viewport
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
mob.on('pageerror', e => errors.push('mobile pageerror: ' + e.message));
await mob.goto(BASE + '/#/stats', { waitUntil: 'networkidle' });
await mob.waitForTimeout(400);
const hscroll = await mob.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
console.log('MOBILE_H_OVERFLOW:', hscroll);
await mob.screenshot({ path: shots + '/04-mobile-stats.png', fullPage: false });
await mob.goto(BASE + '/#/play', { waitUntil: 'networkidle' });
await mob.waitForTimeout(300);
await mob.screenshot({ path: shots + '/05-mobile-play.png' });

console.log('ERRORS:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
process.exit(errors.length ? 1 : 0);
