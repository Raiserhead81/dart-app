// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Baut aus einem beendeten (oder laufenden) X01-State den Game-Record:
// pro Spieler Result mit Kennzahlen + Board-Wuerfe fuer Heatmap. Reine Funktion.

import { isDoubleLike } from './segments.js';

export function buildX01GameRecord(state, meta = {}) {
  const n = state.players.length;
  const results = state.players.map((pl, p) => {
    // Legs, an denen der Spieler teilnahm = Anzahl Legs, die seit seinem letzten Start liefen
    const darts = state.throws[p].filter(t => !t.noScore).length + state.throws[p].filter(t => t.noScore).length;
    const totalDarts = state.throws[p].length;
    // Punkte: Start x gespielte Legs minus Rest-Endstaende
    const legsPlayed = countLegsPlayed(state, p);
    let points = state.start * legsPlayed;
    for (const le of state.legEvents) {
      points -= le.remainingEnds[p];
    }
    if (!state.finished) points -= state.leg.remaining[p]; // laufendes Leg

    // Visits dieses Spielers
    const visits = state.visits.filter(v => v.p === p);
    let c100 = 0, c140 = 0, c180 = 0, best = 0;
    for (const v of visits) {
      if (v.points >= 180) c180++;
      else if (v.points >= 140) c140++;
      else if (v.points >= 100) c100++;
      best = Math.max(best, v.points);
    }

    // First 9: erste 3 Visits jedes Legs
    const byLeg = new Map();
    for (const v of visits) {
      if (!byLeg.has(v.leg)) byLeg.set(v.leg, []);
      byLeg.get(v.leg).push(v);
    }
    let f9p = 0, f9d = 0;
    for (const list of byLeg.values()) {
      let d = 0;
      for (const v of list.slice(0, 3)) {
        if (d + v.darts > 9) {
          const take = 9 - d;
          if (take > 0) { f9p += Math.round(v.points * take / v.darts); f9d += take; d = 9; }
        } else {
          f9p += v.points; f9d += v.darts; d += v.darts;
        }
        if (d >= 9) break;
      }
    }

    const dubs = { hits: 0, attempts: 0 };
    const co = { hits: 0, attempts: 0 };
    for (const v of visits) {
      if (v.phase === 'finish') {
        dubs.attempts += v.darts;
        dubs.hits += v.doubleHits;
        co.attempts++;
        if (v.hit) co.hits++;
      }
    }

    return {
      player: pl.name,
      won: state.winner === p,
      legsWon: state.legsWon[p],
      legsPlayed,
      points,
      darts: totalDarts,
      avg3: totalDarts > 0 ? Math.round(points / totalDarts * 3 * 10) / 10 : null,
      first9: { points: f9p, darts: f9d },
      doubles: dubs,
      checkouts: co,
      counts: { c100, c140, c180 },
      bestVisit: best,
      visits: visits.length
    };
  });

  const boardThrows = [];
  for (let p = 0; p < n; p++) {
    for (const t of state.throws[p]) {
      if (t.k === 'sum' || t.noScore) continue;
      boardThrows.push({ p: state.players[p].name, c: t.c, k: t.k, n: t.n, v: t.v });
    }
  }

  return {
    id: meta.id || state.id,
    kind: 'x01',
    mode: 'x01',
    label: `${state.start}${state.doubleOut ? ' Double Out' : ''}${state.doubleIn ? ' Double In' : ''}`,
    date: meta.date || state.createdAt,
    online: !!meta.online,
    players: state.players.map(p => p.name),
    results,
    boardThrows
  };
}

function countLegsPlayed(state, p) {
  // Ein Spieler spielt in einem Leg, sobald er an der Reihe war (starter + Rotation).
  let count = 0;
  const players = state.players.length;
  const totalLegs = state.legEvents.length + (state.finished ? 0 : 1);
  for (let i = 0; i < totalLegs; i++) count++; // Rotation: jeder kommt in jedem Leg dran
  return Math.min(count, totalLegs);
}

// Engine-State um Visit-Records ergaenzen (wird beim Visit-Abschluss aufgerufen)
export function pushVisit(state, p, points, darts, thrList, hit) {
  const leg = state.leg;
  state.visits.push({
    p,
    leg: leg.legNo,
    points,
    darts,
    doubleHits: thrList.filter(t => isDoubleLike(t)).length,
    phase: (leg.visitStart <= 50 && state.doubleOut) ? 'finish' : 'score',
    hit
  });
}
