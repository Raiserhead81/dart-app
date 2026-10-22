import { describe, it, expect } from 'vitest';
import { padThrow, padSpecial, pushSnapshot, popSnapshot, checkoutLine, HAPTIC } from '../src/pad.js';
import { newX01, applyDart } from '../src/x01.js';
import { makeThrow } from '../src/segments.js';

const T = n => makeThrow('triple', n);
const S = n => makeThrow('single', n);
const D = n => makeThrow('double', n);

describe('Pad-Eingabe: Zahl zaehlt SOFORT (ohne Bestaetigungs-Klick)', () => {
  it('ein Tap erzeugt den kompletten Wurf je Modus', () => {
    expect(padThrow('single', 20).v).toBe(20);
    expect(padThrow('double', 16).v).toBe(32);
    expect(padThrow('triple', 20).v).toBe(60);
  });
  it('Sondertasten: T20, 25, Bull, Miss', () => {
    expect(padSpecial('t20').v).toBe(60);
    expect(padSpecial('25').v).toBe(25);
    expect(padSpecial('bull').v).toBe(50);
    expect(padSpecial('miss').v).toBe(0);
  });
  it('Auto-Weiter nach 3 Darts ohne Bestaetigung: Spielerwechsel geschieht automatisch', () => {
    const s = newX01({ start: 501, players: ['A', 'B'] });
    applyDart(s, T(20));
    applyDart(s, T(20));
    const ev = applyDart(s, T(20)); // 3. Pad-Tap, kein Klick noetig
    expect(ev.type).toBe('turn');
    expect(s.current).toBe(1);
  });
  it('Undo stellt den Zustand vor dem letzten Wurf wieder her', () => {
    const s = newX01({ start: 501, players: ['A'] });
    const snapshots = [];
    pushSnapshot(snapshots, s);
    applyDart(s, T(20));
    expect(s.leg.remaining[0]).toBe(441);
    const prev = popSnapshot(snapshots);
    expect(prev.leg.remaining[0]).toBe(501);
    expect(snapshots.length).toBe(0);
  });
  it('Checkout-Zeile: dauerhaft ab 170, gekuerzt auf verbleibende Darts', () => {
    const suggest = (r, d) => (r === 170 && d === 3 ? ['T20', 'T20', 'Bull'] : r === 170 && d === 1 ? ['T20'] : null);
    expect(checkoutLine(170, 3, false, suggest)).toBe('T20 T20 Bull');
    expect(checkoutLine(170, 1, true, suggest)).toBe('T20  (for the match)');
    expect(checkoutLine(200, 3, false, suggest)).toBeNull();
  });
  it('Haptik-Muster definiert', () => {
    expect(HAPTIC.tap).toBeGreaterThan(0);
    expect(HAPTIC.oneEighty.length).toBeGreaterThan(2);
  });
});
