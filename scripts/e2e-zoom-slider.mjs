// Repro: Zoom-Regler nach links -> verschwindet etwas? (Profil-Kamerastudio)
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8077';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } }); // Handy-Format
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

// getUserMedia-Mock: animiertes Canvas als "Kamera" (bunte Scheibe)
await page.addInitScript(() => {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  const draw = (t) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, 1280, 720);
    const cx = 640, cy = 360, R = 260;
    for (let s = 0; s < 20; s++) {
      const a0 = (s * 18 - 90) * Math.PI / 180, a1 = ((s + 1) * 18 - 90) * Math.PI / 180;
      x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a0, a1); x.closePath();
      x.fillStyle = s % 2 ? '#c1272d' : '#0e7a3c'; x.fill();
    }
    x.beginPath(); x.arc(cx, cy, R * 0.094, 0, 7); x.fillStyle = '#0e7a3c'; x.fill();
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.strokeStyle = '#222'; x.lineWidth = 14; x.stroke();
    x.beginPath(); x.arc(cx, cy, R * 1.2, 0, 7); x.strokeStyle = '#181614'; x.lineWidth = 60; x.stroke();
  };
  draw(0);
  const stream = c.captureStream(15);
  let f = 0;
  setInterval(() => draw(f++), 200);
  navigator.mediaDevices.getUserMedia = async () => {
    const s2 = c.captureStream(15);
    s2.getVideoTracks()[0].getSettings = () => ({ width: 1280, height: 720 });
    return s2;
  };
  navigator.mediaDevices.enumerateDevices = async () => [];
});

await page.goto(BASE + '/#/profile', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);

// Kamera anzeigen klicken
await page.click('text=Kamera anzeigen');
await page.waitForTimeout(1500);

const zustand = (label) => page.evaluate(() => {
  const host = document.querySelector('#profilkamera');
  const sliders = host ? host.querySelectorAll('input[type=range]') : [];
  const video = host ? host.querySelector('video') : null;
  const vs = video ? getComputedStyle(video) : null;
  const vr = video ? video.getBoundingClientRect() : null;
  const s0 = sliders[0];
  const sr = s0 ? s0.getBoundingClientRect() : null;
  return {
    sliderAnzahl: sliders.length,
    sliderSichtbar: s0 ? (sr.height > 4 && getComputedStyle(s0).display !== 'none') : false,
    sliderRect: sr ? { y: Math.round(sr.y), h: Math.round(sr.height), w: Math.round(sr.width) } : null,
    videoRect: vr ? { y: Math.round(vr.y), h: Math.round(vr.height), w: Math.round(vr.width) } : null,
    videoTransform: vs ? vs.transform : null,
    videoVisible: vr ? (vr.height > 4) : false,
    viewport: window.innerHeight
  };
});

console.log('VORHER:', JSON.stringify(await zustand()));
await page.screenshot({ path: '/tmp/dart-zoom-vorher.png' });

// Slider schrittweise nach links
const slider = page.locator('#profilkamera input[type=range]').first();
for (const val of [80, 60, 50, 45, 40, 35, 30]) {
  await slider.fill(String(val));
  await page.waitForTimeout(120);
  const z = await zustand();
  console.log('val=' + val, JSON.stringify(z));
}
await page.screenshot({ path: '/tmp/dart-zoom-nachher.png' });
console.log('ERRORS:', errors.length ? errors.join(' | ') : 'keine');
await browser.close();
