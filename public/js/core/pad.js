// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Spielbildschirm-Eingabe (pure): Zahlenpad zählt SOFORT, kein Bestaetigungs-Klick.
// "Zahl = zaehlt sofort": ein Tap auf 1..20 (+ aktueller Modus Single/Doppel/Triple)
// erzeugt den kompletten Wurf. 25/Bull/Miss sind eigene Taps.

import { KIND_BULL, KIND_DOUBLE, KIND_MISS, KIND_OUTER, KIND_SINGLE, KIND_TRIPLE, makeThrow } from './segments.js';

export const PAD_MODES = { single: KIND_SINGLE, double: KIND_DOUBLE, triple: KIND_TRIPLE };

// Pad-Tap -> Wurf (sofort, ohne Bestaetigung)
export function padThrow(mode, number) {
  const kind = PAD_MODES[mode] || KIND_SINGLE;
  return makeThrow(kind, number);
}

// Werte der Sondertasten
export function padSpecial(key) {
  if (key === 'miss') return makeThrow(KIND_MISS, 0);
  if (key === '25') return makeThrow(KIND_OUTER, 25);
  if (key === 'bull') return makeThrow(KIND_BULL, 50);
  if (key === 't20') return makeThrow(KIND_TRIPLE, 20);
  return null;
}

// Haptik-Muster je Ereignis (UI ruft navigator.vibrate(pattern) mit diesen Werten)
export const HAPTIC = {
  tap: 12,
  bust: [20, 40, 20],
  oneEighty: [40, 60, 40, 60, 120],
  gameShot: [60, 80, 60, 80, 200]
};

// Undo-Helfer (Session-Snapshots, pure)
export function pushSnapshot(snapshots, state, max = 60) {
  snapshots.push(JSON.stringify(state));
  if (snapshots.length > max) snapshots.shift();
}

export function popSnapshot(snapshots) {
  return snapshots.length ? JSON.parse(snapshots.pop()) : null;
}

// Checkout-Vorschau-Text fuer den laufenden Visit (dauerhaft sichtbar wenn <= 170)
export function checkoutLine(rest, dartsLeft, forMatch, suggest) {
  if (rest > 170 || rest < 2) return null;
  const route = suggest(rest, dartsLeft);
  if (!route) return null;
  return route.join(' ') + (forMatch ? '  (for the match)' : '');
}
