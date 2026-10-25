// E2E: STATIV-SZENARIO - schraeger Winkel (Kay stellt das Stativ schraeg zur Scheibe)
// 1) Schraeg-Kalibrierung mit Homographie, 2) Korrektur-Tap-Mapping (Zoom+Letterbox),
// 3) Orientierungswechsel Hoch<->Quer -> automatische Nachkalibrierung.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8077';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text()); });

// STATIV SCHRAEG: seitlicher Winkel (yaw-lastig, phi klein) + leichte Hoehenver-
// schiebung. Board bleibt erkennbar (v6.1/v6.5-Messungen: bis 29 Grad q>=94).
const ERW = { cx: 640, cy: 360, rx: 330, ry: 258, theta: 0.10, psi: 0.30, phi: 0.18 };

await page.addInitScript((erw) => {
  const S = [[erw.rx * Math.cos(erw.theta), -erw.ry * Math.sin(erw.theta), erw.cx],
             [erw.rx * Math.sin(erw.theta), erw.ry * Math.cos(erw.theta), erw.cy], [0, 0, 1]];
  const cp = Math.cos(erw.phi), sp = Math.sin(erw.phi), ch = Math.cosh(erw.psi), sh = Math.sinh(erw.psi);
  const B = [[ch * cp * cp + sp * sp, cp * sp * (ch - 1), sh * cp],
             [cp * sp * (ch - 1), ch * sp * sp + cp * cp, sh * sp],
             [sh * cp, sh * sp, ch]];
  const H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += S[i][k] * B[k][j];
    H[i][j] = s;
  }
  const inv = (x, y) => {
    const a2 = H[0][0] - x * H[2][0], b2 = H[0][1] - x * H[2][1], r2 = x * H[2][2] - H[0][2];
    const d2 = H[1][0] - y * H[2][0], e2 = H[1][1] - y * H[2][1], s2 = y * H[2][2] - H[1][2];
    const det = a2 * e2 - b2 * d2;
    return [(r2 * e2 - b2 * s2) / det, (-r2 * d2 + a2 * s2) / det];
  };
  const SEKTOREN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const ROTSEK = [20, 18, 13, 10, 2, 3, 7, 8, 14, 12];
  const ROT = [193, 39, 45], GRUEN = [14, 122, 60], SCHWARZ = [20, 20, 20], WEISS = [220, 218, 210];
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const x = c.getContext('2d');
  const img = x.createImageData(1280, 720);
  const d = img.data;
  for (let py = 0; py < 720; py++) for (let px = 0; px < 1280; px++) {
    const [u, v] = inv(px + 0.5, py + 0.5);
    const rr = Math.hypot(u, v);
    let col = [40, 38, 36];
    if (rr <= 1.0) {
      let ang = Math.atan2(u, -v) * 180 / Math.PI;
      if (ang < 0) ang += 360;
      const istRot = ROTSEK.includes(SEKTOREN[Math.round(ang / 18) % 20]);
      if (rr <= 0.037) col = SCHWARZ;
      else if (rr <= 0.094) col = GRUEN;
      else if (rr <= 0.527) col = istRot ? SCHWARZ : WEISS;
      else if (rr <= 0.63) col = istRot ? ROT : GRUEN;
      else if (rr <= 0.92) col = istRot ? SCHWARZ : WEISS;
      else col = istRot ? ROT : GRUEN;
    }
    const i = (py * 1280 + px) * 4;
    d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  setInterval(() => x.drawImage(c, 0, 0), 400);
  // PORTRAIT-VARIANTE: gleiche Kamera-Sicht um 90 Grad gerollt (Handy gedreht,
  // Stativ + Scheibe bleiben fix) -> echter 720x1280-Stream
  const c2 = document.createElement('canvas'); c2.width = 720; c2.height = 1280;
  const x2 = c2.getContext('2d');
  x2.translate(720 / 2, 1280 / 2); x2.rotate(Math.PI / 2); x2.translate(-640, -360);
  setInterval(() => x2.drawImage(c, 0, 0), 400);
  navigator.mediaDevices.getUserMedia = async () => {
    const quelle = window.__camPortrait ? c2 : c;
    const s2 = quelle.captureStream(15);
    s2.getVideoTracks()[0].getSettings = () => ({ width: quelle.width, height: quelle.height });
    return s2;
  };
  navigator.mediaDevices.enumerateDevices = async () => [];
}, ERW);

