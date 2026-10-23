import { describe, it, expect } from 'vitest';
import { turnHoldMs, TURN_HOLD_MIN_MS } from '../src/turnhold.js';

// Kays Test: Nach dem 3. Dart muss die Anzeige (3 Pills + Visit-Score) sichtbar bleiben.
describe('Turn-Hold: dritte Zahl sichtbar halten', () => {
  it('Minimum 1,2 s auch ohne Caller-Aktivität', () => {
    expect(TURN_HOLD_MIN_MS).toBe(1200);
    expect(turnHoldMs(0)).toBe(1200);
    expect(turnHoldMs(400)).toBe(1200);
    expect(turnHoldMs(1199)).toBe(1200);
  });

  it('bis der Caller fertig ist, wenn der Satz länger als 1,2 s läuft', () => {
    expect(turnHoldMs(1201)).toBe(1201);
    expect(turnHoldMs(3400)).toBe(3400);
    expect(turnHoldMs(8000)).toBe(8000); // voller Visit-Satz mit Rest + Weg
  });

  it('robust gegen Unsinn-Eingaben', () => {
    expect(turnHoldMs()).toBe(1200);
    expect(turnHoldMs(null)).toBe(1200);
    expect(turnHoldMs(-500)).toBe(1200);
    expect(turnHoldMs(1234.7)).toBe(1235); // aufrunden auf ganze ms
  });
});
