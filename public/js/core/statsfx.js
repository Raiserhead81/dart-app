// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Statistik-Effekte (pure): Easing fuer Count-Up + Trend-Prognose fuer den Chart-Chip.

export function easeOutCubic(t) {
  const x = Math.min(1, Math.max(0, Number(t) || 0));
  return 1 - Math.pow(1 - x, 3);
}

// Zaehl-Anim: Zahlenwert bei Fortschritt p (0..1) fuer ein Ziel formatieren.
// Behaengt Suffixe (%), Komma-Dezimal bleibt deutsches Format.
export function countFormat(target, p, decimals = null) {
  const d = decimals != null ? decimals : (String(target).includes('.') ? 1 : 0);
  const v = (Number(target) || 0) * easeOutCubic(p);
  return v.toFixed(d).replace('.', ',');
}

// Lineare Trend-Prognose: aus den letzten avg3-Werten (Woche fuer Woche) Steigung
// schaetzen und avg bei +horizon Wochen voraussagen (gekappt auf plausible Werte).
export function trendProjection(values, horizon = 4) {
  const pts = (values || []).map((v, i) => [i, v]).filter(([_, v]) => v != null);
  const n = pts.length;
  if (n < 3) return null;
  const meanX = pts.reduce((a, p) => a + p[0], 0) / n;
  const meanY = pts.reduce((a, p) => a + p[1], 0) / n;
  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - meanX) * (y - meanY); den += (x - meanX) ** 2; }
  if (den === 0) return null;
  const slope = num / den;
  const lastX = pts[n - 1][0];
  const lastY = pts[n - 1][1];
  const projected = Math.max(0, Math.min(120, lastY + slope * horizon));
  return {
    slope: Math.round(slope * 100) / 100,
    direction: slope > 0.15 ? 'up' : slope < -0.15 ? 'down' : 'flat',
    projected: Math.round(projected * 10) / 10,
    horizon
  };
}
