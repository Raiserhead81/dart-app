import { describe, it, expect } from 'vitest';
import { easeOutCubic, countFormat, trendProjection } from '../src/statsfx.js';
import { bestRecords, newRecordsBroken } from '../src/records.js';

describe('Statistik-Effekte (pure)', () => {
  it('easeOutCubic: 0 -> 0, 1 -> 1, schnell am Anfang', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.75); // eased: frueher hoch
  });

  it('countFormat: zaehlt eased hoch, deutsches Komma, %-Suffix bleibt Sache des Aufrufers', () => {
    expect(countFormat(61.3, 0)).toBe('0,0');
    expect(countFormat(61.3, 1)).toBe('61,3');
    expect(Number(countFormat(61.3, 0.5).replace(',', '.'))).toBeGreaterThan(50);
    expect(countFormat(100, 0.5, 0)).toBe('88'); // eased 0.875 -> gerundet 88
  });

  it('trendProjection: steigende Werte -> Prognose ueber letztem Wert', () => {
    const r = trendProjection([52, 54, 55, 58, 60, 61], 4);
    expect(r.direction).toBe('up');
    expect(r.projected).toBeGreaterThan(61);
  });

  it('trendProjection: zu wenige Daten -> null', () => {
    expect(trendProjection([52, null])).toBe(null);
    expect(trendProjection([])).toBe(null);
  });
});

describe('Persoenliche Rekorde', () => {
  const g = (date, avg3, coH, coA, c180, legs, darts) => ({
    kind: 'x01', date, label: '501',
    results: [{ player: 'Kay', avg3, darts, checkouts: { hits: coH, attempts: coA }, doubles: { hits: 5, attempts: 9 }, counts: { c100: 2, c140: 0, c180 }, legsWon: legs, legsPlayed: legs }],
    legEvents: [{ winner: 'Kay', darts }]
  });

  it('bestRecords: Hoechstwerte + Datum je Kategorie', () => {
    const games = [
      g('2026-10-01T10:00:00Z', 58, 3, 6, 0, 2, 21),
      g('2026-10-15T10:00:00Z', 64, 4, 6, 1, 3, 18),
      g('2026-10-20T10:00:00Z', 61, 5, 5, 0, 2, 19)
    ];
    const r = bestRecords(games, 'Kay');
    expect(r.avg.v).toBe(64);
    expect(r.checkout.v).toBe(100); // 5/5 am 20.10.
    expect(r.fastestLeg.darts).toBe(18);
    expect(r.most180.n).toBe(1);
    expect(r.avg.date).toBe('15.10.');
  });

  it('newRecordsBroken: frisches Ergebnis bricht Avg- und 180-Rekord', () => {
    const prev = [g('2026-10-01T10:00:00Z', 58, 3, 6, 0, 2, 21)];
    const broken = newRecordsBroken(prev, 'Kay', { avg3: 71, checkouts: { hits: 2, attempts: 4 }, counts: { c180: 2 } });
    expect(broken.map(b => b.kind).sort()).toEqual(['avg', 'most180']);
  });

  it('newRecordsBroken: kein Bruch bei schlechterem Ergebnis', () => {
    const prev = [g('2026-10-01T10:00:00Z', 64, 4, 5, 1, 2, 21)];
    expect(newRecordsBroken(prev, 'Kay', { avg3: 55, checkouts: { hits: 2, attempts: 6 }, counts: { c180: 0 } })).toEqual([]);
  });
});
