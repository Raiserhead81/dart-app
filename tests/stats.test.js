import { describe, it, expect } from 'vitest';
import { computePlayerStats, knownPlayers, statDeltas, emptyStats } from '../src/stats.js';
import { buildX01GameRecord } from '../src/result.js';
import { newX01, applyDart } from '../src/x01.js';
import { makeThrow } from '../src/segments.js';

const T = n => makeThrow('triple', n);
const S = n => makeThrow('single', n);
const D = n => makeThrow('double', n);

// Spielt fuer jeden Spieler seine Dart-Queue ab (andere werfen Miss, falls Queue leer)
function playLeg(state, routes) {
  const queues = routes.map(r => [...r]);
  let guard = 0;
  while (!state.finished && guard++ < 300) {
    const q = queues[state.current];
    applyDart(state, q.length ? q.shift() : makeThrow('miss', 0));
  }
}

const PERFECT_501 = () => [T(20), T(20), T(20), T(20), T(20), T(20), T(20), T(15), D(18)]; // 7x T20 + T15 + D18 = 501 in 9

function playPerfectLeg(state) {
  playLeg(state, [PERFECT_501()]);
}

describe('buildX01GameRecord + stats', () => {
  it('perfektes 501er-Leg: Avg 167.3, Checkout 100%', () => {
    const s = newX01({ start: 501, players: ['Kay'], firstTo: 1 });
    playPerfectLeg(s);
    expect(s.finished).toBe(true);
    const rec = buildX01GameRecord(s);
    const r = rec.results[0];
    expect(r.darts).toBe(9);
    expect(r.points).toBe(501);
    expect(r.avg3).toBeCloseTo(501 / 9 * 3, 1);
    expect(r.checkouts).toEqual({ hits: 1, attempts: 1 });
    expect(r.counts.c180).toBe(2); // Visits: 180, 180, 141
    expect(r.first9.darts).toBe(9);
    expect(r.first9.points).toBe(501);
    expect(r.legsWon).toBe(1);
    expect(rec.boardThrows.length).toBe(9);
  });

  it('computePlayerStats aggregiert mehrere Games', () => {
    const s1 = newX01({ start: 501, players: ['Kay'], firstTo: 1 });
    playPerfectLeg(s1);
    const s2 = newX01({ start: 501, players: ['Kay', 'Max'], firstTo: 1 });
    playLeg(s2, [PERFECT_501(), [makeThrow('miss', 0)]]);
    const games = [buildX01GameRecord(s1), buildX01GameRecord(s2)];
    const st = computePlayerStats(games, 'Kay');
    expect(st.games).toBe(2);
    expect(st.darts).toBe(18);
    expect(st.points).toBe(1002);
    expect(st.avg3).toBeCloseTo(1002 / 18 * 3, 1);
    expect(st.checkout.pct).toBe(100);
    expect(st.legsWon).toBe(2);
    expect(st.legsPlayed).toBe(2);
    expect(st.dartsPerLeg).toBe(9);
    expect(st.t20.hits).toBe(14); // 7 T20 pro Leg
    expect(st.board['T20']).toBe(14);
    expect(st.board['T15']).toBe(2);
  });

  it('Summen-Wuerfe (Zahlen-Modus) zaehlen nicht ins Board', () => {
    const s = newX01({ start: 501, players: ['Kay'], firstTo: 1 });
    for (let i = 0; i < 5; i++) applyDart(s, { c: '60', k: 'sum', n: null, v: 60 });
    const rec = buildX01GameRecord(s, { id: 'g-sum' });
    expect(rec.boardThrows.length).toBe(0);
    expect(rec.results[0].points).toBe(300);
  });

  it('knownPlayers liefert Namen nach Aktivitaet', () => {
    const s1 = newX01({ start: 501, players: ['Kay'], firstTo: 1 });
    playPerfectLeg(s1);
    const games = [buildX01GameRecord(s1)];
    expect(knownPlayers(games).map(p => p.player)).toEqual(['Kay']);
  });

  it('statDeltas rechnet Differenzen', () => {
    const a = emptyStats(); a.avg3 = 50; a.doubles.pct = 30; a.checkout.pct = 40;
    const b = emptyStats(); b.avg3 = 48; b.doubles.pct = 25; b.checkout.pct = 35;
    const d = statDeltas(a, b);
    expect(d.avg).toBe(2);
    expect(d.doubles).toBe(5);
    expect(d.checkout).toBe(5);
  });
});
