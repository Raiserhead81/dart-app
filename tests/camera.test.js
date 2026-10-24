import { describe, it, expect } from 'vitest';
// Die reinen Erkennungsfunktionen ohne Kamera-Hardware testbar machen:
// Wir laden das Modul und greifen via Re-Export-Trick auf die Interna zu.
import { segVonPixel, findeNeuenPfeil } from '../src/camera-engine.js';

// Kalibrierung: Mitte (100,100), Radius 80
const CAL = { cx: 100, cy: 100, r: 80 };

function frame(hellesBoard = true) {
  const w = 200, h = 200;
  const d = new Uint8ClampedArray(w * h * 4).fill(hellesBoard ? 200 : 60);
  return { width: w, height: h, data: d };
}

function mitPfeil(base, x, y, groesse = 5, dunkel = 20) {
  const f = { width: base.width, height: base.height, data: new Uint8ClampedArray(base.data) };
  for (let dy = -groesse; dy <= groesse; dy++) {
    for (let dx = -groesse; dx <= groesse; dx++) {
      const px = x + dx, py = y + dy;
      if (px < 0 || py < 0 || px >= f.width || py >= f.height) continue;
      const i = (Math.round(py) * f.width + Math.round(px)) * 4;
      f.data[i] = dunkel; f.data[i + 1] = dunkel; f.data[i + 2] = dunkel;
    }
  }
  return f;
}

describe('Kamera-Engine v2 (Schwerpunkt + Board-Crop)', () => {
  it('segVonPixel: Bull-Zentrum => BULL', () => {
    const seg = segVonPixel(100, 100, CAL);
    expect(seg?.label).toBe('BULL');
  });

  it('segVonPixel: oben zwischen Triple-Ringen => T20', () => {
    // oben = 20er-Sektor; r = 0.58*r zwischen tripleIn(0.527) und tripleOut(0.63)
    const r = 0.58 * CAL.r;
    const seg = segVonPixel(100, 100 - r, CAL);
    expect(seg?.label).toBe('T20');
    expect(seg?.v).toBe(60);
  });

  it('segVonPixel: oben im Single-Bereich => S20', () => {
    const r = 0.35 * CAL.r;
    const seg = segVonPixel(100, 100 - r, CAL);
    expect(seg?.label).toBe('S20');
  });

  it('segVonPixel: rechts unten im Doppelring => D11-Sektor? (Winkelcheck: rechts=Ost => 6er? nein: 6 ist Ost)', () => {
    // Osten (90°) => Sektorzahl 6 laut Dartboard
    const r = 0.96 * CAL.r;
    const seg = segVonPixel(100 + r, 100, CAL);
    expect(seg?.label).toBe('D6');
  });

  it('findeNeuenPfeil: neuer dunkler Fleck wird im Schwerpunkt gefunden', () => {
    const a = frame();
    const b = mitPfeil(a, 100, 100 - 0.58 * CAL.r); // Treffer im T20-Bereich
    const p = findeNeuenPfeil(a, b, CAL);
    expect(p).toBeTruthy();
    expect(Math.abs(p.x - 100)).toBeLessThan(3);
    expect(Math.abs(p.y - (100 - 0.58 * CAL.r))).toBeLessThan(3);
    const seg = segVonPixel(p.x, p.y, CAL);
    expect(seg?.label).toBe('T20');
  });

  it('findeNeuenPfeil: KEIN Pfeil => null (kein Rauschen-Gezähle)', () => {
    const a = frame();
    const b = frame();
    expect(findeNeuenPfeil(a, b, CAL)).toBeNull();
  });
});
