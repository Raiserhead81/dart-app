// X01-Engine: 101/170/301/501/701/1001, Double-Out (Standard an), Double-In optional,
// 1-4 Spieler lokal, "first to N legs". Reine Logik, State = plain JSON (Server-Sync).

import { makeThrow, isDoubleLike } from './segments.js';

export function newX01(opts = {}) {
  const players = (opts.players && opts.players.length ? opts.players : ['Spieler 1']).map((name, i) => ({ i, name }));
  const start = opts.start || 501;
  const n = players.length;
  return {
    v: 1,
    mode: 'x01',
    id: opts.id || null,
    createdAt: opts.createdAt || new Date().toISOString(),
    start,
    doubleOut: opts.doubleOut !== false,
    doubleIn: opts.doubleIn === true,
    firstTo: opts.firstTo || 1,
    players,
    current: 0,
    legsWon: players.map(() => 0),
    winner: -1,
    finished: false,
    throws: players.map(() => []),   // alle Wuerfe mit Segment (Statistik-Rohdaten)
    visits: [],                      // abgeschlossene Aufnahmen (Avg/First9/Double-Quote)
    legEvents: [],
    leg: {
      remaining: Array.from({ length: n }, () => start),
      started: players.map(() => !opts.doubleIn),
      visit: [],
      visitThrows: [],
      visitStart: start,
      starter: 0,
      legNo: 1,
      dartsInLeg: players.map(() => 0),
      won: -1
    }
  };
}

function isBust(state, remaining, thr) {
  const nr = remaining - thr.v;
  if (nr < 0) return true;
  if (nr === 1 && state.doubleOut) return true;
  if (nr === 0 && state.doubleOut && !isDoubleLike(thr)) return true;
  return false;
}

function nextPlayer(state) {
  return (state.current + 1) % state.players.length;
}

function resetLeg(state, starter) {
  const n = state.players.length;
  state.leg = {
    remaining: Array.from({ length: n }, () => state.start),
    started: Array.from({ length: n }, () => !state.doubleIn),
    visit: [],
    visitThrows: [],
    visitStart: state.start,
    starter,
    legNo: state.leg.legNo + 1,
    dartsInLeg: Array.from({ length: n }, () => 0),
    won: -1
  };
  state.current = starter;
}

function pushVisit(state, p, hit) {
  const leg = state.leg;
  const darts = leg.visitThrows.length;
  if (darts === 0) return;
  state.visits.push({
    p,
    leg: leg.legNo,
    points: hit ? leg.visitStart : (leg.visitStart - leg.remaining[p]),
    darts,
    doubleHits: leg.visitThrows.filter(t => isDoubleLike(t)).length,
    phase: (hit || (leg.visitStart <= 50 && state.doubleOut)) ? 'finish' : 'score',
    hit
  });
}

function endVisit(state) {
  const leg = state.leg;
  leg.visit = [];
  leg.visitThrows = [];
  state.current = nextPlayer(state);
  leg.visitStart = leg.remaining[state.current];
}

// Ein Dart anwenden. Liefert Event fuer UI:
// { type: 'ok'|'noin'|'bust'|'turn'|'leg'|'match', player, throw, message, darts? }
export function applyDart(state, thr) {
  if (state.finished) return { type: 'match', message: 'Spiel beendet' };
  const t = thr && thr.k ? thr : makeThrow('miss', 0);
  const p = state.current;
  const leg = state.leg;
  const ev = { type: 'ok', player: p, throw: t };

  // Double-In: Darts vor dem ersten Doppel zahlen nichts
  if (!leg.started[p]) {
    if (!isDoubleLike(t)) {
      state.throws[p].push({ ...t, v: 0, noScore: true, leg: leg.legNo });
      leg.dartsInLeg[p]++;
      leg.visit.push(t.c);
      leg.visitThrows.push({ ...t, v: 0 });
      if (leg.visit.length >= 3) {
        pushVisit(state, p, false);
        endVisit(state);
        return { ...ev, type: 'turn', message: 'Kein Doppel – keine Punkte' };
      }
      return { ...ev, type: 'noin', message: 'Double-In: kein Score' };
    }
    leg.started[p] = true;
  }

  if (isBust(state, leg.remaining[p], t)) {
    state.throws[p].push({ ...t, bust: true, leg: leg.legNo });
    leg.dartsInLeg[p]++;
    leg.visit.push(t.c);
    leg.visitThrows.push(t);
    leg.remaining[p] = leg.visitStart;
    pushVisit(state, p, false); // Bust-Aufnahme zaehlt 0 Punkte
    endVisit(state);
    return { ...ev, type: 'bust', message: 'BUST' };
  }

  leg.remaining[p] -= t.v;
  state.throws[p].push({ ...t, leg: leg.legNo });
  leg.dartsInLeg[p]++;
  leg.visit.push(t.c);
  leg.visitThrows.push(t);

  if (leg.remaining[p] === 0) {
    const dartsUsed = leg.dartsInLeg[p];
    pushVisit(state, p, true);
    state.legEvents.push({
      legNo: leg.legNo,
      winner: p,
      darts: dartsUsed,
      starter: leg.starter,
      remainingEnds: [...leg.remaining],
      finishedAt: new Date().toISOString()
    });
    state.legsWon[p]++;
    if (state.legsWon[p] >= state.firstTo) {
      state.finished = true;
      state.winner = p;
      return { ...ev, type: 'match', message: `${state.players[p].name} gewinnt das Spiel!`, darts: dartsUsed };
    }
    const starter = nextPlayer(state);
    resetLeg(state, starter);
    return { ...ev, type: 'leg', message: `Leg an ${state.players[p].name} (${dartsUsed} Darts)`, darts: dartsUsed };
  }

  if (leg.visit.length >= 3) {
    pushVisit(state, p, false);
    endVisit(state);
    return { ...ev, type: 'turn', message: 'Wechsel' };
  }
  return ev;
}

// Checkout-Vorschlag-Kontext fuer den Spieler am Zug
export function currentCheckoutHint(state, dartsLeft) {
  if (!state.doubleOut) return null;
  const rest = state.leg.remaining[state.current];
  if (rest > 170 || rest < 2) return null;
  return { rest, dartsLeft };
}

export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}
