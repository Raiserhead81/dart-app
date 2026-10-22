// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Checkout-Tabelle (Double-Out). Bekannte klassische Routen sind hart hinterlegt,
// alles andere liefert ein Suchverfahren mit Profi-Praeferenz.
// Route-Format: Array von Wurf-Codes, z.B. ['T20','T20','50'].

const IMPOSSIBLE = new Set([159, 162, 163, 165, 166, 168, 169]);

// Klassische Routen (110-170 + haessliche Kleinzahlen des Algorithmus ueberschrieben)
const CLASSIC = {
  3: '1 D1', 5: '1 D2', 7: '3 D2', 9: '1 D4', 11: '3 D4', 13: '5 D4', 15: '7 D4',
  17: '9 D4', 19: '11 D4', 21: '13 D4', 23: '7 D8', 25: '9 D8', 27: '19 D4',
  29: '13 D8', 31: '15 D8', 33: '17 D8', 35: '3 D16', 37: '5 D16', 39: '7 D16',
  41: '9 D16', 42: '10 D16', 43: '11 D16', 44: '12 D16', 45: '13 D16', 46: '14 D16',
  47: '15 D16', 48: '16 D16', 49: '17 D16', 51: '11 D20', 52: '12 D20', 53: '13 D20',
  54: '14 D20', 55: '15 D20', 56: '16 D20', 57: '17 D20', 58: '18 D20', 59: '19 D20',
  61: '25 D18', 60: '20 D20', 65: '25 D20', 82: 'Bull D16', 99: 'T20 19 D10',
  102: 'T20 10 D16', 103: 'T20 3 D20', 105: 'T20 5 D20', 106: 'T20 6 D20',
  108: 'T20 8 D20', 109: 'T20 9 D20',
  110: 'T20 Bull', 111: 'T20 11 D20', 112: 'T20 12 D20', 113: 'T20 13 D20',
  114: 'T20 14 D20', 115: 'T20 15 D20', 116: 'T20 16 D20', 117: 'T20 17 D20',
  118: 'T20 18 D20', 119: 'T20 19 D20', 120: 'T20 20 D20', 121: 'T20 11 Bull',
  122: 'T18 18 Bull', 123: 'T19 16 Bull', 124: 'T20 14 Bull', 125: '25 T20 D20',
  126: 'T19 19 Bull', 127: 'T20 17 Bull', 128: 'T20 18 Bull', 129: 'T20 19 Bull',
  130: 'T20 20 Bull', 131: 'T20 T19 D7', 132: 'T20 T16 D12', 133: 'T20 T19 D8',
  134: 'T20 T18 D10', 135: 'T20 25 Bull', 136: 'T20 T20 D8', 137: 'T20 T19 D10',
  138: 'T20 T18 D12', 139: 'T20 T17 D14', 140: 'T20 T20 D10', 141: 'T20 T15 D18',
  142: 'T20 T14 D20', 143: 'T20 T17 D16', 144: 'T20 T20 D12', 145: 'T20 T19 D14',
  146: 'T20 T18 D16', 147: 'T20 T17 D18', 148: 'T20 T16 D20', 149: 'T20 T19 D16',
  150: 'T20 T18 D18', 151: 'T20 T17 D20', 152: 'T20 T20 D16', 153: 'T20 T19 D18',
  154: 'T20 T18 D20', 155: 'T20 T19 D19', 156: 'T20 T20 D18', 157: 'T20 T19 D20',
  158: 'T20 T20 D19', 160: 'T20 T20 D20', 161: 'T20 T17 Bull', 164: 'T20 T18 Bull',
  167: 'T20 T19 Bull', 170: 'T20 T20 Bull'
};

const TRIPLES = [];
for (let n = 20; n >= 1; n--) TRIPLES.push('T' + n);
const SINGLES = [];
for (let n = 20; n >= 1; n--) SINGLES.push(String(n));
const DOUBLES = [];
for (let n = 20; n >= 1; n--) DOUBLES.push('D' + n);

// Wert eines Route-Codes
export function routeValue(code) {
  if (code === 'Bull') return 50;
  if (/^\d+$/.test(code)) return parseInt(code, 10);
  const m = code.match(/^([TD])(\d{1,2})$/);
  if (!m) return 0;
  if (m[1] === 'T') return parseInt(m[2], 10) * 3;
  return parseInt(m[2], 10) * 2;
}

function doubleFor(rest) {
  if (rest === 50) return 'Bull';
  if (rest >= 2 && rest <= 40 && rest % 2 === 0) return 'D' + (rest / 2);
  return null;
}

function parseRoute(str) {
  return str.split(' ');
}

// Haupt-API: Route fuer Rest bei Double-Out. dartsLeft begrenzt die Laenge (1-3).
export function suggestCheckout(rest, dartsLeft = 3) {
  rest = Math.floor(rest);
  if (rest < 2 || rest > 170) return null;
  const all = routeFor(rest);
  if (!all) return null;
  if (all.length > dartsLeft) {
    // Teilroute: so viele Darts wie uebrig, letzter muss kein Finish sein -> trotzdem zeigen
    return all.slice(0, dartsLeft);
  }
  return all;
}

export function checkoutTableFull(rest) {
  return routeFor(rest);
}

function routeFor(rest) {
  if (IMPOSSIBLE.has(rest)) return null;
  if (CLASSIC[rest]) return parseRoute(CLASSIC[rest]);
  // 1 Dart
  const d1 = doubleFor(rest);
  if (d1) return [d1];
  // 2 Darts: erstes Segment + Double
  const two = [...TRIPLES, '25', 'Bull', ...SINGLES];
  for (const a of two) {
    const c = doubleFor(rest - routeValue(a));
    if (c) return [a, c];
  }
  // 3 Darts
  const bOrder = [...TRIPLES, '25', 'Bull', ...SINGLES];
  for (const a of TRIPLES) {
    const r1 = rest - routeValue(a);
    if (r1 < 4) continue;
    for (const b of bOrder) {
      const r2 = r1 - routeValue(b);
      if (r2 < 2) continue;
      const c = doubleFor(r2);
      if (c) return [a, b, c];
    }
  }
  // mit Singles als erstem Dart (eher selten noetig)
  for (const a of SINGLES) {
    const r1 = rest - routeValue(a);
    if (r1 < 4) continue;
    for (const b of [...TRIPLES, '25', 'Bull', ...SINGLES]) {
      const r2 = r1 - routeValue(b);
      if (r2 < 2) continue;
      const c = doubleFor(r2);
      if (c) return [a, b, c];
    }
  }
  return null;
}

// Ist eine Route gueltig (Summe, Ende Double, keine Zwischen-Reste von 1/0/<0)?
export function validateRoute(route, rest) {
  if (!route || route.length === 0 || route.length > 3) return false;
  let remaining = rest;
  for (let i = 0; i < route.length; i++) {
    const v = routeValue(route[i]);
    if (v <= 0) return false;
    remaining -= v;
    if (i < route.length - 1) {
      if (remaining < 2) return false;
    } else {
      if (remaining !== 0) return false;
      if (route[i] !== 'Bull' && !/^D\d+$/.test(route[i])) return false;
    }
  }
  return true;
}

// Checkout-Text fuer UI: "170: T20 T20 Bull"
export function checkoutHint(rest, dartsLeft = 3) {
  const r = suggestCheckout(rest, dartsLeft);
  if (!r) return null;
  return r.join(' ');
}
