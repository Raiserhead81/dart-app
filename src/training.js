// Trainingsspiele: Around the Clock, Shanghai, Bob's 27, Doubles-ATC, 25 Darts auf T20.
// Alle reine Logik + Statistik-Rohdaten (throws) fuer die Gesamtauswertung.

import { KIND_BULL, KIND_DOUBLE, KIND_TRIPLE, KIND_MISS } from './segments.js';
import { checkoutTableFull } from './checkout.js';

export const TRAINING_TYPES = {
  atc: 'Around the Clock',
  doublesAtc: 'Doubles Around the Clock',
  shanghai: 'Shanghai',
  bob27: "Bob's 27",
  t20: '25 Darts auf T20',
  checkout: 'Checkout-Training'
};

export const CHECKOUT_RESTS = [170, 167, 164, 161, 160, 141, 132, 121, 110, 96, 81, 64, 40, 32];

export function newTraining(type, opts = {}) {
  const base = {
    v: 1,
    mode: 'training',
    type,
    label: TRAINING_TYPES[type] || type,
    createdAt: opts.createdAt || new Date().toISOString(),
    throws: [],
    finished: false,
    player: opts.player || 'Spieler 1'
  };
  switch (type) {
    case 'atc':
      return { ...base, targets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 'BULL'], idx: 0 };
    case 'doublesAtc':
      return { ...base, targets: ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'BULL'], idx: 0 };
    case 'shanghai':
      return { ...base, round: 1, score: 0, shanghai: false, finished: false, visit: [] };
    case 'bob27':
      return { ...base, round: 1, score: 27, maxRounds: 21, visit: [] };
    case 't20':
      return { ...base, dartsLeft: 25, hits: 0, score: 0 };
    case 'checkout':
      return { ...base, rests: [...CHECKOUT_RESTS], pos: 0, idx: 0, route: null, routeHits: 0, misses: 0, done: 0 };
    default:
      throw new Error('Unbekanntes Training: ' + type);
  }
}

function isBull(thr) { return thr.k === KIND_BULL; }

function hitsTargetAtc(state, thr) {
  const t = state.targets[state.idx];
  if (t === 'BULL') return isBull(thr);
  const n = typeof t === 'number' ? t : parseInt(String(t).slice(1), 10);
  if (thr.n !== n) return false;
  if (state.type === 'doublesAtc') return thr.k === KIND_DOUBLE || isBull(thr) && n === 50;
  return true;
}

