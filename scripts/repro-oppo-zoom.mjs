// Repro auf Kays Oppo via CDP: Zoom-Regler nach links -> was verschwindet?
import { chromium } from 'playwright';

const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('8077'));
if (!page) { console.log('KEIN DART-TAB, tabs:', ctx.pages().map(p => p.url())); process.exit(1); }
console.log('TAB:', page.url());

await page.waitForTimeout(600);
const body = await page.textContent('body').catch(() => '');
console.log('HAT PROFILKAMERA:', body.includes('Kamera anzeigen') || body.includes('Kalibrier'));

// Zustands-Funktion injizieren
const zustand = () => page.evaluate(() => {
  const host = document.querySelector('#profilkamera');
  if (!host) return { fehler: 'kein #profilkamera' };
  const sliders = host.querySelectorAll('input[type=range]');
  const video = host.querySelector('video');
  const s0 = sliders[0];
  const sr = s0 ? s0.getBoundingClientRect() : null;
  const vr = video ? video.getBoundingClientRect() : null;
  return {
    sliderAnzahl: sliders.length,
    sliderY: sr ? Math.round(sr.y + window.scrollY) : null,
    sliderVal: s0 ? s0.value : null,
    sliderSichtbar: !!sr && sr.height > 4 && getComputedStyle(s0).display !== 'none',
    videoY: vr ? Math.round(vr.y + window.scrollY) : null,
    videoTransform: video ? video.style.transform : null,
    scrollY: window.scrollY
  };
});
console.log('ANFANG:', JSON.stringify(await zustand()));

// Kamera anzeigen (falls Button da)
const btn = page.locator('text=Kamera anzeigen');
if (await btn.count()) {
  await btn.first().click().catch(e => console.log('click-err', e.message));
  console.log('Kamera-Klick done - Permission-Dialog evtl. offen (adb)');
}
console.log('NACH KAMERA-KLICK:', JSON.stringify(await zustand()));
