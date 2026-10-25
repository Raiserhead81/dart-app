// Homographie-Tests: projektive Schraegsicht-Korrektur (v6)
// Mathematischer Kern: Ellipse + Bild des Kreismittelpunkts (Bull) bestimmen
// die Homographie Einheitskreis -> Bild eindeutig (ohne Kamera-Intrinsics).
import { describe, it, expect } from 'vitest';
import { baueHomographie, inNormierraum, normierraumZuBild, fitEllipse } from '../src/camera-engine.js';

function mmul(A, B) {
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j];
    R[i][j] = s;
  }
  return R;
}
function dehomog(p) { return [p[0] / p[2], p[1] / p[2]]; }
function anw(H, u, v) { return dehomog([H[0][0] * u + H[0][1] * v + H[0][2], H[1][0] * u + H[1][1] * v + H[1][2], H[2][0] * u + H[2][1] * v + H[2][2]]); }

// Wahrheits-Homographie unabhaengig aufbauen: H_true = S * B(psi,phi)
function wahrheitsH(cx, cy, rx, ry, theta, psi, phi) {
  const S = [[rx * Math.cos(theta), -ry * Math.sin(theta), cx], [rx * Math.sin(theta), ry * Math.cos(theta), cy], [0, 0, 1]];
  const cp = Math.cos(phi), sp = Math.sin(phi), ch = Math.cosh(psi), sh = Math.sinh(psi);
  const R1 = [[cp, -sp, 0], [sp, cp, 0], [0, 0, 1]];
  const Bx = [[ch, 0, sh], [0, 1, 0], [sh, 0, ch]];
  const R2 = [[cp, sp, 0], [-sp, cp, 0], [0, 0, 1]];
  return mmul(mmul(S, R1), mmul(Bx, R2));
}

