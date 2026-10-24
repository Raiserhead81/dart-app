// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Kamera-Erkennungs-Engine v4 (pure, testbar).
// Kalibrierung: { cx, cy, r } in Video-Pixeln (r = bis aeussere Doppelkante).
// v4: KEINE radiale Gewichtung (verzerrte zur Mitte). Stattdessen Physik:
// Pfeile haengen nach unten -> die SPITZE ist das OBERE Ende des Differenz-Blobs.
export const SEKTORZAHLEN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
export const RINGE = { bull: 0.037, bull25: 0.094, tripleIn: 0.527, tripleOut: 0.63, doubleIn: 0.92, doubleOut: 1.0 };

let _cal = { cx: 0, cy: 0, r: 0 };
export function setEngineCal(c) { _cal = c || _cal; }

export function segVonPixel(x, y, c) {
  const cal = c || _cal;
  const dx = x - cal.cx, dy = y - cal.cy;
  const r = Math.sqrt(dx * dx + dy * dy) / cal.r;
  if (r > 1.06) return null;
  if (r <= RINGE.bull) return { k: 'bull', n: 50, v: 50, label: 'BULL' };
  if (r <= RINGE.bull25) return { k: 'outer', n: 25, v: 25, label: '25' };
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (ang < 0) ang += 360;
  const idx = Math.round(ang / 18) % 20;
  const zahl = SEKTORZAHLEN[idx];
  if (r <= RINGE.tripleIn) return { k: 'single', n: zahl, v: zahl, label: 'S' + zahl };
  if (r <= RINGE.tripleOut) return { k: 'triple', n: zahl, v: zahl * 3, label: 'T' + zahl };
  if (r <= RINGE.doubleIn) return { k: 'single', n: zahl, v: zahl, label: 'S' + zahl };
  if (r <= RINGE.doubleOut) return { k: 'double', n: zahl, v: zahl * 2, label: 'D' + zahl };
  return null;
}

export function findeNeuenPfeil(a, b, calOverride) {
  if (!a || !b || a.width !== b.width) return null;
  const A = a.data, B = b.data;
  const c = calOverride || _cal;
  const step = 2;
  const cx = c.cx || a.width / 2, cy = c.cy || a.height / 2;
  const rr = (c.r || Math.min(a.width, a.height) / 2) * 1.25;
  const minX = Math.max(0, cx - rr), maxX = Math.min(a.width, cx + rr);
  const minY = Math.max(0, cy - rr), maxY = Math.min(a.height, cy + rr);
  // Alle Diff-Pixel sammeln (dunkler = neuer Pfeil)
  const px = [];
  let maxD = 0;
  for (let y = minY; y < maxY; y += step) {
    for (let x = minX; x < maxX; x += step) {
      const i = (Math.round(y) * a.width + Math.round(x)) * 4;
      const dunkler = (A[i] + A[i + 1] + A[i + 2]) - (B[i] + B[i + 1] + B[i + 2]);
      if (dunkler > 120) {
        px.push([x, y, dunkler * dunkler]);
        if (dunkler > maxD) maxD = dunkler;
      }
    }
  }
  if (px.length < 6 || maxD < 150) return null;
  // Blob-Ausdehnung
  let lo = Infinity, hi = -Infinity;
  for (const p of px) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  const hoehe = hi - lo;
  // SPITZE = oberes Drittel des Blobs (Pfeil haengt nach unten, Flight unten)
  const grenze = lo + hoehe * 0.33;
  let sw = 0, sx = 0, sy = 0, sn = 0;
  for (const [x, y, w] of px) {
    if (y <= grenze) { sw += w; sx += x * w; sy += y * w; sn++; }
  }
  if (sn < 3) { for (const [x, y, w] of px) { sw += w; sx += x * w; sy += y * w; } }
  return { x: sx / sw, y: sy / sw, staerke: maxD, pixel: px.length };
}