await page.goto(BASE + '/#/profile', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('text=Kamera anzeigen');
await page.waitForTimeout(1200);

// --- CHECK 1: Schraeg-Kalibrierung (Homographie vorhanden, q>=60) ---
const cal1 = await page.evaluate(async () => {
  const cam = await import('/js/views/camera.js');
  const v = document.querySelector('#profilkamera video');
  if (!v) return null;
  const erg = await cam.autoKalibriere(v);
  if (erg) { cam.setCal(erg); cam.saveCal(); }
  return erg;
});
check('1 schraeg kalibriert (h + q>=60)', cal1 && cal1.h && cal1.qualitaet >= 60,
  `q=${cal1 && cal1.qualitaet} rx=${cal1 && cal1.rx && Math.round(cal1.rx)} ar=${cal1 && cal1.ar && cal1.ar.toFixed(3)}`);

// --- CHECK 2: Korrektur-Tap-Mapping (Zoom 0.5 + Letterbox) -> T20-Pixel ---
const tapRes = await page.evaluate(async (erw) => {
  const cam = await import('/js/views/camera.js');
  const eng = await import('/js/core/camera-engine.js');
  const v = document.querySelector('#profilkamera video');
  const cal = cam.camCalRef();
  if (!v || !cal) return { ok: false, why: 'kein video/cal' };
  // Echter T20-Punkt im VIDEO-Raum (v-negativ = 12 Uhr):
  const bp = eng.normierraumZuBild(0, -0.578, cal);
  // Video- -> Screen-Mapping (wie starteKorrekturTap, rueckwaerts):
  const rect = v.getBoundingClientRect();
  const zoom = cam.leseAnsichtsZoom(v);
  const sc = Math.min(v.offsetWidth / v.videoWidth, v.offsetHeight / v.videoHeight);
  const offX = (v.offsetWidth - v.videoWidth * sc) / 2;
  const offY = (v.offsetHeight - v.videoHeight * sc) / 2;
  const sx = rect.left + (offX + bp.x * sc) * zoom;
  const sy = rect.top + (offY + bp.y * sc) * zoom;
  // Tap abgreifen:
  return await new Promise((res) => {
    cam.starteKorrekturTap(v, (p) => {
      const soll = eng.segVonPixel(p.x, p.y, cam.camCalRef());
      res({ ok: soll && soll.label === 'T20', label: soll && soll.label, soll: soll && soll.n, px: Math.round(p.x), py: Math.round(p.y), ex: Math.round(bp.x), ey: Math.round(bp.y) });
    });
    const ev = new MouseEvent('click', { clientX: sx, clientY: sy, bubbles: true });
    v.dispatchEvent(ev);
  });
}, ERW);
check('2 Korrektur-Tap auf T20 erkannt', tapRes.ok, JSON.stringify(tapRes).slice(0, 90));

// --- CHECK 3: Orientierungswechsel Quer -> Hoch => Auto-Nachkalibrierung ---
// (mountCam-Video = Spiel-View-Pfad; das Profil-Video hat den Handler nicht)
const orient = await page.evaluate(async () => {
  const cam = await import('/js/views/camera.js');
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:390px;height:300px;z-index:9999';
  document.body.append(host);
  await cam.mountCam(host, () => {}, () => {});
  const v = host.querySelector('video');
  if (!v) { host.remove(); return { ok: false, why: 'kein mountCam-video' }; }
  for (let i = 0; i < 20 && !v.videoWidth; i++) await new Promise(r => setTimeout(r, 200));
  const erg1 = await cam.autoKalibriere(v);
  if (!erg1) { host.remove(); return { ok: false, why: 'kalibrierung 1 failed', vw: v.videoWidth }; }
  cam.setCal(erg1); cam.saveCal();
  const calAlt = cam.camCalRef();
  // Orientierungswechsel: Handy dreht -> Kamera liefert echten 720x1280-Stream
  window.__camPortrait = true;
  v.srcObject = await navigator.mediaDevices.getUserMedia({ video: true });
  try { await v.play(); } catch (e) {}
  for (let i = 0; i < 20 && v.videoWidth !== 720; i++) await new Promise(r => setTimeout(r, 200));
  // resize-Event feuert von selbst -> Handler re-kalibriert
  let calNeu = null;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    calNeu = cam.camCalRef();
    if (calNeu && calNeu !== calAlt) break;
  }
  const ok = calNeu && calNeu !== calAlt && calNeu.ar && Math.abs(calNeu.ar - 720 / 1280) < 0.02;
  const erg2 = ok ? calNeu : null;
  try { await cam.unmountCam(); } catch (e) {}
  host.remove();
  return { ok, arAlt: erg1.ar, q1: erg1.qualitaet, arNeu: erg2 && erg2.ar, qNeu: erg2 && erg2.qualitaet };
});
check('3 Orientierungswechsel -> neu kalibriert', orient.ok, JSON.stringify(orient).slice(0, 110));

function check(name, ok, info) {
  console.log((ok ? 'OK ' : 'FAIL') + ' | ' + name + ' | ' + (info || ''));
  if (!ok) process.exitCode = 1;
}
if (errors.length) { console.log('SEITENFEHLER:', errors.slice(0, 5)); process.exitCode = 1; }
await browser.close();
