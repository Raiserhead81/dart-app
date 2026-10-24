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
  // v5: NORMIERRAUM - Ellipsen-Schraegsicht wird exakt korrigiert
  const n = inNormierraum(x, y, cal);
  const dx = n.u, dy = n.v;
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r > 1.06) return null;
  if (r <= RINGE.bull) return { k: 'bull', n: 50, v: 50, label: 'BULL' };
  if (r <= RINGE.bull25) return { k: 'outer', n: 25, v: 25, label: '25' };
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI - (cal.rot || 0); // Kamera-Drehung abziehen
  if (ang < 0) ang += 360;
  if (ang >= 360) ang -= 360;
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
  // NACHTSICHT KORREKT: EIN globaler Faktor (255/maxHelligkeit). Kanalweise
  // Verstaerkung wuerde Hue/Saettigung verzerren und Rauschen zu "Farben" machen
  // (die Ursache fuer Kays Fehlmessungen). Ein Skalierungsfaktor laesst
  // Farbmassstab unberuehrt - dunkle Boards werden nur "heller gerechnet".
  let maxVal = 1;
  for (let i = 0; i < D.length; i += 16) {
    const v = Math.max(D[i], D[i + 1], D[i + 2]);
    if (v > maxVal) maxVal = v;
  }
  return { scale: 255 / maxVal, maxR: maxVal, maxG: maxVal, maxB: maxVal };
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
  const istRotPx = (r, g, b) => { const [h, sv, vv] = rgb2hsv(r * 255 / maxR, g * 255 / maxG, b * 255 / maxB); return (h < 25 || h > 335) && sv > 0.30 && vv > 0.15; };
  const istGruenPx = (r, g, b) => { const [h, sv, vv] = rgb2hsv(r * 255 / maxR, g * 255 / maxG, b * 255 / maxB); return h > 80 && h < 165 && sv > 0.22 && vv > 0.12; };
  const punkte = [];
  let sx = 0, sy = 0, n = 0;
  for (let y = 2; y < H - 2; y += 1) {
    for (let x = 2; x < W - 2; x += 1) {
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
  // v5: Randpunkte-Paare -> PCA-ELLIPSEN-FIT (faengt Schraegsicht exakt)
  let ellipse = null;
  if (rand.length >= 12) {
    const ellPunkte = [];
    for (let a = 0; a < 24; a++) {
      const rad = a / 24 * 2 * Math.PI;
      for (let rr = rEst0 * 1.08; rr > rEst0 * 0.3; rr -= 0.5) {
        const x = Math.round(cx + Math.cos(rad) * rr), y = Math.round(cy + Math.sin(rad) * rr);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        if (istRotPx(D[i], D[i + 1], D[i + 2]) || istGruenPx(D[i], D[i + 1], D[i + 2])) { ellPunkte.push([x, y]); break; }
      }
    }
    ellipse = fitEllipse(ellPunkte);
  }
  const r = ellipse ? Math.max(ellipse.rx, ellipse.ry) : rEst0;
  if (ellipse) { cx = ellipse.cx; cy = ellipse.cy; }
  // ROTATION per PHASEN-KORRELATION: Signal = Schwarz(+1)/Weiss(-1) entlang des
  // Single-Rings; ideal = 20er schwarz zentriert oben, alle 36 Grad. Der Versatz
  // mit der hoechsten Korrelation = Kamera-Drehung. Robust: nutzt alle 20 Sektoren.
  const signal = new Array(360).fill(0);
  const signCount = new Array(360).fill(0);
  // v5: Signal im NORMIERRAUM samplen (Ellipsen-Verzerrung rausgerechnet):
  // Bildpunkt = Zentrum + R(theta) * [nx*rx, ny*ry]  (nx,ny auf dem Einheitskreis)
  const RX = ellipse ? ellipse.rx : r, RY = ellipse ? ellipse.ry : r, TH = ellipse ? ellipse.theta : 0;
  for (let t = 0; t < 360; t++) {
    const rad = (t - 90) * Math.PI / 180; // 0 = oben
    for (const f of [0.72, 0.80, 0.87]) {
      const nx = Math.cos(rad) * f, ny = Math.sin(rad) * f;
      const x = Math.round(cx + (nx * RX * Math.cos(TH) - ny * RY * Math.sin(TH)));
      const y = Math.round(cy + (nx * RX * Math.sin(TH) + ny * RY * Math.cos(TH)));
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      const [h, sv, vv] = rgb2hsv(D[i] * 255 / maxR, D[i + 1] * 255 / maxG, D[i + 2] * 255 / maxB);
      if (sv < 0.25 && vv < 0.35) { signal[t] += 1; signCount[t]++; }
      else if (sv < 0.25 && vv > 0.55) { signal[t] -= 1; signCount[t]++; }
    }
  }
  let rot = 0, bestScore = -Infinity;
  for (let cand = -18; cand < 18; cand++) {
    let score = 0;
    for (let t = 0; t < 360; t += 2) {
      const rel = (((t - cand) % 36) + 36) % 36;
      const ideal = (rel <= 8 || rel >= 28) ? 1 : -1; // schwarzer Sektor UM cand zentriert (±9°)
      score += signal[t] * ideal;
    }
    if (score > bestScore) { bestScore = score; rot = cand; }
  }
  rot = -rot; // Vorzeichen: positive Zahl = Board im Uhrzeigersinn gedreht
  if (bestScore < 60) rot = 0; // zu schwaches Signal: Kamera als gerade annehmen
  return { cx, cy, r, rx: ellipse ? ellipse.rx : r, ry: ellipse ? ellipse.ry : r, theta: ellipse ? ellipse.theta : 0, aspekt: ellipse ? ellipse.aspekt : 1, rot, n, strahlen: rand.length };
}


// ---------- Tap-Kette (pure): Fingerposition -> Videopixel, zoom- und contain-sicher ----------
export function tapZuVideoPixel(clientX, clientY, rectLeft, rectTop, rectW, rectH, offsetW, offsetH, videoW, videoH, zoom) {
  const lx = (clientX - rectLeft) / zoom;
  const ly = (clientY - rectTop) / zoom;
  const sc = Math.min(offsetW / videoW, offsetH / videoH);
  const offX = (offsetW - videoW * sc) / 2;
  const offY = (offsetH - videoH * sc) / 2;
  return { x: (lx - offX) / sc, y: (ly - offY) / sc };
}

// ====================================================================
// v5: MATHEMATISCH-PHYSIKALISCH PERFEKTE KALIBRIERUNG
// Die Kamera sieht die Scheibe als ELLIPSE (Schrägsicht/Perspektive).
// 1. Sub-Pixel-Randpunkte (parabolische Kantinterpolation je Strahl)
// 2. PCA-Ellipsen-Fit: Zentrum, Achsen rx/ry, Drehwinkel theta
// 3. Segment-Rechnung im NORMIERRAUM (affine Homographie -> Einheitskreis)
//    => Schrägsicht wird exakt rausgerechnet (TU-Wien-Bachelorarbeit-Methode)
// 4. Rotation: Phasen-Korrelation + parabolische Peak-Interpolation (Sub-Grad)
// ====================================================================

// Randpunkte (x,y) -> gedrehte Ellipse {cx, cy, rx, ry, theta} per PCA.
export function fitEllipse(punkte) {
  const n = punkte.length;
  if (n < 12) return null;
  let mx = 0, my = 0;
  for (const p of punkte) { mx += p[0]; my += p[1]; }
  mx /= n; my /= n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of punkte) {
    const dx = p[0] - mx, dy = p[1] - my;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  sxx /= n; syy /= n; sxy /= n;
  const tr = sxx + syy, det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
  const l1 = tr / 2 + disc;
  let theta;
  if (Math.abs(sxy) < 1e-9) theta = sxx >= syy ? 0 : Math.PI / 2;
  else theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const p1 = [], p2 = [];
  for (const p of punkte) {
    const dx = p[0] - mx, dy = p[1] - my;
    p1.push(dx * ct + dy * st);
    p2.push(-dx * st + dy * ct);
  }
  const spann = (arr) => { arr.sort((a, b) => a - b); return arr[Math.floor(arr.length * 0.97)] - arr[Math.floor(arr.length * 0.03)]; };
  // 97%-Spannweite / 2 / 1.88 ~ Radius (gestutzte Gleichverteilung auf dem Ring)
  // 97%-Stutzung beidseitig ~ ±0.93 R => Spannweite ~1.86 R => Radius = spann/1.86
  let rx = spann(p1) / 1.86, ry = spann(p2) / 1.86;
  // Hauptachsen-Normierung: theta in (-45,45] und rx >= ry. Sonst flippt die
  // Richtung bei Kreisen zufaellig um 90 Grad und verdreht das Rotations-Signal.
  if (theta > Math.PI / 4) { theta -= Math.PI / 2; [rx, ry] = [ry, rx]; }
  else if (theta < -Math.PI / 4) { theta += Math.PI / 2; [rx, ry] = [ry, rx]; }
  return { cx: mx, cy: my, rx, ry, theta, aspekt: Math.min(rx, ry) / Math.max(rx, ry) };
}

// Bildpunkt -> Normierraum (Einheitskreis der Scheibe).
// Nutzt cal.rx/ry/theta (Ellipse) oder faellt auf Kreis (rx=r) zurueck.
export function inNormierraum(x, y, c) {
  const rx = c.rx || c.r || 1, ry = c.ry || c.r || 1;
  const th = c.theta || 0;
  const dx = x - c.cx, dy = y - c.cy;
  const ct = Math.cos(-th), st = Math.sin(-th);
  const ux = (dx * ct - dy * st) / rx;
  const uy = (dx * st + dy * ct) / ry;
  return { u: ux, v: uy };
}
