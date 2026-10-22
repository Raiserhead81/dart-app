// Wochen-Verlauf als schlanke SVG-Kurve (keine Lib).

const W = 760, H = 240, PAD = { l: 40, r: 12, t: 14, b: 26 };

export function lineChart(series, { height = H, yMin = null, yMax = null } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('role', 'img');
  const n = Math.max(...series.map(s => s.values.length));
  if (!n || n === 0) return svg;

  let lo = yMin, hi = yMax;
  if (lo == null || hi == null) {
    const all = series.flatMap(s => s.values.filter(v => v != null));
    lo = yMin ?? (all.length ? Math.min(...all) : 0);
    hi = yMax ?? (all.length ? Math.max(...all) : 1);
    if (hi === lo) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
  }

  const x = i => PAD.l + (n === 1 ? 0 : i * (W - PAD.l - PAD.r) / (n - 1));
  const y = v => PAD.t + (height - PAD.t - PAD.b) * (1 - (v - lo) / (hi - lo));

  // Gitter + Y-Labels
  for (let g = 0; g <= 3; g++) {
    const v = lo + (hi - lo) * g / 3;
    const yy = y(v);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', PAD.l); line.setAttribute('x2', W - PAD.r);
    line.setAttribute('y1', yy); line.setAttribute('y2', yy);
    line.setAttribute('stroke', '#243129'); line.setAttribute('stroke-width', 1);
    svg.append(line);
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', PAD.l - 6); t.setAttribute('y', yy + 4);
    t.setAttribute('text-anchor', 'end'); t.setAttribute('fill', '#8fa096');
    t.setAttribute('font-size', 11);
    t.textContent = Math.round(v * 10) / 10;
    svg.append(t);
  }

  // X-Labels (jede 2. Woche)
  const labels = series[0].labels || [];
  labels.forEach((l, i) => {
    if (i % 2) return;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('x', x(i)); t.setAttribute('y', height - 8);
    t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', '#8fa096');
    t.setAttribute('font-size', 11);
    t.textContent = l;
    svg.append(t);
  });

  for (const s of series) {
    let d = '', started = false;
    s.values.forEach((v, i) => {
      if (v == null) { started = false; return; }
      d += (started ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      started = true;
    });
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d || 'M0 0');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', s.color);
    p.setAttribute('stroke-width', 2.4);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
    // Punkte
    s.values.forEach((v, i) => {
      if (v == null) return;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('cx', x(i)); c.setAttribute('cy', y(v)); c.setAttribute('r', 3);
      c.setAttribute('fill', s.color);
      c.append(Object.assign(document.createElementNS('http://www.w3.org/2000/svg', 'title'), { textContent: `${labels[i]}: ${v}` }));
      svg.append(c);
    });
  }
  return svg;
}
