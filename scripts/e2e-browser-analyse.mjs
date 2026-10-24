import { readFileSync } from 'fs';
import { chromium } from 'playwright';
const boards = JSON.parse(readFileSync('/tmp/sim-boards.json', 'utf8'));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => { const c = await caches.keys(); await Promise.all(c.map(k => caches.delete(k))); });
const ergebnis = await page.evaluate(async (boards) => {
  const core = await import('/js/core/camera-engine.js?v=' + Date.now());
  const out = {};
  for (const [name, b64] of Object.entries(boards)) {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/jpeg;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const erg = core.analyseBoardInFrame(data);
    out[name] = erg ? { cx: Math.round(erg.cx), cy: Math.round(erg.cy), r: Math.round(erg.r), rot: Math.round(erg.rot) } : 'NICHT GEFUNDEN';
  }
  // Tap-Kette gleich mit: T20-Tap auf dem hellen Board simulieren
  const e = out.hell;
  if (e && e.cx) {
    core.setEngineCal({ cx: e.cx, cy: e.cy, r: e.r, rot: e.rot });
    const px = e.cx, py = e.cy - 0.58 * e.r;  // direkt ueberm Bull im Triple
    out.tapT20 = core.segVonPixel(px, py)?.label;
    out.tapBull = core.segVonPixel(e.cx, e.cy)?.label;
  }
  return out;
}, boards);
console.log('BROWSER-ANALYSE (echte App-Funktion, echte JPEGs):');
console.log(JSON.stringify(ergebnis, null, 1));
await browser.close();
