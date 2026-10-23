// STUMMER E2E (Playwright, headless, --mute-audio): Best-of-3-Sets-Spiel (First to 1),
// 2 Legs per State-Injection + Doppel-20-Tap -> SET-Event -> MATCH -> Result ->
// "Statistik ansehen" -> Match-Karte sichtbar. Beweist Kays Sets-Feature + nahtlose Statistik.
// Run: node scripts/e2e-sets.mjs [BASE]
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext()).newPage();

await page.goto(BASE + '/#/play', { waitUntil: 'domcontentloaded' });
const version = (await page.request.get(BASE + '/VERSION').then(r => r.text())).trim();
console.log('VERSION:', version);

// --- Setup: Sets Best of 3 + First to 1 (Legs pro Set) ---
await page.fill('input[data-pi]', 'Kay');
await page.getByRole('button', { name: 'Best of 3 Sets' }).click();
await page.getByRole('button', { name: 'First to 1' }).click();
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
console.log('Spiel gestartet (Best of 3 Sets, First to 1)');
const glabel = await page.textContent('.glabel');
console.log('gtop:', glabel.trim());
if (!/Best of 3 Sets/.test(glabel)) { console.log('FEHLER: Sets nicht im gtop'); process.exit(1); }
const setChipsOnCard = await page.locator('.legbox.set').count();
console.log('Set-Chips an Spielerkarte:', setChipsOnCard);

// --- Leg 1: remaining injizieren, Doppel-20 tappen -> SET-Event ---
await page.evaluate(() => { window.__DARTPRO.state.session.state.leg.remaining[0] = 40; });
await page.getByRole('button', { name: 'DOUBLE', exact: true }).click();
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForFunction(() => !!document.querySelector('.bigevent'), null, { timeout: 8000 });
const bigText = await page.textContent('.bigevent');
console.log('Big-Event:', bigText.trim().slice(0, 40));
if (!/SET/i.test(bigText)) { console.log('FEHLER: kein SET-Animation'); process.exit(1); }
await page.waitForFunction(() => !document.querySelector('.bigevent'), null, { timeout: 9000 });

// --- Leg 2: wieder finishen -> MATCH ---
await page.waitForSelector('.padkey', { timeout: 10000 });
await page.evaluate(() => { window.__DARTPRO.state.session.state.leg.remaining[0] = 40; });
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForSelector('text=Statistik ansehen', { timeout: 15000 });
console.log('Match beendet, Result-Screen da');

// --- Result -> Statistik ansehen (primärer Button) ---
await page.getByRole('button', { name: /Statistik ansehen/ }).click();
await page.waitForSelector('#lastmatch', { timeout: 10000 });
const lm = await page.textContent('#lastmatch');
console.log('Match-Karte:', lm.replace(/\s+/g, ' ').trim().slice(0, 90));

// --- Caller-Beweis: ph-set + ph-leg wurden KOMPLETT gespielt (Applaus abwarten) ---
await page.waitForTimeout(16000);
const proof = await page.evaluate(() => import('/js/caller-voice.js').then(m => {
  const log = m.callerDebugLog();
  return {
    plays: log.filter(e => e.ev === 'play').map(e => e.url),
    ends: log.filter(e => e.ev === 'ended').map(e => `${e.url}@${e.ms}ms`),
    all: log.map(e => e.ev),
  };
}));
console.log('Caller plays:', proof.plays.join('  '));
console.log('Caller ended:', proof.ends.join('  '));
console.log('ALLE Events:', proof.all.join(','));

let ok = true;
if (!proof.plays.includes('ph-set.mp3')) { ok = false; console.log('FEHLER: ph-set nicht angesagt'); }
if (!proof.plays.some(u => /^ph-leg-\d-\d\.mp3$/.test(u))) { ok = false; console.log('FEHLER: Legstand-Call fehlt'); }
if (!proof.ends.some(e => e.startsWith('ph-set.mp3@'))) { ok = false; console.log('FEHLER: ph-set nicht komplett'); }

console.log(ok ? 'SETS-E2E OK: SET-Animation + Ansage + Match-Karte in Statistik' : 'SETS-E2E FEHLGESCHLAGEN');
await browser.close();
process.exit(ok ? 0 : 1);
