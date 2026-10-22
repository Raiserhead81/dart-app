import { describe, it, expect } from 'vitest';
import { avgToLevel, checkoutToLevel, doublesToLevel, t20ToLevel, first9Verdict, buildWeeklyPlan, fortniteLine } from '../src/benchmarks.js';

describe('Benchmark-Einstufung', () => {
  it('3-Dart-Avg-Level', () => {
    expect(avgToLevel(35).label).toBe('Anfaenger');
    expect(avgToLevel(45).label).toBe('Hobby');
    expect(avgToLevel(65).label).toBe('Sehr gut');
    expect(avgToLevel(85).label).toBe('Profi-Niveau');
    expect(avgToLevel(45).next).toBe(60);
    expect(avgToLevel(null).label).toBe('—');
  });

  it('Checkout-Level mit naechstem Ziel', () => {
    expect(checkoutToLevel(18).label).toBe('Schwach');
    expect(checkoutToLevel(18).next).toBe(25);
    expect(checkoutToLevel(28).label).toBe('OK');
    expect(checkoutToLevel(42).label).toBe('Gut');
    expect(checkoutToLevel(55).label).toBe('Sehr gut');
  });

  it('Doppel- und T20-Level', () => {
    expect(doublesToLevel(15).label).toBe('Schwach');
    expect(doublesToLevel(32).label).toBe('Gut');
    expect(t20ToLevel(9).label).toBe('OK');
    expect(t20ToLevel(16).label).toBe('Sehr gut');
  });

  it('First-9-Verdict', () => {
    expect(first9Verdict(50, 42).label).toBe('Langsamer Starter');
    expect(first9Verdict(50, 55).label).toBe('Starker Einstieg');
    expect(first9Verdict(50, 48).label).toBe('Konstant');
  });
});

describe('Wochenplan-Generator', () => {
  it('leitet 3 Sessions aus den Top-Schwaechen ab', () => {
    const analysis = { weaknesses: [{ key: 'doubles' }, { key: 't20' }] };
    const plan = buildWeeklyPlan(analysis);
    expect(plan.length).toBe(3);
    expect(plan[0].key).toBe('doubles');
    expect(plan[1].key).toBe('t20');
    expect(plan[2].key).toBe('scoring'); // Aufuellung
    expect(plan[0].pass).toContain('12/30');
    expect(plan.every(s => s.minutes === 20)).toBe(true);
  });

  it('ohne Schwaechen: Grundlagen-Plan', () => {
    const plan = buildWeeklyPlan({ weaknesses: [] });
    expect(plan.length).toBe(3);
    expect(plan.map(s => s.key).sort()).toEqual(['checkout', 'doubles', 'scoring'].sort());
  });

  it('jede Session hat konkrete Pass-Marken und Drill-Schritte', () => {
    const plan = buildWeeklyPlan({ weaknesses: [{ key: 'checkout' }] });
    for (const s of plan) {
      expect(s.plan.length).toBeGreaterThanOrEqual(2);
      expect(s.pass).toMatch(/\d/);
    }
  });
});

describe('2-Wochen-Vergleich', () => {
  it('formatiert Deltas messbar', () => {
    expect(fortniteLine(24, 30, 'Doppel-%')).toBe('Doppel-% letzte 2 Wochen: +6% (24% → 30%)');
    expect(fortniteLine(30, 26, 'Checkout-%')).toContain('-4%');
    expect(fortniteLine(null, 30, 'Doppel-%')).toContain('keine Vergleichswerte');
  });
});
