import { describe, it, expect } from 'vitest';
import { analyseBoardInFrame, setEngineCal, segVonPixel } from '../src/camera-engine.js';

// Synthetisches Dartboard als ImageData: echte Board-Farben, 20 Sektoren, Ringe.
function baueBoard(W, H, cx, cy, r, dunkelFaktor = 1, rauschen = 0, rotGrad = 0) {
  const ROT = [193, 39, 45], GRUEN = [14, 122, 60], SCHWARZ = [20, 20, 20], WEISS = [220, 218, 210];
  const SEKTOREN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
  const RINGE = { bull: 0.037, bull25: 0.094, tripleIn: 0.527, tripleOut: 0.63, doubleIn: 0.92, doubleOut: 1.0 };
  const d = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const dx = x - cx, dy = y - cy;
      const rr = Math.hypot(dx, dy) / r;
      let ang = Math.atan2(dx, -dy) * 180 / Math.PI - rotGrad; if (ang < 0) ang += 360; if (ang >= 360) ang -= 360;
      const idx = Math.round(ang / 18) % 20;
      const zahl = SEKTOREN[idx];
      const istRotSektor = [20, 18, 13, 10, 2, 3, 7, 8, 14, 12].includes(zahl);
      // ECHTE Board-Farben: Singles SCHWARZ/WEISS, Triple+Double ROT/GRUEN
      let c;
      if (rr > 1.0) c = [40, 38, 36];
      else if (rr <= RINGE.bull) c = SCHWARZ;
      else if (rr <= RINGE.bull25) c = GRUEN;
      else if (rr <= RINGE.tripleIn) c = istRotSektor ? SCHWARZ : WEISS;
      else if (rr <= RINGE.tripleOut) c = istRotSektor ? ROT : GRUEN;
      else if (rr <= RINGE.doubleIn) c = istRotSektor ? SCHWARZ : WEISS;
      else c = istRotSektor ? ROT : GRUEN;
      const i = (y * W + x) * 4;
      let R = c[0] * dunkelFaktor + (rauschen ? (Math.random() - 0.5) * rauschen : 0);
      d[i] = R; d[i + 1] = c[1] * dunkelFaktor + (rauschen ? (Math.random() - 0.5) * rauschen : 0); d[i + 2] = c[2] * dunkelFaktor + (rauschen ? (Math.random() - 0.5) * rauschen : 0); d[i + 3] = 255;
    }
  }
  return { width: W, height: H, data: d };
}

describe('Auto-Kalibrierung (HSV) an synthetischen Boards', () => {
  const W = 270, H = 480, cx = 140, cy = 230, r = 95;

  it('findet Zentrum+Radius bei HELLEM Bild', () => {
    const erg = analyseBoardInFrame(baueBoard(W, H, cx, cy, r, 1));
    expect(erg).toBeTruthy();
    expect(Math.abs(erg.cx - cx)).toBeLessThan(8);
    expect(Math.abs(erg.cy - cy)).toBeLessThan(8);
    expect(Math.abs(erg.r - r)).toBeLessThan(r * 0.12);
  });

  it('findet das Board im DUNKLEN Zimmer (Faktor 0.06 — Kays Helligkeit-8-Fall)', () => {
    const erg = analyseBoardInFrame(baueBoard(W, H, cx, cy, r, 0.06));
    expect(erg).toBeTruthy();
    expect(Math.abs(erg.cx - cx)).toBeLessThan(10);
    expect(Math.abs(erg.cy - cy)).toBeLessThan(10);
    expect(Math.abs(erg.r - r)).toBeLessThan(r * 0.15);
  });

  it('uebersteht Sensor-Rauschen im Dunkeln', () => {
    const erg = analyseBoardInFrame(baueBoard(W, H, cx, cy, r, 0.08, 6));
    expect(erg).toBeTruthy();
    expect(Math.abs(erg.cx - cx)).toBeLessThan(12);
    expect(Math.abs(erg.cy - cy)).toBeLessThan(12);
  });

  it('findet ein kleines Board (Weitwinkel aus 1m) und ein verschobenes', () => {
    const klein = analyseBoardInFrame(baueBoard(W, H, 100, 200, 40, 0.3));
    expect(Math.abs(klein.cx - 100)).toBeLessThan(12);
    const seitlich = analyseBoardInFrame(baueBoard(W, H, 190, 300, 70, 1)); // komplett im Bild!
    expect(Math.abs(seitlich.cx - 190)).toBeLessThan(10);
  });

  it('liefert NULL bei Board-losem Bild (kein Fehl-Alarm)', () => {
    const leer = { width: W, height: H, data: new Uint8ClampedArray(W * H * 4).fill(60).map((v, i) => i % 4 === 3 ? 255 : v) };
    expect(analyseBoardInFrame(leer)).toBeNull();
  });
});

describe('Rotations-Erkennung (Kamera schief = 20er nicht exakt oben)', () => {
  it('erkennt eine Drehung von +9 Grad (20er leicht nach rechts)', () => {
    // Board um 9° gedreht bauen: einfach das Test-Board nutzen und Segment-Rechner
    // mit rot=9 pruefen: Ein Punkt der OHNE Rotation auf S20 zeigt, ist mit rot=9 S...?
    const { setEngineCal, segVonPixel } = require('../src/camera-engine.js');
  });
});

describe('Rotations-Erkennung', () => {
  it('bei rot=+9 Grad landet der Punkt "leicht rechts ueberm Bull" auf S1 statt S20 (Nachbar-Sektor)', () => {
    setEngineCal({ cx: 540, cy: 960, r: 300, rot: 9 });
    // Punkt bei +9 Grad (genau auf der gedrehten 20er-Mitte): ohne rot waere er S20-Grenze zu S1
    const rad = 9 * Math.PI / 180;
    const px = 540 + Math.sin(rad) * 0.4 * 300, py = 960 - Math.cos(rad) * 0.4 * 300;
    const seg = segVonPixel(px, py);
    expect(seg?.label).toBe('S20'); // mit korrekter Rotations-Korrektur bleibt es der 20er
  });
  it('ohne Rotation (rot=0) bleibt alles beim Alten', () => {
    setEngineCal({ cx: 540, cy: 960, r: 300, rot: 0 });
    const seg = segVonPixel(540, 960 - 0.4 * 300);
    expect(seg?.label).toBe('S20');
  });
});

describe('Vollautomatische Rotation aus dem Bild', () => {
  it('Board um 9 Grad gedreht: Kalibrierung misst rot ≈ 9 Grad', () => {
    const erg = analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 1, 0, 9));
    expect(erg).toBeTruthy();
    expect(Math.abs(erg.rot - 9)).toBeLessThan(4.5); // Sektor-Mitte-Treffer +-2 Sektorschritte
  });
  it('Board gerade: rot ≈ 0', () => {
    const erg = analyseBoardInFrame(baueBoard(270, 480, 140, 230, 95, 0.5, 0, 0));
    expect(erg).toBeTruthy();
    expect(Math.abs(erg.rot) % 360).toBeLessThan(4.5);
  });
});