describe('Homographie: projektive Schraegsicht-Korrektur', () => {

it('Exakter Roundtrip: baueHomographie rekonstruiert H_true aus Ellipse + Bull-Versatz', () => {
  const cx = 140, cy = 230, rx = 95, ry = 78, theta = 0.18, psi = 0.25, phi = 0.7;
  const Ht = wahrheitsH(cx, cy, rx, ry, theta, psi, phi);
  const M = anw(Ht, 0, 0); // Bild des echten Mittelpunkts
  const h = baueHomographie(cx, cy, rx, ry, theta, M[0], M[1]);
  if (!h) throw new Error('h fehlt obwohl Versatz klar vorhanden');
  // Roundtrip ueber 200 Punkte im Einheitskreis
  let maxErr = 0;
  for (let k = 0; k < 200; k++) {
    const u = Math.cos(k * 2.399), v = Math.sin(k * 3.107);
    const r = 0.15 + 0.8 * ((k * 0.618) % 1);
    const p = anw(Ht, u * r, v * r);
    const z = inNormierraum(p[0], p[1], { cx, cy, rx, ry, theta, h });
    maxErr = Math.max(maxErr, Math.hypot(z.u - u * r, z.v - v * r));
  }
  if (maxErr > 1e-9) throw new Error('Roundtrip-Fehler ' + maxErr);
});

it('normierraumZuBild ist die exakte Umkehrung', () => {
  const cx = 100, cy = 200, rx = 88, ry = 70, theta = -0.3, psi = 0.2, phi = -1.2;
  const Ht = wahrheitsH(cx, cy, rx, ry, theta, psi, phi);
  const M = anw(Ht, 0, 0);
  const h = baueHomographie(cx, cy, rx, ry, theta, M[0], M[1]);
  let maxErr = 0;
  for (let k = 0; k < 100; k++) {
    const u = Math.cos(k) * 0.9, v = Math.sin(k * 1.7) * 0.9;
    const p = normierraumZuBild(u, v, { h });
    const z = inNormierraum(p.x, p.y, { h });
    maxErr = Math.max(maxErr, Math.hypot(z.u - u, z.v - v));
  }
  if (maxErr > 1e-9) throw new Error('Invers-Fehler ' + maxErr);
});

it('Frontal (kein Versatz): h = null, affiner Pfad bleibt exakt', () => {
  const cx = 135, cy = 240, rx = 95, ry = 95, theta = 0;
  const h = baueHomographie(cx, cy, rx, ry, theta, cx + 0.005, cy + 0.005);
  if (h) throw new Error('frontal sollte null liefern');
  const z = inNormierraum(cx, cy - 0.5 * rx, { cx, cy, rx, ry, theta, h: null });
  if (Math.abs(z.v + 0.5) > 1e-12) throw new Error('affiner Pfdefekt');
});

it('Unplausibler Bull-Versatz (auserhalb Ellipsen-Inneres) -> frontal-Fallback', () => {
  const h = baueHomographie(135, 240, 95, 90, 0, 135 + 80, 240 + 10);
  if (h) throw new Error('Versatz > 0.6 muss null liefern');
});

it('Synthetische Kamera, 25 Grad Tilt um Y: Homographie schlaegt affine Ellipse deutlich', () => {
  const f = 900, cx0 = 135, cy0 = 240, d = 520, R = 95, tau = 25 * Math.PI / 180;
  const proj = (u, v) => [f * (u * R * Math.cos(tau)) / (d - u * R * Math.sin(tau)) + cx0, f * (v * R) / (d - u * R * Math.sin(tau)) + cy0];
  // Ellipse aus 72 Randpunkten fitten (echter Engine-Pfad)
  const rand = [];
  for (let k = 0; k < 72; k++) { const a = k / 72 * 2 * Math.PI; rand.push(proj(Math.cos(a), Math.sin(a))); }
  const ell = fitEllipse(rand.map(p => [p[0], p[1]]));
  if (!ell) throw new Error('fitEllipse versagt');
  const M = proj(0, 0);
  const h = baueHomographie(ell.cx, ell.cy, ell.rx, ell.ry, ell.theta, M[0], M[1]);
  if (!h) throw new Error('Homographie fehlt bei klarem 25-Grad-Tilt');
  const calH = { cx: ell.cx, cy: ell.cy, rx: ell.rx, ry: ell.ry, theta: ell.theta, rot: 0, h };
  const calA = { cx: ell.cx, cy: ell.cy, rx: ell.rx, ry: ell.ry, theta: ell.theta, rot: 0, h: null };
  let maxWinkH = 0, maxWinkA = 0, skal = 0, nSkal = 0;
  for (const rr of [0.3, 0.6, 0.95]) {
    for (let w = 0; w < 360; w += 5) {
      const rad = w * Math.PI / 180, u = rr * Math.sin(rad), v = -rr * Math.cos(rad);
      const p = proj(u, v);
      const zH = inNormierraum(p[0], p[1], calH);
      const zA = inNormierraum(p[0], p[1], calA);
      const wink = (z) => { let a = Math.atan2(z.u, -z.v) * 180 / Math.PI - w; while (a > 180) a -= 360; while (a < -180) a += 360; return Math.abs(a); };
      maxWinkH = Math.max(maxWinkH, wink(zH));
      maxWinkA = Math.max(maxWinkA, wink(zA));
      if (rr === 0.6) { skal += Math.hypot(zH.u, zH.v) / rr; nSkal++; }
    }
  }
  skal /= nSkal;
  // fitEllipse-Skala (97%-Stutzung) darf leicht daneben liegen, aber homogen sein
  if (skal < 0.9 || skal > 1.12) throw new Error('fitEllipse-Skala abwegig: ' + skal.toFixed(3));
  if (maxWinkH > 2.0) throw new Error('Homographie-Winkelfehler zu gross: ' + maxWinkH.toFixed(2) + ' Grad');
  if (maxWinkA <= maxWinkH * 1.5) throw new Error('Erwartung nicht erfuellt: affin (' + maxWinkA.toFixed(2) + ' Grad) sollte deutlich schlechter sein als projektiv (' + maxWinkH.toFixed(2) + ' Grad)');
});

it('Bull-Messung verrauscht (+-3px): Winkelfehler bleibt unter 2 Grad', () => {
  const f = 900, cx0 = 135, cy0 = 240, d = 520, R = 95, tau = 20 * Math.PI / 180;
  const proj = (u, v) => [f * (u * R * Math.cos(tau)) / (d - u * R * Math.sin(tau)) + cx0, f * (v * R) / (d - u * R * Math.sin(tau)) + cy0];
  const rand = [];
  for (let k = 0; k < 72; k++) { const a = k / 72 * 2 * Math.PI; rand.push(proj(Math.cos(a), Math.sin(a))); }
  const ell = fitEllipse(rand.map(p => [p[0], p[1]]));
  const M = proj(0, 0);
  let maxW = 0;
  for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, -2]]) {
    const h = baueHomographie(ell.cx, ell.cy, ell.rx, ell.ry, ell.theta, M[0] + dx, M[1] + dy);
    if (!h) continue;
    for (let w = 0; w < 360; w += 10) {
      const rr = 0.95, rad = w * Math.PI / 180, u = rr * Math.sin(rad), v = -rr * Math.cos(rad);
      const p = proj(u, v);
      const z = inNormierraum(p[0], p[1], { cx: ell.cx, cy: ell.cy, rx: ell.rx, ry: ell.ry, theta: ell.theta, rot: 0, h });
      let a = Math.atan2(z.u, -z.v) * 180 / Math.PI - w;
      while (a > 180) a -= 360; while (a < -180) a += 360;
      maxW = Math.max(maxW, Math.abs(a));
    }
  }
  if (maxW > 2.0) throw new Error('Rausch-Fehler ' + maxW.toFixed(2) + ' Grad');
});

