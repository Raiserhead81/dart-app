import { describe, it, expect } from 'vitest';
import { segVonPixel, findeNeuenPfeil } from '../src/camera-engine.js';

const CAL = { cx: 100, cy: 100, r: 80 };

function frame() { return { width: 200, height: 200, data: new Uint8ClampedArray(200 * 200 * 4).fill(200) }; }
function fleck(f, x, y, r, d = 20) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const px = Math.round(x + dx), py = Math.round(y + dy);
    if (px < 0 || py < 0 || px >= 200 || py >= 200) continue;
    const i = (py * 200 + px) * 4;
    f.data[i] = d; f.data[i + 1] = d; f.data[i + 2] = d;
  }
}

describe('Kamera-Engine v3 (Spitze gewinnt gegen heraushaengenden Flight)', () => {
  it('Pfeilspitze in T20, Flight/Schaft haengt nach unten raus => T20', () => {
    const a = frame();
    const b = frame();
    fleck(b, 100, 100 - 0.58 * CAL.r, 4);   // Spitze im T20
    fleck(b, 100, 100 - 0.58 * CAL.r + 30, 8, 60); // Schaft+Flight weiter unten (heller)
    const p = findeNeuenPfeil(a, b, CAL);
    expect(p).toBeTruthy();
    const seg = segVonPixel(p.x, p.y, CAL);
    expect(seg?.label).toBe('T20');
  });

  it('reiner Pfeil ohne Flight: weiterhin exakt', () => {
    const a = frame();
    const b = frame();
    fleck(b, 100 + 0.96 * CAL.r, 100, 4); // Osten: Doppel-Ring von 6
    const p = findeNeuenPfeil(a, b, CAL);
    const seg = segVonPixel(p.x, p.y, CAL);
    expect(seg?.label).toBe('D6');
  });
});
