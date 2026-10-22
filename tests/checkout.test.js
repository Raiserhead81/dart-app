import { describe, it, expect } from 'vitest';
import { suggestCheckout, checkoutTableFull, validateRoute, routeValue } from '../src/checkout.js';

const IMPOSSIBLE = [159, 162, 163, 165, 166, 168, 169];

describe('checkout table', () => {
  it('klassische Ikonen stimmen', () => {
    expect(suggestCheckout(170)).toEqual(['T20', 'T20', 'Bull']);
    expect(suggestCheckout(167)).toEqual(['T20', 'T19', 'Bull']);
    expect(suggestCheckout(164)).toEqual(['T20', 'T18', 'Bull']);
    expect(suggestCheckout(161)).toEqual(['T20', 'T17', 'Bull']);
    expect(suggestCheckout(160)).toEqual(['T20', 'T20', 'D20']);
    expect(suggestCheckout(141)).toEqual(['T20', 'T15', 'D18']);
    expect(suggestCheckout(121)).toEqual(['T20', '11', 'Bull']);
    expect(suggestCheckout(110)).toEqual(['T20', 'Bull']);
    expect(suggestCheckout(100)).toEqual(['T20', 'D20']);
    expect(suggestCheckout(50)).toEqual(['Bull']);
    expect(suggestCheckout(40)).toEqual(['D20']);
    expect(suggestCheckout(32)).toEqual(['D16']);
    expect(suggestCheckout(60)).toEqual(['20', 'D20']);
    expect(suggestCheckout(99)).toEqual(['T20', '19', 'D10']);
    expect(suggestCheckout(101)).toEqual(['T17', 'Bull']);
  });

  it('alle Reste 2..170: entweder unmöglich oder valide Route', () => {
    for (let n = 2; n <= 170; n++) {
      const r = checkoutTableFull(n);
      if (IMPOSSIBLE.includes(n)) {
        expect(r, `${n} sollte unmöglich sein`).toBeNull();
      } else {
        expect(r, `${n} sollte eine Route haben`).not.toBeNull();
        expect(validateRoute(r, n), `${n}: Route ${r.join(' ')} invalide`).toBe(true);
      }
    }
  });

  it('unmoegliche Reste liefern null', () => {
    for (const n of IMPOSSIBLE) expect(suggestCheckout(n)).toBeNull();
    expect(suggestCheckout(1)).toBeNull();
    expect(suggestCheckout(0)).toBeNull();
    expect(suggestCheckout(171)).toBeNull();
  });

  it('dartsLeft kuerzt die Route', () => {
    expect(suggestCheckout(170, 1)).toEqual(['T20']);
    expect(suggestCheckout(170, 2)).toEqual(['T20', 'T20']);
    expect(suggestCheckout(40, 1)).toEqual(['D20']);
  });

  it('routeValue rechnet richtig', () => {
    expect(routeValue('T20')).toBe(60);
    expect(routeValue('D16')).toBe(32);
    expect(routeValue('19')).toBe(19);
    expect(routeValue('Bull')).toBe(50);
  });
});
