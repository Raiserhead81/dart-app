// E2E: Perspektivisch geneigtes Dartboard als Fake-Kamera -> Auto-Kalibrierung
// muss eine Homographie (cal.h) liefern und T20 trotz Schraegsicht korrekt erkennen.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8077';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push('console: ' + m.text()); });

// Erwartete Geometrie (identisch zum Init-Skript unten)
const ERW = { cx: 640, cy: 360, rx: 330, ry: 258, theta: 0.10, psi: 0.22, phi: 0.60 };

await page.addInitScript((erw) => {
  // H_true = S * B(psi,phi) im Video-Raum; Board-Punkte (u,v) -> Bild
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
  // Rueckabbildung Bild -> (u,v) per 2x2 (gleiche Methode wie Engine)
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
    let col = [40, 38, 36]; // Umgebung dunkel
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
  setInterval(() => x.drawImage(c, 0, 0), 400); // Canvas "animiert" halten fuer captureStream
  navigator.mediaDevices.getUserMedia = async () => {
    const s2 = c.captureStream(15);
    s2.getVideoTracks()[0].getSettings = () => ({ width: 1280, height: 720 });
    return s2;
  };
  navigator.mediaDevices.enumerateDevices = async () => [];
}, ERW);

await page.goto(BASE + '/#/profile', { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.click('text=Kamera anzeigen');
await page.waitForTimeout(1200);

const erg = await page.evaluate(async () => {
  const m = await import('/js/views/camera.js');
  const v = document.querySelector('#profilkamera video');
  if (!v || !v.videoWidth) return { fehler: 'kein video' };
  return await m.autoKalibriere(v);
});

const pruef = [];
const ok = (name, cond, info = '') => { pruef.push((cond ? 'OK  ' : 'FAIL') + ' ' + name + (info ? ' | ' + info : '')); if (!cond) process.exitCode = 1; };

if (!erg || erg.fehler) {
  ok('Auto-Kalibrierung liefert Ergebnis', false, JSON.stringify(erg));
} else {
  ok('Qualitaet >= 60', erg.qualitaet >= 60, 'q=' + erg.qualitaet);
  ok('Homographie cal.h vorhanden', Array.isArray(erg.h) && erg.h.length === 3);
  ok('Ellipse uebernommen (rx/ry/theta)', typeof erg.rx === 'number' && typeof erg.theta === 'number', `rx=${erg.rx?.toFixed(0)} ry=${erg.ry?.toFixed(0)} theta=${erg.theta?.toFixed(3)}`);
  ok('Rotation erkannt (|rot| < 6 Grad)', Math.abs(erg.rot) < 6, 'rot=' + (erg.rot ?? 'null'));

  // Bild des Mittelpunkts unter erg.h muss beim erwarteten Bull-Punkt liegen
  const bull = await page.evaluate(async (h) => {
    const e = await import('/js/core/camera-engine.js');
    const p = e.normierraumZuBild(0, 0, { h });
    return { x: p.x, y: p.y };
  }, erg.h);
  // erwarteter Bull-Punkt = dehomog(H_true * e3)
  const ERWB = (() => {
    const S = [[ERW.rx * Math.cos(ERW.theta), -ERW.ry * Math.sin(ERW.theta), ERW.cx],
               [ERW.rx * Math.sin(ERW.theta), ERW.ry * Math.cos(ERW.theta), ERW.cy], [0, 0, 1]];
    const cp = Math.cos(ERW.phi), sp = Math.sin(ERW.phi), ch = Math.cosh(ERW.psi), sh = Math.sinh(ERW.psi);
    const B = [[ch * cp * cp + sp * sp, cp * sp * (ch - 1), sh * cp],
               [cp * sp * (ch - 1), ch * sp * sp + cp * cp, sh * sp],
               [sh * cp, sh * sp, ch]];
    const p = [0, 1, 2].map(i => S[i][0] * B[0][2] + S[i][1] * B[1][2] + S[i][2] * B[2][2]);
    return { x: p[0] / p[2], y: p[1] / p[2] };
  })();
  const bullErr = Math.hypot(bull.x - ERWB.x, bull.y - ERWB.y);
  ok('Bull-Punkt unter cal.h stimmt (< 25px)', bullErr < 25, `err=${bullErr.toFixed(1)}px erwartet (${ERWB.x.toFixed(0)},${ERWB.y.toFixed(0)}) got (${bull.x.toFixed(0)},${bull.y.toFixed(0)})`);

  // Segmenttest: T20-Mitte (u,v)=(0,-0.577) muss triple/20 sein; affin zum Vergleich
  const seg = await page.evaluate(async (ergCal) => {
    const e = await import('/js/core/camera-engine.js');
    const p = e.normierraumZuBild(0, -0.577, ergCal);
    const pHom = e.segVonPixel(p.x, p.y, ergCal);
    const pA = e.normierraumZuBild(0, -0.577, { ...ergCal, h: null });
    const pAffin = e.segVonPixel(pA.x, pA.y, { ...ergCal, h: null });
    return { pHom, pAffin, p: { x: p.x, y: p.y } };
  }, erg);
  ok('T20-Mitte -> T20 (projektiv)', seg.pHom && seg.pHom.k === 'triple' && seg.pHom.n === 20, JSON.stringify(seg.pHom));
  pruef.push('INFO affin: ' + JSON.stringify(seg.pAffin));
}

if (errors.length) { console.log('ERRORS: ' + errors.join(' | ')); process.exitCode = 1; }
console.log(pruef.join('\n'));
await browser.close();
