// Statistik-Aggregation ueber Game-Records. Ein Game-Record enthaelt pro Spieler
// ein vorberechnetes Result (aus der Engine gebaut) plus optionale Board-Wuerfe
// fuer Heatmap/T20-Quote. Reine Funktionen.

import { KIND_TRIPLE } from './segments.js';

export const emptyStats = () => ({
  games: 0,
  darts: 0,
  points: 0,
  avg3: null,           // 3-Dart-Average
  first9: null,         // First-9-Average (3 Darts)
  checkout: { hits: 0, attempts: 0, pct: null },
  doubles: { hits: 0, attempts: 0, pct: null },
  counts: { c100: 0, c140: 0, c180: 0 },
  legsWon: 0,
  legsPlayed: 0,
  dartsPerLeg: null,
  bestVisit: 0,
  visits: 0,
  board: {},            // Code -> Treffer (Heatmap)
  t20: { hits: 0, darts: 0, pct: null },
  training: { atcDarts: null, bob27: null, t20Hits: null, shanghai: null }
});

export function mergeStats(target, add) {
  target.games += add.games;
  target.darts += add.darts;
  target.points += add.points;
  target.checkout.hits += add.checkout.hits;
  target.checkout.attempts += add.checkout.attempts;
  target.doubles.hits += add.doubles.hits;
  target.doubles.attempts += add.doubles.attempts;
  target.counts.c100 += add.counts.c100;
  target.counts.c140 += add.counts.c140;
  target.counts.c180 += add.counts.c180;
  target.legsWon += add.legsWon;
  target.legsPlayed += add.legsPlayed;
  target.bestVisit = Math.max(target.bestVisit, add.bestVisit || 0);
  target.visits += add.visits || 0;
  for (const [code, n] of Object.entries(add.board || {})) {
    target.board[code] = (target.board[code] || 0) + n;
  }
  target.t20.hits += add.t20.hits;
  target.t20.darts += add.t20.darts;
  return target;
}

export function finalizeStats(s) {
  s.avg3 = s.darts > 0 ? round1(s.points / s.darts * 3) : null;
  s.checkout.pct = s.checkout.attempts > 0 ? Math.round(s.checkout.hits / s.checkout.attempts * 100) : null;
  s.doubles.pct = s.doubles.attempts > 0 ? Math.round(s.doubles.hits / s.doubles.attempts * 100) : null;
  s.t20.pct = s.t20.darts > 0 ? round1(s.t20.hits / s.t20.darts * 100) : null;
  s.dartsPerLeg = s.legsPlayed > 0 ? round1(s.darts / s.legsPlayed) : null;
  return s;
}

function round1(x) { return Math.round(x * 10) / 10; }

// Player-Result eines X01-Games -> Statistik-Zuschlag
export function statsFromResult(result) {
  const s = emptyStats();
  s.games = 1;
  s.darts = result.darts || 0;
  s.points = result.points || 0;
  if (result.first9) { s._first9Pts = result.first9.points; s._first9Darts = result.first9.darts; }
  s.checkout.hits = result.checkouts?.hits || 0;
  s.checkout.attempts = result.checkouts?.attempts || 0;
  s.doubles.hits = result.doubles?.hits || 0;
  s.doubles.attempts = result.doubles?.attempts || 0;
  s.counts.c100 = result.counts?.c100 || 0;
  s.counts.c140 = result.counts?.c140 || 0;
  s.counts.c180 = result.counts?.c180 || 0;
  s.legsWon = result.legsWon || 0;
  s.legsPlayed = result.legsPlayed || 0;
  s.bestVisit = result.bestVisit || 0;
  s.visits = result.visits || 0;
  return s;
}

// Alle Games eines Spielers aggregieren.
// Games: [{ kind:'x01', date, players:[], results:[{player, ...}], boardThrows:[{p,c,k,n,v}] }]
export function computePlayerStats(games, playerName) {
  const total = emptyStats();
  let f9p = 0, f9d = 0;
  for (const g of games || []) {
    const r = (g.results || []).find(x => x.player === playerName);
    if (!r) continue;
    if (g.kind === 'x01') {
      mergeStats(total, statsFromResult(r));
      if (r.first9) { f9p += r.first9.points; f9d += r.first9.darts; }
      for (const t of g.boardThrows || []) {
        if (t.p !== playerName) continue;
        if (t.k === 'sum') continue;
        total.board[t.c] = (total.board[t.c] || 0) + 1;
        if (t.k === KIND_TRIPLE && t.n === 20) total.t20.hits++;
        if (t.n === 20 || (t.k === KIND_TRIPLE && t.n === 20)) total.t20.darts++;
      }
    } else if (g.kind === 'training') {
      total.games += 0; // Training zaehlt nicht als Spiel
      if (g.mode === 't20') {
        total.t20.hits += g.summary?.hits || 0;
        total.t20.darts += g.summary?.dartsOnTarget || 0;
        total.training.t20Hits = g.summary?.hits ?? total.training.t20Hits;
      }
      if (g.mode === 'atc' || g.mode === 'doublesAtc') {
        total.training.atcDarts = g.summary?.darts ?? total.training.atcDarts;
      }
      if (g.mode === 'bob27') total.training.bob27 = g.summary?.score ?? total.training.bob27;
      if (g.mode === 'shanghai') total.training.shanghai = g.summary?.score ?? total.training.shanghai;
    }
  }
  total.first9 = f9d > 0 ? round1(f9p / f9d * 3) : null;
  total._first9 = { points: f9p, darts: f9d };
  return finalizeStats(total);
}

// Alle Spielernamen, die in Games vorkommen (nach Aktivitaet)
export function knownPlayers(games) {
  const map = new Map();
  for (const g of games || []) {
    for (const r of g.results || []) {
      const cur = map.get(r.player) || { player: r.player, games: 0, last: null };
      cur.games++;
      if (!cur.last || (g.date && g.date > cur.last)) cur.last = g.date;
      map.set(r.player, cur);
    }
  }
  return [...map.values()].sort((a, b) => (b.last || '').localeCompare(a.last || ''));
}

// Freundes-Rangliste aus Stats (fuer Online-Ansicht)
export function rankPlayers(list) {
  return [...list].sort((a, b) => (b.avg3 ?? -1) - (a.avg3 ?? -1));
}

// Wochen-Zusammenfassung: Vergleich zweier Stats
export function statDeltas(cur, prev) {
  const d = (a, b) => (a == null || b == null ? null : round1(a - b));
  return {
    avg: d(cur.avg3, prev.avg3),
    first9: d(cur.first9, prev.first9),
    doubles: d(cur.doubles.pct, prev.doubles.pct),
    checkout: d(cur.checkout.pct, prev.checkout.pct),
    legs: cur.legsWon - prev.legsWon,
    games: cur.games - prev.games
  };
}
