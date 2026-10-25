import { describe, it, expect } from 'vitest';
import { vermesseScheibe } from '../src/camera-engine.js';

// Gittermodell-Test: Board-Builder (Singles schwarz/weiss, Triple+Double rot/gruen,
// BULL rot (50), 25er gruen - wie ein echtes Board).
function baueBoard(W, H, cx, cy, r, dunkelFaktor = 1, rotGrad = 0) {
  const ROT = [193, 39, 45], GRUEN = [14, 122, 60], SCHWARZ = [20, 20, 20], WEISS = [220, 218, 210];
  const SEKTOREN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const ROTSEK = [20, 18, 13, 10, 2, 3, 7, 8, 14, 12];
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dx = x - cx, dy = y - cy;
    const rr = Math.hypot(dx, dy) / r;
    let ang = Math.atan2(dx, -dy) * 180 / Math.PI + rotGrad;
    if (ang < 0) ang += 360; if (ang >= 360) ang -= 360;
    const istRot = ROTSEK.includes(SEKTOREN[Math.round(ang / 18) % 20]);
    let c;
    if (rr > 1.0) c = [40, 38, 36];
    else if (rr <= 0.037) c = ROT;
    else if (rr <= 0.094) c = GRUEN;
    else if (rr <= 0.527) c = istRot ? SCHWARZ : WEISS;
    else if (rr <= 0.63) c = istRot ? ROT : GRUEN;
    else if (rr <= 0.92) c = istRot ? SCHWARZ : WEISS;
    else c = istRot ? ROT : GRUEN;
    const i = (y * W + x) * 4;
    d[i] = c[0] * dunkelFaktor; d[i + 1] = c[1] * dunkelFaktor; d[i + 2] = c[2] * dunkelFaktor; d[i + 3] = 255;
  }
  return { width: W, height: H, data: d };
}

describe('Gittermodell: Scheibe pixel-fuer-pixel vermessen', () => {
  it('perfekte Kalibrierung -> 100% Treffer auf allen Zonen', () => {
    const W = 1280, H = 720, cx = 640, cy = 360, r = 330;
    const erg = vermesseScheibe(baueBoard(W, H, cx, cy, r), { cx, cy, r, rot: 0 }, 128);
    expect(erg.gitter).toBeGreaterThan(10000);
    expect(erg.qualitaet).toBe(100);
    expect(erg.fehler).toEqual([]);
  });

  it('gedrehtes Board (rot=90) wird ueber cal.rot exakt entzaubert', () => {
    const W = 1280, H = 720, cx = 640, cy = 360, r = 330;
    const erg = vermesseScheibe(baueBoard(W, H, cx, cy, r, 1, 90), { cx, cy, r, rot: 90 }, 128);
    expect(erg.qualitaet).toBe(100);
  });

  it('versetzte Kalibrierung (+30px) -> Fehler werden sichtbar', () => {
    const W = 1280, H = 720;
    const erg = vermesseScheibe(baueBoard(W, H, 640, 360, 330), { cx: 670, cy: 360, r: 330, rot: 0 }, 128);
    expect(erg.qualitaet).toBeLessThan(100);
    expect(erg.fehler.length).toBeGreaterThan(0);
  });

  it('dunkles Licht: Farb-Ringe bleiben messbar, Single-Helligkeit versagt', () => {
    const W = 1280, H = 720, cx = 640, cy = 360, r = 330;
    const erg = vermesseScheibe(baueBoard(W, H, cx, cy, r, 0.45), { cx, cy, r, rot: 0 }, 128);
    // rot/gruen bleiben klassifizierbar -> Ring-Sektoren alle ok
    expect(erg.sektoren.every(s => s.ok)).toBe(true);
    // weiss wird zu dunkel fuer 'hell' -> Singles fallen raus
    expect(erg.singles.filter(s => s.ok).length).toBeLessThan(20);
  });
});
