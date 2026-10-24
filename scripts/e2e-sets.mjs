// STUMMER E2E (Playwright, headless, --mute-audio): Best-of-3-Sets-Spiel (First to 1),
// 2 Legs per State-Injection + Doppel-20-Tap -> SET-Event -> MATCH -> Result ->
// "Statistik ansehen" -> Match-Karte sichtbar. Beweist Kays Sets-Feature + nahtlose Statistik.
// Run: node scripts/e2e-sets.mjs [BASE]
import { chromium } from 'playwright';

import { mkdirSync } from 'node:fs';
const OUT = process.env.OUT || (process.env.HOME + '/Pictures/dartpro-shots-v2/after');
mkdirSync(OUT, { recursive: true });
const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';

const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext();
// Fullscreen-Stub (Playwright kann echtes FS nicht): zaehlt requestFullscreen-Aufrufe
await ctx.addInitScript(() => {
  window.__fsCalls = 0;
  Element.prototype.requestFullscreen = function () { window.__fsCalls++; return Promise.resolve(); };
});
const page = await ctx.newPage();

await page.goto(BASE + '/#/play', { waitUntil: 'domcontentloaded' });
const version = (await page.request.get(BASE + '/VERSION').then(r => r.text())).trim();
console.log('VERSION:', version);

// --- Stim-Migration: unvollstaendiges Set (complete:false) -> automatisch brian ---
const mig = await page.evaluate(async () => {
  const m = await import('/js/caller-voice.js');
  await m.loadCallerManifest();
  m.configureCaller({ voiceSet: 'gemma' }); // simuliert Kays gespeicherten Fehlerstand
  await m.loadCallerManifest();
  return {
    after: m.callerSettings().voiceSet,
    gemmaComplete: m.isVoiceSetComplete('gemma'),
    brianComplete: m.isVoiceSetComplete('elevenlabs-brian')
  };
});
console.log('MIGRATION:', JSON.stringify(mig));
if (mig.gemmaComplete !== false || mig.brianComplete !== true || mig.after !== 'elevenlabs-brian') {
  console.log('FEHLER: Stim-Migration greift nicht');
  process.exit(1);
}

// --- Setup: Sets Best of 3 + First to 1 (Legs pro Set) ---
await page.fill('input[data-pi]', 'Kay');
const BEST_OF = process.env.BEST_OF || '3';
await page.getByRole('button', { name: `Best of ${BEST_OF} Sets` }).click();
await page.getByRole('button', { name: 'First to 1' }).click();
await page.getByRole('button', { name: 'Spiel starten' }).click();
await page.waitForSelector('.padkey', { timeout: 10000 });
console.log('Spiel gestartet (Best of 3 Sets, First to 1)');
const fsCalls = await page.evaluate(() => window.__fsCalls || 0);
console.log('requestFullscreen-Aufrufe nach Spielstart:', fsCalls);
if (fsCalls < 1) { console.log('FEHLER: kein Auto-Fullscreen beim Spielstart'); process.exit(1); }
const glabel = await page.textContent('.glabel');
console.log('gtop:', glabel.trim());
if (!new RegExp(`Best of ${BEST_OF} Sets`).test(glabel)) { console.log('FEHLER: Sets nicht im gtop'); process.exit(1); }
const setChipsOnCard = await page.locator('.legbox.set').count();
console.log('Set-Chips an Spielerkarte:', setChipsOnCard);

// --- Leg 1: remaining injizieren, Doppel-20 tappen -> SET-Event ---
// VORHER: 3 Single-20-Wuerfe fuer den PILL-Beweis (3. Zahl sichtbar bei t=0.1/0.7/1.4s)
await page.getByRole('button', { name: 'SINGLE', exact: true }).click();
const pillShots = [];
for (let d = 0; d < 3; d++) {
  await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
  await page.waitForTimeout(120);
}
for (const [i, ms] of [[0, 100], [1, 700], [2, 1400]]) {
  await page.waitForTimeout(i === 0 ? ms : ms - [0, 100, 700][i]);
  const vb = await page.textContent('#visitbar');
  const filled = (vb.match(/·/g) || []).length;
  const elShot = await page.$('#visitbar');
  if (elShot) await elShot.screenshot({ path: OUT + `/pills-t${ms}ms.png` }).catch(() => {});
  pillShots.push(`t${ms}ms: "${vb.trim().replace(/\s+/g, ' ')}" (leere Pills: ${filled})`);
}
console.log('PILL-Beweis (3 Dart-Pills muessen sichtbar sein):');
for (const l of pillShots) console.log('  ', l);
const allVisible = pillShots.every(l => !/leere Pills: 3/.test(l) && !/leere Pills: 2/.test(l));
if (!allVisible) { console.log('FEHLER: 3. Pill nicht durchgehend sichtbar'); process.exit(1); }
// Rest zuruecksetzen fuer den gefuehrten Set-Flow (Demo-Leg neu denken: wir spielen weiter bis 0)
await page.evaluate(() => { window.__DARTPRO.state.session.state.leg.remaining[0] = 40; });
await page.getByRole('button', { name: 'DOUBLE', exact: true }).click();
await page.locator('.padkey.num', { hasText: /^20$/ }).first().click();
await page.waitForFunction(() => !!document.querySelector('.bigevent'), null, { timeout: 8000 });
if (process.env.PHSET) {
  // Beweis "Set!-Ansage": warten bis die Ansage (ph-set + Legstand) fertig ist
  const proof = await page.evaluate(async () => {
    const m = await import('/js/caller-voice.js');
    const t0 = Date.now();
    let log = [];
    while (Date.now() - t0 < 25000) {
      log = m.callerDebugLog();
      const ended = log.filter(e => e.ev === 'ended').map(e => e.url);
      if (ended.includes('ph-set.mp3') && ended.some(u => /^ph-leg-\d-\d\.mp3$/.test(u))) break;
      await new Promise(r => setTimeout(r, 400));
    }
    return { plays: log.filter(e => e.ev === 'play').map(e => e.url), ends: log.filter(e => e.ev === 'ended').map(e => e.url) };
  });
  console.log('PHSET plays:', proof.plays.join('  '));
  const okSet = proof.plays.includes('ph-set.mp3') && proof.plays.some(u => /^ph-leg-\d-\d\.mp3$/.test(u));
  console.log('PHSET ended:', proof.ends.join('  '));
  console.log(okSet ? 'PHSET OK: Set!-Ansage + Legstand wurden abgespielt' : 'PHSET FEHLGESCHLAGEN');
  await browser.close();
  process.exit(okSet ? 0 : 1);
}
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
