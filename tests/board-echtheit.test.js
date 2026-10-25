import { describe, it, expect } from 'vitest';
import { analyseBoardInFrame } from '../src/camera-engine.js';

// Kompakter Board-Builder (wie camera-kalib.test.js): Singles schwarz/weiss,
// Triple+Double rot/gruen, 20 Sektoren, dunkle Umrandung.
function baueBoard(W, H, cx, cy, r, dunkelFaktor = 1, rauschen = 0, rotGrad = 0) {
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
    else if (rr <= 0.037) c = SCHWARZ;
    else if (rr <= 0.094) c = GRUEN;
    else if (rr <= 0.527) c = istRot ? SCHWARZ : WEISS;
    else if (rr <= 0.63) c = istRot ? ROT : GRUEN;
    else if (rr <= 0.92) c = istRot ? SCHWARZ : WEISS;
    else c = istRot ? ROT : GRUEN;
    const i = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) d[i + k] = c[k] * dunkelFaktor + (rauschen ? (Math.random() - 0.5) * rauschen : 0);
    d[i + 3] = 255;
  }
  return { width: W, height: H, data: d };
}

// Fernseher-Szene: bunte Blöcke (Streaming-UI) auf dunklem Bezel-Rahmen.
function baueTV(W, H) {
  const d = new Uint8ClampedArray(W * H * 4);
  const bloecke = [
    [0.05, 0.05, 0.42, 0.4, [200, 40, 40]], [0.5, 0.05, 0.45, 0.28, [30, 150, 60]],
    [0.5, 0.36, 0.45, 0.3, [60, 80, 200]], [0.05, 0.5, 0.25, 0.42, [20, 160, 70]],
    [0.33, 0.7, 0.3, 0.22, [190, 60, 50]], [0.66, 0.5, 0.29, 0.42, [230, 220, 60]]
  ];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x / W, fy = y / H;
    let c = [18, 16, 16]; // Bezel dunkel
    for (const b of bloecke) if (fx >= b[0] && fx <= b[0] + b[2] && fy >= b[1] && fy <= b[1] + b[3]) c = b[4];
    const i = (y * W + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return { width: W, height: H, data: d };
}

// Fernseher-Szene 2: buntes Rauschen (Live-TV).
function baueTVRauschen(W, H) {
  const palette = [[200, 40, 40], [30, 150, 60], [60, 80, 200], [230, 200, 60], [150, 40, 160], [40, 40, 40], [220, 220, 220]];
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = palette[Math.floor(Math.random() * palette.length)];
    const i = (y * W + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return { width: W, height: H, data: d };
}

// Fernseher-Szene 3: Fussball (grüner Rasen, rote Trikot-Cluster).
function baueTVPitch(W, H) {
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = [24, 130, 55];
    for (const t of [[0.3, 0.3, 0.08], [0.62, 0.42, 0.06], [0.5, 0.6, 0.05], [0.75, 0.25, 0.07]]) {
      if (Math.hypot(x / W - t[0], y / H - t[1]) < t[2]) c = [200, 45, 45];
    }
    const i = (y * W + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  return { width: W, height: H, data: d };
}

describe('Echtheits-Check: Scheibe ja, Fernseher nein', () => {
  it('echtes Board (hell): Qualität >= 70', () => {
    const erg = analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 1));
    expect(erg).not.toBeNull();
    expect(erg.qualitaet).toBeGreaterThanOrEqual(70);
  });

  it('echtes Board daemmerig (0.3) + Rauschen: Radius-Schaetzung kippt, Auto-Gate lehnt ab (Torch/Tap noetig)', () => {
    for (let i = 0; i < 3; i++) {
      const erg = analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 0.3, 6));
      if (erg) expect(erg.qualitaet < 60 || erg.r >= 270 * 0.75).toBe(true);
    }
  });

  it('fast schwarz + Rauschen: Auto lehnt ab (Fehlerkennung unmöglich, Tap-Fallback noetig)', () => {
    for (let i = 0; i < 3; i++) {
      const erg = analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 0.08, 6));
      // Auto-Gate: q < 60 ODER Radius gekippt (r > 0.75 * Frame-Breite)
      if (erg) expect(erg.qualitaet < 60 || erg.r > 202).toBe(true);
    }
  });

  it('echtes Board gedreht: Qualität >= 60', () => {
    expect(analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 1, 0, 9)).qualitaet).toBeGreaterThanOrEqual(60);
  });

  it('TV mit bunten Blöcken + dunklem Rahmen: abgelehnt (< 60 oder null)', () => {
    for (let i = 0; i < 5; i++) {
      const erg = analyseBoardInFrame(baueTV(270, 480));
      if (erg) expect(erg.qualitaet).toBeLessThan(60);
    }
  });

  it('TV mit buntem Rauschen: abgelehnt', () => {
    for (let i = 0; i < 5; i++) {
      const erg = analyseBoardInFrame(baueTVRauschen(270, 480));
      if (erg) expect(erg.qualitaet).toBeLessThan(60);
    }
  });

  it('TV Fussball (Rasen + rote Trikots): abgelehnt', () => {
    const erg = analyseBoardInFrame(baueTVPitch(270, 480));
    if (erg) expect(erg.qualitaet).toBeLessThan(60);
  });

  it('Board-Handling: alternanz + ringAnteil im Ergebnis für Diagnose', () => {
    const erg = analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 1));
    expect(erg.alternanz).toBeGreaterThanOrEqual(0.85);
    expect(erg.ringAnteil).toBeGreaterThanOrEqual(0.75);
  });
});
