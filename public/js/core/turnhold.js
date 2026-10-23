// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Turn-Hold (pure): Wie lange bleiben die Wurf-Pills + Visit-Score nach dem 3. Dart
// sichtbar, BEVOR die Ansicht zum naechsten Spieler weiterschaltet?
// Kays Test-Befund: Anzeige wurde sofort geleert — der 3. Wurf war unsichtbar.
// Regel: mindestens 1.2 s ODER bis der Caller-Satz fertig ist (was laenger ist).

export const TURN_HOLD_MIN_MS = 1200;

export function turnHoldMs(callerBusyMs = 0, minMs = TURN_HOLD_MIN_MS) {
  const busy = Math.max(0, Math.round(Number(callerBusyMs) || 0));
  return Math.max(minMs, busy);
}
