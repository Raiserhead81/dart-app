// STUMMER Live-Smoke für den Caller (Playwright, headless, --mute-audio, kein afplay/say).
// Beweis für Kays Ton-Bug-Fix: Visit mit Rest > 170 fragt rest-<x>.mp3 an und ruft
// speechSynthesis NULLMAL.
// Run:  node scripts/smoke-caller.mjs [BASE]          (SET/REST via Env)
//       SET=gemma REST=481 node scripts/smoke-caller.mjs
import { chromium } from 'playwright';

const BASE = process.argv[2] || process.env.BASE || 'https://dart.gemivo.de';
const REST = parseInt(process.env.REST || '361', 10);
const SET = process.env.SET || 'elevenlabs-brian';

// chrome-Kanal: nutzt installiertes Google Chrome (kein Browser-Download noetig)
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const ctx = await browser.newContext();
await ctx.addInitScript(() => {
  window.__ttsCalls = 0;
  window.__ttsTexts = [];
  if (window.speechSynthesis) {
    const orig = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = (u) => { window.__ttsCalls++; window.__ttsTexts.push(u && u.text); return orig(u); };
  }
});
const page = await ctx.newPage();
const clipRequests = [];
const clip404 = [];
page.on('request', r => { if (r.url().includes('/caller/')) clipRequests.push(r.url()); });
page.on('response', r => { if (r.url().includes('/caller/') && r.status() >= 400) clip404.push(`${r.url()} -> ${r.status()}`); });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
const version = (await page.request.get(BASE + '/VERSION').then(r => r.text())).trim();
console.log('VERSION:', version);

const res = await page.evaluate(async ({ rest, set }) => {
  const m = await import('/js/caller-voice.js');
  m.configureCaller({ enabled: true, voiceSet: set, lang: 'en', checkout: true, dartCalls: true });
  m.callVisitEnd(rest, { labels: ['t20', 't20', 's20'] });
  await Promise.race([m.callerIdle(), new Promise(r => setTimeout(r, 55000))]);
  await new Promise(r => setTimeout(r, 800));
  return { ttsCalls: window.__ttsCalls, ttsTexts: window.__ttsTexts };
}, { rest: REST, set: SET });

console.log('Set:', SET, '| speechSynthesis-Aufrufe:', res.ttsCalls, res.ttsTexts);
console.log('Caller-Requests:');
for (const u of clipRequests) console.log('  ', u.replace(BASE, ''));
console.log('Caller-Fehler (>=400):', clip404.length ? clip404 : 'keine');

const want = [
  `/caller/${SET}/en/seg-t20.mp3`,
  `/caller/${SET}/en/rest-${REST}.mp3`
];
const got = clipRequests.map(u => new URL(u).pathname);
const missing = want.filter(w => !got.includes(w));
const ok = missing.length === 0 && res.ttsCalls === 0 && clip404.length === 0;
console.log(ok
  ? `SMOKE OK: ${SET} rest-${REST} angefragt, 0 speechSynthesis, keine Clip-Fehler`
  : `SMOKE FEHLGESCHLAGEN: fehlend=${JSON.stringify(missing)} ttsCalls=${res.ttsCalls} fehler=${JSON.stringify(clip404)}`);
await browser.close();
process.exit(ok ? 0 : 1);