export function applyTrainingDart(state, thr) {
  if (state.finished) return { type: 'done', message: 'Training beendet' };
  state.throws.push({ ...thr });
  const ev = { type: 'ok', throw: thr };

  if (state.type === 'atc' || state.type === 'doublesAtc') {
    if (hitsTargetAtc(state, thr)) {
      state.idx++;
      ev.hit = true;
      ev.message = 'Treffer! Naechstes Ziel: ' + (state.targets[state.idx] ?? 'Ende');
      if (state.idx >= state.targets.length) {
        state.finished = true;
        ev.type = 'done';
        ev.message = `Komplett in ${state.throws.length} Darts!`;
      }
    }
    return ev;
  }

  if (state.type === 't20') {
    state.dartsLeft--;
    if (thr.k === KIND_TRIPLE && thr.n === 20) { state.hits++; state.score += 60; ev.hit = true; }
    else if (thr.k !== KIND_MISS && thr.n === 20) { state.score += thr.v; }
    if (state.dartsLeft <= 0) {
      state.finished = true;
      ev.type = 'done';
      ev.message = `Fertig: ${state.hits}/25 Triple-20 (${state.score} Punkte)`;
    }
    return ev;
  }

  if (state.type === 'shanghai') {
    const target = state.round;
    let pts = 0;
    if (thr.n === target && thr.k !== KIND_MISS) {
      pts = thr.k === KIND_TRIPLE ? 3 : thr.k === KIND_DOUBLE ? 2 : 1;
      state.score += pts;
    }
    const seg = { ...thr, pts };
    state.visit.push(seg);
    // Shanghai = Triple+Double+Single der Rundenzahl in einem Visit
    const kinds = new Set(state.visit.filter(v => v.n === target && v.k !== KIND_MISS).map(v => v.k));
    if (kinds.has(KIND_TRIPLE) && kinds.has(KIND_DOUBLE) && kinds.has('single')) {
      state.shanghai = true;
      state.finished = true;
      ev.type = 'done';
      ev.message = 'SHANGHAI! Automatischer Gesamtsieg!';
      return ev;
    }
    if (state.visit.length >= 3) {
      state.visit = [];
      if (state.round >= 7) {
        state.finished = true;
        ev.type = 'done';
        ev.message = `Shanghai beendet: ${state.score} Punkte`;
      } else {
        state.round++;
        ev.message = 'Runde ' + state.round;
      }
    }
    return ev;
  }

  if (state.type === 'checkout') {
    // Route laden / weiterspielen: erwartet Segment-Code, Treffer pruefen
    if (!state.route) {
      state.route = checkoutTableFull(state.rests[state.pos]) || ['D20'];
    }
    const want = state.route[state.idx];
    const got = thr.c === '50' ? 'Bull' : thr.c;
    if (got === want) {
      state.idx++;
      state.routeHits++;
      ev.hit = true;
      ev.message = `${want} – weiter!`;
      if (state.idx >= state.route.length) {
        state.idx = 0;
        state.route = null;
        state.done++;
        state.pos++;
        ev.message = `Checkout ${state.done}/${state.rests.length} geschafft!`;
        if (state.pos >= state.rests.length) {
          state.finished = true;
          ev.type = 'done';
          ev.message = `Checkout-Training fertig: ${state.routeHits} Treffer, ${state.misses} Fehler`;
        }
      }
    } else {
      state.misses++;
      ev.hit = false;
      ev.message = `Falsch – erwartet: ${want}`;
    }
    return ev;
  }

  if (state.type === 'bob27') {
    const d = state.round <= 20 ? state.round : 50; // Runde 21 = Bull (D25)
    const hits = (thr.k === KIND_DOUBLE && thr.n === d) || (d === 50 && isBull(thr)) ? 1 : 0;
    state.visit.push(hits);
    ev.hit = hits > 0;
    if (state.visit.length >= 3) {
      const h = state.visit.reduce((a, b) => a + b, 0);
      state.visit = [];
      if (h === 0) {
        state.score -= 2 * d; // kompletter Miss: Abzug des Doppelwerts
      } else {
        state.score += 2 * d * h;
      }
      if (state.round >= state.maxRounds || state.score <= 0) {
        state.finished = true;
        ev.type = 'done';
        ev.message = state.score <= 0 ? `Aus bei D${state.round <= 20 ? state.round : 'Bull'} – Score ${state.score}` : `Bob's 27 fertig: ${state.score}`;
      } else {
        state.round++;
        ev.message = 'Naechstes Doppel: ' + (state.round <= 20 ? 'D' + state.round : 'Bull');
      }
    } else {
      ev.message = hits ? 'Treffer!' : 'Daneben';
    }
    return ev;
  }

  return ev;
}

// Kenzahlen eines Trainings
export function trainingSummary(state) {
  const t = state.throws;
  switch (state.type) {
    case 'atc':
    case 'doublesAtc': {
      const done = state.finished;
      return {
        headline: done ? `${state.throws.length} Darts bis komplett` : `Ziel ${state.idx + 1}/${state.targets.length}`,
        detail: done ? null : `${state.targets[state.idx]} als naechstes`,
        darts: t.length,
        progress: state.idx / state.targets.length
      };
    }
    case 't20':
      return {
        headline: `${state.hits}/25 Triple-20`,
        detail: `${state.score} Punkte, Quote ${Math.round((state.hits / Math.max(1, 25 - state.dartsLeft)) * 100)}%`,
        darts: t.length,
        progress: 1 - state.dartsLeft / 25
      };
    case 'shanghai':
      return { headline: `${state.score} Punkte`, detail: `Runde ${state.round}/7`, darts: t.length, progress: (state.round - 1) / 7 };
    case 'bob27':
      return { headline: `Score ${state.score}`, detail: `Doppel ${state.round <= 20 ? state.round : 'Bull'}`, darts: t.length, progress: state.round / 21 };
    case 'checkout':
      return { headline: `${state.done}/${state.rests.length} Reste`, detail: `${state.routeHits} Treffer, ${state.misses} Fehler`, darts: t.length, progress: state.done / state.rests.length, score: state.routeHits, dartsOnTarget: state.routeHits };
    default:
      return { headline: '-', detail: '', darts: t.length, progress: 0 };
  }
}
