// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Cricket: Standard (Scoring) + Cut-Throat. Zahlen 15-20 + Bull(25er-Segment zaehlt als Bull-Marke?).
// Konvention: Bull = 50er UND 25er treffen beide die Bull-Zahl? Klassisch zaehlt nur das Bull (50)
// als Marke; 25 (aussen) gilt als Miss fuer Cricket. Wir werten: 50 = 1 Marke (Doppel-Bull? nein:
// Cricket zaehlt Marks: Single=1, Double=2, Triple=3, Bull=1 Marke (auch wenn "Doppel" genannt)).
// Einfach + ueblich: T = 3 Marks, D = 2 Marks, S = 1 Mark, Bull = 1 Mark (50), 25 = 0 Marks.

import { KIND_BULL, KIND_DOUBLE, KIND_TRIPLE, KIND_OUTER } from './segments.js';

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25]; // 25 = Bull

export function newCricket(opts = {}) {
  const players = (opts.players && opts.players.length ? opts.players : ['Spieler 1']).map((name, i) => ({ i, name }));
  return {
    v: 1,
    mode: opts.cutThroat ? 'cutthroat' : 'cricket',
    createdAt: opts.createdAt || new Date().toISOString(),
    players,
    current: 0,
    marks: players.map(() => Object.fromEntries(CRICKET_NUMBERS.map(n => [n, 0]))),
    points: players.map(() => 0),
    winner: -1,
    finished: false,
    round: 1,
    throws: players.map(() => [])
  };
}

export function marksFor(thr) {
  if (thr.k === KIND_BULL) return 1;
  if (thr.k === KIND_OUTER) return 0; // 25er trifft nicht das Cricket-Bull
  if (thr.n >= 15 && thr.n <= 20) {
    if (thr.k === KIND_TRIPLE) return 3;
    if (thr.k === KIND_DOUBLE) return 2;
    return 1; // single
  }
  return 0;
}

function isOpen(state, p, num) {
  return state.marks[p][num] < 3;
}

function allClosed(state, num, exceptP) {
  return state.players.every((_, i) => i === exceptP || !isOpen(state, i, num));
}

// Ein Dart im Cricket anwenden.
export function applyCricketDart(state, thr) {
  if (state.finished) return { type: 'match', message: 'Spiel beendet' };
  const p = state.current;
  state.throws[p].push({ ...thr });
  const num = thr.k === KIND_BULL ? 25 : thr.n;
  const marks = marksFor(thr);
  const ev = { type: 'ok', player: p, throw: thr };

  if (marks > 0) {
    const already = state.marks[p][num];
    const use = Math.min(marks, 3 - already);
    if (use > 0) state.marks[p][num] += use;
    const overflow = marks - use;
    const closedNow = state.marks[p][num] >= 3;
    if (overflow > 0 && closedNow) {
      if (state.mode === 'cutthroat') {
        // Punkte an alle Gegner mit offener Zahl
        state.players.forEach((_, i) => {
          if (i !== p && isOpen(state, i, num)) state.points[i] += overflow * num;
        });
      } else if (state.players.some((_, i) => i !== p && isOpen(state, i, num))) {
        state.points[p] += overflow * num;
      }
    }
  }

  // Sieg-Check: alle eigenen Zahlen zu + (Standard: mehr Punkte als jeder Gegner / Cut-Throat: alle Zahlen zu)
  const allMineClosed = CRICKET_NUMBERS.every(n => state.marks[p][n] >= 3);
  if (allMineClosed) {
    let won = false;
    if (state.mode === 'cutthroat') {
      won = true; // wer zuerst alle schliesst, gewinnt (Punkte stehen auf den Gegnern)
    } else {
      won = state.players.every((_, i) => i === p || state.points[p] >= state.points[i]);
    }
    if (won) {
      state.finished = true;
      state.winner = p;
      return { ...ev, type: 'match', message: `${state.players[p].name} gewinnt!` };
    }
  }

  return ev;
}

// Visits zu Ende fuehren (3 Darts)
export function cricketNextTurn(state) {
  state.current = (state.current + 1) % state.players.length;
  if (state.current === 0) state.round++;
  return state;
}