it('Ringgrenzen-Integration: Triple-20-Mitte bleibt T20 trotz 25-Grad-Tilt', () => {
  const f = 900, cx0 = 135, cy0 = 240, d = 520, R = 95, tau = 25 * Math.PI / 180;
  const proj = (u, v) => [f * (u * R * Math.cos(tau)) / (d - u * R * Math.sin(tau)) + cx0, f * (v * R) / (d - u * R * Math.sin(tau)) + cy0];
  const rand = [];
  for (let k = 0; k < 72; k++) { const a = k / 72 * 2 * Math.PI; rand.push(proj(Math.cos(a), Math.sin(a))); }
  const ell = fitEllipse(rand.map(p => [p[0], p[1]]));
  const M = proj(0, 0);
  const h = baueHomographie(ell.cx, ell.cy, ell.rx, ell.ry, ell.theta, M[0], M[1]);
  // Triple-Mitte oben: Radius (0.527+0.63)/2, Winkel 0 -> T20
  const rr = 0.577, p = proj(0, -rr);
  // segVonPixel nutzt RINGE intern; wir pruefen Radius+Segment per inNormierraum
  const z = inNormierraum(p[0], p[1], { cx: ell.cx, cy: ell.cy, rx: ell.rx, ry: ell.ry, theta: ell.theta, rot: 0, h });
  const rad = Math.hypot(z.u, z.v);
  const skal = 0.577 / rad;
  if (skal < 0.9 || skal > 1.12) throw new Error('Radius-Skala abwegig');
  const rel = rad / 0.577; // Radius in Einheiten der Triple-Mitte
  if (rel * 0.577 < 0.527 || rel * 0.577 > 0.63) throw new Error('Punkt rutscht aus dem Triple-Ring: r=' + (rel * 0.577).toFixed(3));
  let ang = Math.atan2(z.u, -z.v) * 180 / Math.PI;
  if (Math.abs(ang) > 2.0) throw new Error('Winkelfehler T20: ' + ang.toFixed(2) + ' Grad');
});

});
