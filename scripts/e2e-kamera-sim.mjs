import { chromium } from 'playwright';
// VOLL-SIMULATION: kuenstliche Kamera (Board-Video) -> echte App -> Kalibrierung -> Taps -> Zaehlung
const browser = await chromium.launch({ channel: 'chrome', args: [
  '--mute-audio',
  '--use-fake-device-for-fake-video-capture=/tmp/board-cam.y4m',
  '--use-fake-ui-for-media-stream',
  '--autoplay-policy=no-user-gesture-required'
]});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 120)));
await page.goto('https://dart.gemivo.de/#/camera', { waitUntil: 'domcontentloaded' });
await page.evaluate(async () => { const c = await caches.keys(); await Promise.all(c.map(k => caches.delete(k))); });
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
// Kamera starten (Fake-Feed laeuft)
await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => /kamera starten/i.test(b.textContent))?.click(); });
await page.waitForTimeout(2500);
const v = page.locator('video');
console.log('1) Fake-Kamera liefert:', await page.evaluate(() => { const vv = document.querySelector('video'); return vv?.videoWidth + 'x' + vv?.videoHeight; }));

// 2) AUTO-KALIBRIERUNG auf dem Fake-Stream
// ZUERST: den Frame sehen, den die Kalibrierung bekommt
await page.evaluate(async () => {
  const vv = document.querySelector('video');
  const c = document.createElement('canvas');
  c.width = 270; c.height = Math.round(270 * vv.videoHeight / vv.videoWidth);
  c.getContext('2d').drawImage(vv, 0, 0, c.width, c.height);
  window.__simFrame = c.toDataURL('image/jpeg', 0.8);
});
const frameData = await page.evaluate(() => window.__simFrame);
const { writeFileSync } = await import('fs');
writeFileSync('/tmp/sim-frame.jpg', Buffer.from(frameData.split(',')[1], 'base64'));
console.log('0) Sim-Frame gespeichert');
const kalib = await page.evaluate(async () => {
  const m = await import('/js/views/camera.js?v=' + Date.now());
  const vv = document.querySelector('video');
  const erg = await m.autoKalibriere(vv);
  if (erg) { m.setCal(erg); m.saveCal(); }
  return erg ? { cx: Math.round(erg.cx), cy: Math.round(erg.cy), r: Math.round(erg.r), rot: Math.round(erg.rot) } : 'NICHT GEFUNDEN';
});
console.log('2) Auto-Kalibrierung im Fake-Video:', JSON.stringify(kalib));
// Erwartung: cx~320, cy~240, r~150, rot~0 (y4m skaliert evtl. auf andere Groesse - pruefen!)

// 3) TAP auf T20 im Fake-Bild (Video 640x480 im Element contain):
const box = await v.boundingBox();
if (box && kalib && kalib.cx) {
  const vw = 640, vh = 480;
  const sc = Math.min(box.width / vw, box.height / vh);
  const offX = (box.width - vw * sc) / 2, offY = (box.height - vh * sc) / 2;
  // T20-Punkt im Video: (320, 240-0.58*150=153)
  const tapX = box.x + offX + 320 * sc, tapY = box.y + offY + 153 * sc;
  await page.mouse.click(tapX, tapY);
  await page.waitForTimeout(700);
  // Der Tap sollte im Kamera-Assistent-Test NICHT zaehlen (kein Spiel) - wir pruefen segVonPixel direkt:
  const seg = await page.evaluate(async ([x, y]) => {
    const m = await import('/js/views/camera.js?v=' + Date.now());
    const c = m.camCalRef();
    const core = await import('/js/core/camera-engine.js?v=' + Date.now());
    core.setEngineCal(c);
    return core.segVonPixel(x, y);
  }, [320, 153]);
  console.log('3) Tap auf T20-Stelle => Feld:', seg?.label, '(erwartet T20)');
}
console.log('JS-FEHLER:', errs.length ? errs : 'keine');
await browser.close();
