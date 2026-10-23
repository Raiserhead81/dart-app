// SVG-Dartboard: klickbare Segmente + Heatmap-Ansicht. Touch-Ringe verbreitert.

import { SECTOR_ORDER, segmentCode, segmentLabel } from '/js/core/segments.js';

const NS = 'http://www.w3.org/2000/svg';
const C = 200;           // Zentrum/Radius
// Touch-optimierte Ringanteile (kein Massstab, sondern Bedienbarkeit)
const RINGS = {
  bullIn: 0.055, bullOut: 0.115,
  triple: [0.55, 0.72], double: [0.86, 1.0]
};

function sectorAngle(i) {
  return (-90 + i * 18) * Math.PI / 180; // 20 oben
}

function pt(r, a) {
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

function ringPath(a0, a1, r0, r1) {
  const large = (a1 - a0) > Math.PI ? 1 : 0;
  const [x0, y0] = pt(r1, a0), [x1, y1] = pt(r1, a1);
  const [x2, y2] = pt(r0, a1), [x3, y3] = pt(r0, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} L${x2.toFixed(2)} ${y2.toFixed(2)} A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;
}

const COL = {
  black: '#15181a', cream: '#e8dfc8', red: '#c0392b', green: '#1d7a44',
  wire: '#3d4a42', text: '#0c0f0d', bull: '#2a7a4a', bullIn: '#b03227'
};

function segColor(kind, number) {
  // klassische Farbfolge: gerade Sektoren schwarz, ungerade creme; Triple/Double rot/gruen
  const isEven = number % 2 === 0;
  if (kind === 'single') return isEven ? COL.black : COL.cream;
  if (kind === 'double') return isEven ? COL.red : COL.green;
  if (kind === 'triple') return isEven ? COL.red : COL.green;
  if (kind === 'bull') return COL.bullIn;
  return COL.bull; // 25er-Ring
}

function textPathFor(i) {
  return null; // Zahlen als <text> positioniert
}

export function buildBoard({ onThrow, size = 420 } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `-30 -30 ${C * 2 + 60} ${C * 2 + 60}`);
  svg.setAttribute('class', 'dartboard');
  svg.setAttribute('width', size);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Dartboard');

  const mk = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    (parent || svg).append(e);
    return e;
  };

  // Grundplatte
  mk('circle', { cx: C, cy: C, r: C, fill: '#0c0f0d' });

  const addSeg = (kind, number, r0, r1, i, label) => {
    const a0 = sectorAngle(i) - Math.PI / 20 * 0.985;
    const a1 = sectorAngle(i) + Math.PI / 20 * 0.985;
    const p = mk('path', {
      d: ringPath(a0, a1, r0 * C, r1 * C),
      fill: segColor(kind, number),
      class: 'seg', stroke: COL.wire, 'stroke-width': 1.2
    });
    const code = segmentCode(kind, number);
    const val = kind === 'double' ? number * 2 : kind === 'triple' ? number * 3 : number;
    p.addEventListener('click', () => onThrow && onThrow({ code, kind, number, value: val, label: label || segmentLabel(kind, number) }));
    if (label !== false) {
      p.addEventListener('pointerdown', () => p.setAttribute('opacity', '.7'));
      p.addEventListener('pointerup', () => p.removeAttribute('opacity'));
    }
    return p;
  };

  SECTOR_ORDER.forEach((number, i) => {
    addSeg('double', number, RINGS.double[0], RINGS.double[1], i, false);
    addSeg('single', number, RINGS.triple[1], RINGS.double[0], i, false);
    addSeg('triple', number, RINGS.triple[0], RINGS.triple[1], i, false);
    addSeg('single', number, RINGS.bullOut, RINGS.triple[0], i, false);
  });
  // Bull
  addSeg('outer', 25, 0, RINGS.bullOut, 0, false);
  addSeg('bull', 50, 0, RINGS.bullIn, 0, false);

  // Zahlen
  SECTOR_ORDER.forEach((number, i) => {
    const a = sectorAngle(i);
    const [x, y] = pt(1.10 * C, a);
    const t = mk('text', {
      x: x.toFixed(1), y: (y + 7).toFixed(1), 'text-anchor': 'middle',
      fill: COL.cream, 'font-size': 19, 'font-weight': 700
    });
    t.textContent = number;
  });

  return svg;
}

// Heatmap-Variante: counts = { 'T20': n, ... }
export function buildHeatmap(counts = {}, { size = 340 } = {}) {
  let max = 1;
  for (const v of Object.values(counts)) max = Math.max(max, v);
  let total = 0;
  for (const v of Object.values(counts)) total += v;
  const heat = document.createElementNS(NS, 'svg');
  heat.setAttribute('viewBox', `-30 -30 ${C * 2 + 60} ${C * 2 + 60}`);
  heat.setAttribute('class', 'dartboard');
  heat.setAttribute('width', size);
  const mk = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    heat.append(e);
    return e;
  };
  mk('circle', { cx: C, cy: C, r: C, fill: '#0c0f0d' });
  const heatColor = (n) => {
    if (!n) return 'rgba(60,72,64,.25)';
    const t = Math.min(1, Math.pow(n / max, 0.6));
    const r = Math.round(46 + t * 180);
    const g = Math.round(120 + t * 60);
    const b = Math.round(70 + t * 20);
    return `rgba(${r},${g},${b},${0.35 + t * 0.65})`;
  };
  SECTOR_ORDER.forEach((number, i) => {
    const a0 = sectorAngle(i) - Math.PI / 20 * 0.985;
    const a1 = sectorAngle(i) + Math.PI / 20 * 0.985;
    const bands = [
      ['double', RINGS.double[0], RINGS.double[1]],
      ['single', RINGS.triple[1], RINGS.double[0]],
      ['triple', RINGS.triple[0], RINGS.triple[1]],
      ['single', RINGS.bullOut, RINGS.triple[0]]
    ];
    for (const [kind, r0, r1] of bands) {
      const code = segmentCode(kind, number);
      const path = mk('path', { d: ringPath(a0, a1, r0 * C, r1 * C), fill: heatColor(counts[code] || 0), stroke: COL.wire, 'stroke-width': 1, class: 'heatseg' });
      path.style.animationDelay = `${(i * 8) % 240}ms`;
      const tt = document.createElementNS(NS, 'title');
      const n = counts[code] || 0;
      tt.textContent = n ? `${code}: ${n} Darts (${Math.round(n / total * 100)}%)` : `${code}: 0`;
      path.append(tt);
    }
  });
  mk('circle', { cx: C, cy: C, r: RINGS.bullOut * C, fill: heatColor(counts['25'] || 0), stroke: COL.wire });
  mk('circle', { cx: C, cy: C, r: RINGS.bullIn * C, fill: heatColor(counts['50'] || 0), stroke: COL.wire });
  SECTOR_ORDER.forEach((number, i) => {
    const a = sectorAngle(i);
    const [x, y] = pt(1.10 * C, a);
    const t = mk('text', { x: x.toFixed(1), y: (y + 7).toFixed(1), 'text-anchor': 'middle', fill: COL.cream, 'font-size': 17, 'font-weight': 700 });
    t.textContent = number;
  });
  return heat;
}
