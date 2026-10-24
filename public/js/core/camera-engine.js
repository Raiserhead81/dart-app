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


// ---------- Auto-Kalibrierung (pure, testbar) ----------
export function normalisiereFrame(D) {
  // Kontraststreckung je Kanal (Nachtsicht): dunkle Streams bekommen Farbe zurueck
  let maxR = 1, maxG = 1, maxB = 1;
  for (let i = 0; i < D.length; i += 16) { if (D[i] > maxR) maxR = D[i]; if (D[i + 1] > maxG) maxG = D[i + 1]; if (D[i + 2] > maxB) maxB = D[i + 2]; }
  return { maxR, maxG, maxB };
}

export function analyseBoardInFrame(img) {
  const W = img.width, H = img.height, D = img.data;
  // NACH TU-WIEN-BACHELORARBEIT (zor-cell/dart-tracking): SEKTOREN IN HSV
  // erkennen — Farbton (Hue) ist unempfindlich gegen Dunkelheit/Weissabgleich.
  const rgb2hsv = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d > 0.001) {
      if (mx === r) h = 60 * (((g - b) / d) % 6);
      else if (mx === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
      if (h < 0) h += 360;
    }
    const s = mx > 0.001 ? d / mx : 0;
    return [h, s, mx];
  };
  const { maxR, maxG, maxB } = normalisiereFrame(D);
  const istRotPx = (r, g, b) => { const [h, sv, vv] = rgb2hsv(r * 255 / maxR, g * 255 / maxG, b * 255 / maxB); return (h < 25 || h > 335) && sv > 0.32 && vv > 0.18; };
  const istGruenPx = (r, g, b) => { const [h, sv, vv] = rgb2hsv(r * 255 / maxR, g * 255 / maxG, b * 255 / maxB); return h > 80 && h < 165 && sv > 0.25 && vv > 0.15; };
  const punkte = [];
  let sx = 0, sy = 0, n = 0;
  for (let y = 2; y < H - 2; y += 2) {
    for (let x = 2; x < W - 2; x += 2) {
      const i = (y * W + x) * 4;
      if (istRotPx(D[i], D[i + 1], D[i + 2]) || istGruenPx(D[i], D[i + 1], D[i + 2])) {
        punkte.push([x, y]); sx += x; sy += y; n++;
      }
    }
  }
  if (n < 40) return null;
  let cx = sx / n, cy = sy / n;
  for (let runde = 0; runde < 2; runde++) {
    const dists = punkte.map(p => Math.hypot(p[0] - cx, p[1] - cy)).sort((a, b) => a - b);
    const rMax = dists[Math.floor(dists.length * 0.97)] || 0;
    const innen = punkte.filter(p => Math.hypot(p[0] - cx, p[1] - cy) <= rMax * 1.02);
    cx = innen.reduce((a, p) => a + p[0], 0) / innen.length;
    cy = innen.reduce((a, p) => a + p[1], 0) / innen.length;
  }
  // Bull-Kern: dunkelster Schwerpunkt im Innenbereich
  let bsum = 0, bx = 0, by = 0;
  const distsAll = punkte.map(p => Math.hypot(p[0] - cx, p[1] - cy)).sort((a, b) => a - b);
  const rEst0 = distsAll[distsAll.length - 1] || 1;
  const maxGrau = Math.max((maxR + maxG + maxB) / 3, 1);
  const fenster = Math.max(4, rEst0 * 0.22);
  for (let y = Math.max(0, cy - fenster) | 0; y < Math.min(H, cy + fenster); y++) {
    for (let x = Math.max(0, cx - fenster) | 0; x < Math.min(W, cx + fenster); x++) {
      const i = (y * W + x) * 4;
      const grauN = ((D[i] + D[i + 1] + D[i + 2]) / 3) * 255 / maxGrau;
      if (grauN < 70) { const w = (70 - grauN) * (70 - grauN); bsum += w; bx += x * w; by += y * w; }
    }
  }
  if (bsum > 30) { cx = bx / bsum; cy = by / bsum; }
  // Radius: aeusserste Sektoren-Pixel je Strahl (24 Winkel), Median
  const rand = [];
  for (let a = 0; a < 24; a++) {
    const rad = a / 24 * 2 * Math.PI;
    for (let rr = rEst0 * 1.08; rr > rEst0 * 0.3; rr -= 1) {
      const x = Math.round(cx + Math.cos(rad) * rr), y = Math.round(cy + Math.sin(rad) * rr);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      if (istRotPx(D[i], D[i + 1], D[i + 2]) || istGruenPx(D[i], D[i + 1], D[i + 2])) { rand.push(rr); break; }
    }
  }
  rand.sort((a, b) => a - b);
  const r = rand.length >= 12 ? rand[Math.floor(rand.length / 2)] : rEst0;
  return { cx, cy, r, n, strahlen: rand.length };
}
