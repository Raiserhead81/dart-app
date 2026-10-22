// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Segment-Definitionen: ein Wurf ist immer ein Segment (Triple/Double/Single/Miss/Bull).
// Kompakte Wurf-Codes: 'T20', 'D5', '20', '25' ( outer bull ), '50' ( bull ), 'MISS'.

export const SECTOR_ORDER = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];

export const KIND_TRIPLE = 'triple';
export const KIND_DOUBLE = 'double';
export const KIND_SINGLE = 'single';
export const KIND_MISS = 'miss';
export const KIND_BULL = 'bull';    // 50 (inner bull, zaehlt als Doppel)
export const KIND_OUTER = 'outer';  // 25

// Alle klickbaren Segmente des Boards (Reihenfolge wie UI-Grid)
export function allBoardSegments() {
  const out = [];
  for (const n of SECTOR_ORDER) {
    out.push({ kind: KIND_TRIPLE, number: n });
  }
  for (const n of SECTOR_ORDER) {
    out.push({ kind: KIND_DOUBLE, number: n });
  }
  out.push({ kind: KIND_BULL, number: 50 });
  out.push({ kind: KIND_OUTER, number: 25 });
  for (const n of SECTOR_ORDER) {
    out.push({ kind: KIND_SINGLE, number: n });
  }
  return out;
}

export function segmentValue(kind, number) {
  switch (kind) {
    case KIND_TRIPLE: return number * 3;
    case KIND_DOUBLE: return number * 2;
    case KIND_SINGLE: return number;
    case KIND_BULL: return 50;
    case KIND_OUTER: return 25;
    default: return 0; // miss
  }
}

export function segmentCode(kind, number) {
  switch (kind) {
    case KIND_TRIPLE: return 'T' + number;
    case KIND_DOUBLE: return 'D' + number;
    case KIND_BULL: return '50';
    case KIND_OUTER: return '25';
    case KIND_MISS: return 'MISS';
    default: return String(number);
  }
}

export function segmentLabel(kind, number) {
  switch (kind) {
    case KIND_TRIPLE: return 'Triple ' + number;
    case KIND_DOUBLE: return 'Doppel ' + number;
    case KIND_SINGLE: return number;
    case KIND_BULL: return 'Bull (50)';
    case KIND_OUTER: return 'Außen-Bull (25)';
    default: return 'Daneben';
  }
}

export function isDoubleLike(thr) {
  return thr.k === KIND_DOUBLE || thr.k === KIND_BULL;
}

// Wurf-Objekt: { c: code, k: kind, n: number, v: value }
export function makeThrow(kind, number) {
  const t = { c: segmentCode(kind, number), k: kind, n: number, v: segmentValue(kind, number) };
  if (kind === KIND_MISS) { t.n = 0; t.v = 0; }
  return t;
}

// Freier Zahlen-/Code-Eingang: 'T20' | 'D5' | '60' (Summe) | 'miss'
// Rueckgabe: echtes Segment ODER Summen-Wurf { k:'sum' } (kein Segment-Detail bekannt).
export function parseThrowInput(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  if (s === 'miss' || s === 'x' || s === '0') return makeThrow(KIND_MISS, 0);
  const m = s.match(/^([sdt])\s*?(\d{1,3})$/);
  if (m) {
    const num = parseInt(m[2], 10);
    if (num < 1 || num > 20) return null;
    if (m[1] === 't') return makeThrow(KIND_TRIPLE, num);
    if (m[1] === 'd') return makeThrow(KIND_DOUBLE, num);
    return makeThrow(KIND_SINGLE, num);
  }
  if (s === '50' || s === 'bull' || s === 'be') return makeThrow(KIND_BULL, 50);
  if (s === '25') return makeThrow(KIND_OUTER, 25);
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) return null;
  if (n === 50) return makeThrow(KIND_BULL, 50);
  if (n === 25) return makeThrow(KIND_OUTER, 25);
  if (n >= 1 && n <= 60) return { c: String(n), k: 'sum', n: null, v: n };
  return null;
}

// Aufteilungsvorschlag einer Summe in klassische Segmente (nur Anzeige).
export function splitHint(sum) {
  const out = [];
  let rest = sum;
  for (const t of [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
    while (rest >= t * 3 && out.filter(x => x[0] === 'T').length < 3) {
      out.push('T' + t); rest -= t * 3;
    }
  }
  if (rest === 50) { out.push('50'); rest = 0; }
  while (rest >= 2 && rest <= 40 && rest % 2 === 0) { out.push('D' + (rest / 2)); rest = 0; break; }
  while (rest > 0) { out.push(String(rest)); rest = 0; }
  return out;
}
