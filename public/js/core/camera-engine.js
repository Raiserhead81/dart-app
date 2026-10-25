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

  // ===== v5: PFEIL ALS STARRER KOERPER (3D-Modell-Ansatz) =====
  // Der Pfeil ist ein LANGGESTRECKTES Objekt: PCA-Hauptachse = Pfeilachse.
  // Breitenprofil entlang der Achse: SPITZE schmal, Schaft duenn, FLIGHT breit.
  // Trefferpunkt = schmales Ende (Schnitt Pfeilachse x Scheibenebene).
  let mx = 0, my = 0;
  for (const p of px) { mx += p[0]; my += p[1]; }
  mx /= px.length; my /= px.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of px) { const dx = p[0] - mx, dy = p[1] - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  let theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  if (Math.abs(sxy) < 1e-6) theta = sxx >= syy ? 0 : Math.PI / 2;
  const ct = Math.cos(theta), st = Math.sin(theta);
  // Projektionen auf die Pfeilachse (pos) + Breite (quer)
  const entlang = px.map(p => (p[0] - mx) * ct + (p[1] - my) * st);
  const quer = px.map(p => -(p[0] - mx) * st + (p[1] - my) * ct);
  let pmin = Infinity, pmax = -Infinity;
  for (const e of entlang) { if (e < pmin) pmin = e; if (e > pmax) pmax = e; }
  const laenge = pmax - pmin;
  // Breitenprofil: 8 Bnder entlang der Achse
  const baender = 8;
  const breite = new Array(baender).fill(0);
  const summen = new Array(baender).fill(0);
  for (let k = 0; k < px.length; k++) {
    const band = Math.min(baender - 1, Math.max(0, Math.floor((entlang[k] - pmin) / laenge * baender)));
    breite[band] += Math.abs(quer[k]);
    summen[band]++;
  }
  for (let k = 0; k < baender; k++) breite[k] = summen[k] ? breite[k] / summen[k] : 0;
  // Spitze = das ENDE mit dem SCHMALEN Band (Flight = breites Ende).
  // Vergleich: erstes vs letztes Band (mit Mittelung gegen Rauschen)
  const vorn = (breite[0] + breite[1]) / 2;
  const hinten = (breite[baender - 1] + breite[baender - 2]) / 2;
  let spitzeT; // 0 = vorne (pmin), 1 = hinten (pmax)
  if (vorn < hinten * 0.75) spitzeT = 0;          // vorne deutlich schmaler -> Spitze vorn
  else if (hinten < vorn * 0.75) spitzeT = 1;     // hinten schmaler -> Spitze hinten
  else spitzeT = null;                            // unklar (Pfeil fast frontal)
  // Spitzenposition entlang der Achse + Rueckrechnung in Bildpixel
  let ax, ay;
  if (spitzeT === 0) { const t = pmin + laenge * 0.08; ax = mx + t * ct; ay = my + t * st; }
  else if (spitzeT === 1) { const t = pmax - laenge * 0.08; ax = mx + t * ct; ay = my + t * st; }
  else { ax = mx; ay = my; } // frontal: Schwerpunkt
  // Feinverfeinerung: gewichteter Schwerpunkt der 25% Pixel am Spitzenende
  const grenzT = spitzeT === 1 ? pmax - laenge * 0.25 : pmin + laenge * 0.25;
  let sw = 0, sx2 = 0, sy2 = 0;
  for (let k = 0; k < px.length; k++) {
    const istSpitzenende = spitzeT === 1 ? entlang[k] >= grenzT : entlang[k] <= grenzT;
    if (istSpitzenende || spitzeT === null) { sw += px[k][2]; sx2 += px[k][0] * px[k][2]; sy2 += px[k][1] * px[k][2]; }
  }
  const fx = sw > 0 ? sx2 / sw : ax, fy = sw > 0 ? sy2 / sw : ay;
  // Spitzen-Schaetzung: 60% Achsen-Endpunkt (starrer Koerper) + 40% Pixel-Schwerpunkt
  return { x: ax * 0.6 + fx * 0.4, y: ay * 0.6 + fy * 0.4, staerke: maxD, pixel: px.length, pfeilachse: Math.round(theta * 180 / Math.PI), spitzenende: spitzeT };
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
  let sx = 0, sy = 0, n = 0, rotN = 0, gruenN = 0;
  for (let y = 2; y < H - 2; y += 1) {
    for (let x = 2; x < W - 2; x += 1) {
      const i = (y * W + x) * 4;
      if (istRotPx(D[i], D[i + 1], D[i + 2])) { punkte.push([x, y]); sx += x; sy += y; n++; rotN++; }
      else if (istGruenPx(D[i], D[i + 1], D[i + 2])) { punkte.push([x, y]); sx += x; sy += y; n++; gruenN++; }
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
  // v6: Bild des echten Kreismittelpunkts M' = Zentroid des GRUENEN 25er-Rings
  // (gruener Ring ums Bull; einziger gruen-privater Bereich unter 0.45*r, Triple-
  // Band beginnt erst bei 0.527*r). Bei Schraegsicht liegt M' bis ~0.4*r vom
  // Ellipsenzentrum entfernt - dunkle Zentroid-Fenster scheitern daran (Singles!).
  let bullM = null;
  {
    // Grobrichtung: Zentroid aller gruenen Pixel im Ellipsen-Inneren (Tilt-Richtung)
    // Feinsuche: 1D-Scan in dieser Richtung - der 25er-Ring ist der EINZIGE gruene
    // Cluster mit gruen-freier Umgebung ( zwischen 0.094r und 0.527r liegt kein Gruen,
    // Triple-Cluster hat dagegen immer weiteres Gruen daneben).
    const ctG = Math.cos(ellipse ? ellipse.theta : 0), stG = Math.sin(ellipse ? ellipse.theta : 0);
    const RXg = ellipse ? ellipse.rx : r, RYg = ellipse ? ellipse.ry : r;
    let gs = 0, gxs = 0, gys = 0;
    const gruenPx = [];
    const fwG = r * 0.62;
    for (let y = Math.max(0, cy - fwG) | 0; y <= Math.min(H - 1, cy + fwG); y++) {
      for (let x = Math.max(0, cx - fwG) | 0; x <= Math.min(W - 1, cx + fwG); x++) {
        const dx = x - cx, dy = y - cy;
        const u = (dx * ctG + dy * stG) / RXg, v = (-dx * stG + dy * ctG) / RYg;
        if (u * u + v * v > 0.48 * 0.48) continue;
        const i = (y * W + x) * 4;
        if (istGruenPx(D[i], D[i + 1], D[i + 2])) {
          gruenPx.push([x, y]); gxs += x; gys += y; gs++;
        }
      }
    }
    if (gs > 5) {
      const istGr = (x, y) => {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        const i = (y * W + x) * 4;
        return istGruenPx(D[i], D[i + 1], D[i + 2]);
      };
      let bestScore = -1e9, bestXY = null;
      const rKern = Math.max(2, r * 0.11), rFrei = r * 0.30;
      // 16 Richtungen scannen: das Gruen-Zentroid zeigt bei Schraegsicht zur
      // Triple-Masse, NICHT zum Bull - Richtung ist unzuverlaessig
      for (let ri = 0; ri < 16; ri++) {
        const dxr = Math.cos(ri * Math.PI / 8), dyr = Math.sin(ri * Math.PI / 8);
        for (let t = 0; t <= r * 0.45; t += 1) {
          const zx = cx + dxr * t, zy = cy + dyr * t;
          let drin = 0, frei = 0;
          for (const [px, py] of gruenPx) {
            const dd = Math.hypot(px - zx, py - zy);
            if (dd <= rKern) drin++;
            else if (dd <= rFrei) frei++;
          }
          const score = drin - 2 * frei;
          if (score > bestScore) { bestScore = score; bestXY = [zx, zy]; }
        }
      }
      if (bestXY && bestScore > 3) bullM = bestXY;
    }
  }
  // v6: projektive Homographie aus Ellipse + Bull-Versatz (echte Schraegsicht-Korrektur)
  const h = ellipse && bullM ? baueHomographie(ellipse.cx, ellipse.cy, ellipse.rx, ellipse.ry, ellipse.theta, bullM[0], bullM[1]) : null;
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
      // v6: projektiv mappen (Homographie falls vorhanden, sonst affine Ellipse)
      const p = normierraumZuBild(nx, ny, { cx, cy, rx: RX, ry: RY, theta: TH, h });
      const x = Math.round(p.x), y = Math.round(p.y);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      const [hsv, sv, vv] = rgb2hsv(D[i] * 255 / maxR, D[i + 1] * 255 / maxG, D[i + 2] * 255 / maxB);
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

  // ===== ECHTHEITS-CHECK: Dartscheibe oder Fremdbild (TV/Foto/Wand)? =====
  // Echte Scheibe: Farben NUR in Triple-Band (0.45-0.68) + Double-Band (0.88-1.05),
  // 20-fache rot/gruen-Alternanz, dunkle Board-Umrandung ausserhalb, Balance ~50/50.
  const ncal = { cx, cy, rx: ellipse ? ellipse.rx : r, ry: ellipse ? ellipse.ry : r, theta: ellipse ? ellipse.theta : 0, h };
  let inBand = 0;
  for (const p of punkte) {
    const q = inNormierraum(p[0], p[1], ncal);
    const pr = Math.hypot(q.u, q.v);
    if ((pr >= 0.45 && pr <= 0.68) || (pr >= 0.88 && pr <= 1.05)) inBand++;
  }
  const ringAnteil = n ? inBand / n : 0;
  const NX = ncal.rx, NY = ncal.ry, NTH = ncal.theta;
  const binRot = new Array(20).fill(0), binGruen = new Array(20).fill(0);
  for (let t = 0; t < 360; t += 3) {
    const rad2 = (t - 90) * Math.PI / 180;
    for (const f of [0.58, 0.96]) {
      const nx = Math.cos(rad2) * f, ny = Math.sin(rad2) * f;
      // v6: projektives Sampling - affin wuerde bei Schraegsicht Winkel-Bins verschieben
      const bp = normierraumZuBild(nx, ny, ncal);
      const x = Math.round(bp.x), y = Math.round(bp.y);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = (y * W + x) * 4;
      if (istRotPx(D[i], D[i + 1], D[i + 2])) binRot[Math.round(t / 18) % 20]++;
      else if (istGruenPx(D[i], D[i + 1], D[i + 2])) binGruen[Math.round(t / 18) % 20]++;
    }
  }
  let wechsel = 0;
  const cols = [];
  for (let k = 0; k < 20; k++) {
    const tot = binRot[k] + binGruen[k];
    cols.push(tot ? (binRot[k] >= binGruen[k] ? 1 : 0) : null);
  }
  for (let k = 0; k < 20; k++) {
    if (cols[k] !== null && cols[(k + 1) % 20] !== null && cols[k] !== cols[(k + 1) % 20]) wechsel++;
  }
  const alternanz = wechsel / 20;
  let dunkel = 0, randN = 0;
  for (let t = 0; t < 360; t += 10) {
    const rad2 = (t - 90) * Math.PI / 180;
    for (const f of [1.06, 1.12, 1.18]) {
      const nx = Math.cos(rad2) * f, ny = Math.sin(rad2) * f;
      const x = Math.round(cx + (nx * NX * Math.cos(NTH) - ny * NY * Math.sin(NTH)));
      const y = Math.round(cy + (nx * NX * Math.sin(NTH) + ny * NY * Math.cos(NTH)));
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = (y * W + x) * 4;
      const grauN = ((D[i] + D[i + 1] + D[i + 2]) / 3) * 255 / maxGrau;
      if (grauN < 60) dunkel++;
      randN++;
    }
  }
  const randDunkel = randN ? dunkel / randN : 0;
  const farbSumme = rotN + gruenN;
  const balance = farbSumme ? Math.min(rotN, gruenN) / farbSumme : 0;
  let qualitaet = Math.min(1, ringAnteil / 0.75) * 40 + alternanz * 30 + randDunkel * 15 + Math.min(1, balance / 0.42) * 15;
  // K.O.: weder Ringstruktur noch Sektorwechsel => kein Board, egal wie der Rest aussieht
  if ((ringAnteil < 0.5 && alternanz < 0.65) || randDunkel < 0.08) qualitaet = Math.min(qualitaet, 45);
  // v6: projektive Homographie aus Ellipse + Bull-Versatz (echte Schraegsicht-Korrektur)
  return { cx, cy, r, rx: ellipse ? ellipse.rx : r, ry: ellipse ? ellipse.ry : r, theta: ellipse ? ellipse.theta : 0, aspekt: ellipse ? ellipse.aspekt : 1, rot, n, strahlen: rand.length, qualitaet: Math.round(qualitaet), ringAnteil: +ringAnteil.toFixed(2), alternanz, randDunkel: +randDunkel.toFixed(2), balance: +balance.toFixed(2), h };
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

// ---------- PROJEKTIVE KORREKTUR (Homographie) ----------
// Eine schraeg gefilmte Scheibe projiziert sich als Homographie (nicht affin):
// Der Kreismittelpunkt (Bull) bildet sich NICHT aufs Ellipsenzentrum ab. Diese
// Verschiebung liefert den fehlenden Parameter - ganz ohne Kamera-Intrinsics.
// H bildet Normierraum (Einheitskreis) -> Bild ab: H = S * B(psi,phi),
// S = T*R(theta)*diag(rx,ry,1) (affin), B = Lorentz-"Boost", der den Kreis invariant laesst.
// Bild des Mittelpunkts: C + R(theta)*(rx*tanh(psi)*cos(phi), ry*tanh(psi)*sin(phi)).
function m3mul(A, B) {
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    let s = 0; for (let k = 0; k < 3; k++) s += A[i][k] * B[k][j]; R[i][j] = s;
  }
  return R;
}

export function baueHomographie(cx, cy, rx, ry, theta, mx, my) {
  if (!rx || !ry || !isFinite(mx) || !isFinite(my)) return null;
  const ct = Math.cos(-theta), st = Math.sin(-theta);
  const dx = mx - cx, dy = my - cy;
  const u = (dx * ct - dy * st) / rx, v = (dx * st + dy * ct) / ry;
  const tp = Math.hypot(u, v); // = tanh(psi)
  if (tp >= 0.6) return null; // Bull-Messung unplausibel (zu weit weg) -> frontal bleiben
  if (tp < 0.03) return null; // frontal: affine Ellipse reicht, h unnoetig
  const phi = Math.atan2(v, u);
  const chh = Math.sqrt(1 - tp * tp), sinh = tp / chh, cosh = 1 / chh;
  const cp = Math.cos(phi), sp = Math.sin(phi);
  const B = m3mul(m3mul([[cp, -sp, 0], [sp, cp, 0], [0, 0, 1]], [[cosh, 0, sinh], [0, 1, 0], [sinh, 0, cosh]]), [[cp, sp, 0], [-sp, cp, 0], [0, 0, 1]]);
  const ct2 = Math.cos(theta), st2 = Math.sin(theta);
  const S = [[rx * ct2, -ry * st2, cx], [rx * st2, ry * ct2, cy], [0, 0, 1]];
  return m3mul(S, B);
}

// Normierraum -> Bild (Video-Pixel). Ohne h: affine Rueckabbildung.
export function normierraumZuBild(u, v, c) {
  if (c && c.h) {
    const H = c.h;
    const X = H[0][0] * u + H[0][1] * v + H[0][2];
    const Y = H[1][0] * u + H[1][1] * v + H[1][2];
    const Z = H[2][0] * u + H[2][1] * v + H[2][2];
    if (Math.abs(Z) > 1e-9) return { x: X / Z, y: Y / Z };
  }
  const rx = c.rx || c.r || 1, ry = c.ry || c.r || 1, th = c.theta || 0;
  const ct = Math.cos(th), st = Math.sin(th);
  return { x: c.cx + u * rx * ct - v * ry * st, y: c.cy + u * rx * st + v * ry * ct };
}

// Bildpunkt -> Normierraum (Einheitskreis der Scheibe).
// v6: mit cal.h echte Homographie (projektiv), sonst affine Ellipse wie zuvor.
export function inNormierraum(x, y, c) {
  if (c && c.h) {
    const H = c.h;
    // loese H*(u,v,1) ∝ (x,y,1): 2x2-System nach Umstellen ( projektive Terme! )
    const a = H[0][0], b = H[0][1], c0 = H[0][2];
    const d = H[1][0], e = H[1][1], f0 = H[1][2];
    const g = H[2][0], h2 = H[2][1], i0 = H[2][2];
    const a2 = a - x * g, b2 = b - x * h2, r2 = x * i0 - c0;
    const d2 = d - y * g, e2 = e - y * h2, s2 = y * i0 - f0;
    const det = a2 * e2 - b2 * d2;
    if (Math.abs(det) > 1e-12) {
      const u = (r2 * e2 - b2 * s2) / det;
      const v = (-r2 * d2 + a2 * s2) / det;
      return { u, v };
    }
  }
  const rx = c.rx || c.r || 1, ry = c.ry || c.r || 1;
  const th = c.theta || 0;
  const dx = x - c.cx, dy = y - c.cy;
  const ct = Math.cos(-th), st = Math.sin(-th);
  const ux = (dx * ct - dy * st) / rx;
  const uy = (dx * st + dy * ct) / ry;
  return { u: ux, v: uy };
}
