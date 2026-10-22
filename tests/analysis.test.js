import { describe, it, expect } from 'vitest';
import { analysePlayer, headlineFinding } from '../src/analysis.js';
import { tipsFor } from '../src/tips.js';
import { emptyStats } from '../src/stats.js';

function stats(over = {}) {
  const s = emptyStats();
  s.darts = 200; s.points = 9000; s.avg3 = 45;
  s.doubles = { hits: 6, attempts: 20, pct: 30 };
  s.checkout = { hits: 5, attempts: 12, pct: 42 };
  s.first9 = 44; s.t20 = { hits: 15, darts: 100, pct: 15 };
  s.legsPlayed = 8; s.dartsPerLeg = 21; s.visits = 60;
  s.counts = { c100: 8, c140: 2, c180: 1 };
  return Object.assign(s, over);
}

describe('Schwaechen-Regeln', () => {
  it('Doppel 18% ist groesste Schwaeche mit Ziel-Hinweis', () => {
    const a = analysePlayer(stats({ doubles: { hits: 4, attempts: 22, pct: 18 }, checkout: { hits: 6, attempts: 12, pct: 50 } }));
    expect(a.weaknesses[0].key).toBe('doubles');
    expect(a.weaknesses[0].title).toContain('18%');
    expect(a.weaknesses[0].detail).toContain('30%');
  });

  it('Ranking: schwerere Schwaeche zuerst', () => {
    const a = analysePlayer(stats({ doubles: { hits: 2, attempts: 20, pct: 10 }, avg3: 33 }));
    expect(a.weaknesses.length).toBeGreaterThanOrEqual(2);
    expect(a.weaknesses[0].severity).toBeGreaterThanOrEqual(a.weaknesses[1].severity);
  });

  it('gute Werte erzeugen Staerken', () => {
    const a = analysePlayer(stats());
    expect(a.weaknesses.length).toBe(0);
    expect(a.strengths.length).toBeGreaterThanOrEqual(2);
    expect(headlineFinding(a)).toContain('Keine nennenswerten');
  });

  it('zu wenig Daten -> ehrlicher Hinweis', () => {
    const s = emptyStats(); s.darts = 20;
    const a = analysePlayer(s);
    expect(a.dataQuality.enough).toBe(false);
    expect(headlineFinding(a)).toContain('Darts bis');
  });

  it('T20-Schwaeche erkannt', () => {
    const a = analysePlayer(stats({ t20: { hits: 5, darts: 100, pct: 5 } }));
    expect(a.weaknesses.some(w => w.key === 't20')).toBe(true);
  });
});

describe('Trainingstipps', () => {
  it('Doppel-Schwaeche -> Doubles-Training mit konkretem Text', () => {
    const a = analysePlayer(stats({ doubles: { hits: 4, attempts: 22, pct: 18 } }));
    const tips = tipsFor(a);
    expect(tips.length).toBeGreaterThanOrEqual(1);
    expect(tips[0].training).toBe('doublesAtc');
    expect(tips[0].text).toContain('D16');
  });

  it('Checkout-Schwaeche -> Checkout-Training', () => {
    const a = analysePlayer(stats({ checkout: { hits: 1, attempts: 10, pct: 10 } }));
    const tips = tipsFor(a);
    expect(tips[0].training).toBe('checkout');
  });

  it('maximal 3 Tipps', () => {
    const a = analysePlayer(stats({ doubles: { hits: 1, attempts: 30, pct: 3 }, checkout: { hits: 0, attempts: 10, pct: 0 }, avg3: 30, t20: { hits: 2, darts: 100, pct: 2 }, first9: 10 }));
    expect(tipsFor(a).length).toBeLessThanOrEqual(3);
  });
});
