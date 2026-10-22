import { describe, it, expect } from 'vitest';
import { isoWeekKey, mondayOf, lastWeekKeys, weekLabel, gamesInWeek, weeklyTrend } from '../src/weeks.js';
import { computePlayerStats } from '../src/stats.js';

describe('ISO-Wochen (Montag-Start)', () => {
  it('bekannte Daten', () => {
    expect(isoWeekKey(new Date(2026, 9, 22))).toBe('2026-W43'); // Do
    expect(isoWeekKey(new Date(2026, 9, 19))).toBe('2026-W43'); // Mo gleiche Woche
    expect(isoWeekKey(new Date(2026, 9, 18))).toBe('2026-W42'); // So vorher
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe('2026-W01');  // Do
    expect(isoWeekKey(new Date(2025, 11, 29))).toBe('2026-W01'); // Mo, gehoert per ISO zu 2026
    expect(isoWeekKey(new Date(2024, 11, 30))).toBe('2025-W01'); // Di gehoert zu 2025-W01
  });

  it('mondayOf liefert Montag 00:00 UTC', () => {
    const m = mondayOf('2026-W43');
    expect(m.getUTCDay()).toBe(1);
    expect(m.toISOString().slice(0, 10)).toBe('2026-10-19');
  });

  it('lastWeekKeys: 12 aufsteigende Wochen endend auf aktuell', () => {
    const keys = lastWeekKeys(12, new Date(2026, 9, 22));
    expect(keys.length).toBe(12);
    expect(keys[11]).toBe('2026-W43');
    expect(keys[10]).toBe('2026-W42');
    expect(keys[0]).toBe('2026-W32');
  });
});

describe('Wochen-Gruppierung + Trend', () => {
  const g = (date, pts) => ({
    id: 'g' + date, kind: 'x01', date, players: ['Kay'],
    results: [{ player: 'Kay', points: pts, darts: 30, legsWon: 1, legsPlayed: 1, checkouts: { hits: 1, attempts: 2 }, doubles: { hits: 2, attempts: 6 }, counts: { c100: 1, c140: 0, c180: 0 }, first9: { points: 100, darts: 9 }, bestVisit: 100, visits: 10 }],
    boardThrows: []
  });

  it('gamesInWeek gruppiert korrekt', () => {
    const games = [g('2026-10-20T10:00:00Z', 501), g('2026-10-13T10:00:00Z', 400)];
    expect(gamesInWeek(games, '2026-W43').length).toBe(1);
    expect(gamesInWeek(games, '2026-W42').length).toBe(1);
  });

  it('weeklyTrend liefert 12 Wochen mit Deltas', () => {
    const games = [g('2026-10-20T10:00:00Z', 501), g('2026-10-14T10:00:00Z', 450)];
    const trend = weeklyTrend(games, 'Kay', 12, new Date(2026, 9, 22));
    expect(trend.length).toBe(12);
    const cur = trend[11], prev = trend[10];
    expect(cur.stats.points).toBe(501);
    expect(prev.stats.points).toBe(450);
    expect(cur.delta.avg).toBeCloseTo(501 / 30 * 3 - 450 / 30 * 3, 1);
  });
});
