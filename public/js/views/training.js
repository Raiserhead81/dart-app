// Training: ATC, Doubles-ATC, Shanghai, Bob's 27, 25-Darts-T20, Checkout-Training.

import { newTraining, applyTrainingDart, trainingSummary, TRAINING_TYPES } from '/js/core/training.js';
import { checkoutTableFull } from '/js/core/checkout.js';
import { addGame } from '/js/core/storage.js';
import { buildBoard } from '/js/board.js';
import { el, icon, uid } from '/js/util.js';
import { callThrow, clearQueue } from '/js/caller-voice.js';
import { store, rerender, navigate } from '/js/app.js';
import { makeThrow } from '/js/core/segments.js';

const DESCRIPTIONS = {
  atc: 'Alle Felder von 1 bis 20 und Bull. Zählt Darts – weniger ist besser.',
  doublesAtc: 'ATC nur auf Doubles: D1 bis D20, dann Bull. Der Doppel-Drill.',
  shanghai: 'Runden 1 bis 7, je 3 Darts auf die Runden-Zahl. Single 1, Doppel 2, Triple 3 Punkte. Shanghai (S+D+T in einer Runde) = Gesamtsieg.',
  bob27: 'Start 27 Punkte. Je Runde 3 Darts auf D1 bis D20, dann Bull. Treffer +2×Wert, kompletter Miss −2×Wert. Unter 0 = Ende.',
  t20: '25 Darts auf Triple 20. Benchmark: 8/25 solide, 12/25 stark.',
  checkout: '14 klassische Reste (32 bis 170). Die Route wird angezeigt – wirf sie Darts für Darts nach.'
};

export function renderTraining(view, arg) {
  const session = store.state.session;
  if (session && session.type === 'training') return renderTrainingGame(view);
  return renderTrainingMenu(view, arg);
}

function renderTrainingMenu(view, arg) {
  // Direkteinstieg per #/training/<type>
  if (arg && TRAINING_TYPES[arg]) {
    startTraining(arg);
    return;
  }
  const cards = Object.entries(TRAINING_TYPES).map(([key, label]) => el('button', {
    class: 'listitem', style: 'text-align:left;cursor:pointer', onclick: () => startTraining(key)
  },
    el('div', { class: 'grow' },
      el('div', { class: 'title' }, label),
      el('div', { class: 'sub' }, DESCRIPTIONS[key])
    ),
    icon('i-bolt')
  ));
  const player = store.state.activeProfile || 'Spieler 1';
  view.append(
    el('p', { class: 'kicker' }, 'Training'),
    el('h1', { class: 'serif', style: 'margin:0 0 6px;font-size:30px' }, 'Drills'),
    el('p', { class: 'muted', style: 'margin:0 0 14px' }, `für ${player} – Ergebnisse fließen in die Wochen-Statistik ein`),
    el('div', { class: 'list' }, ...cards)
  );
}

function startTraining(type) {
  const s = newTraining(type, { player: store.state.activeProfile || 'Spieler 1' });
  store.state.session = { type: 'training', state: s, snapshots: [], date: new Date().toISOString() };
  store.save();
  window.__DARTPRO_SESSION_ACTIVE = true;
  rerender();
}

function renderTrainingGame(view) {
  const session = store.state.session;
  const s = session.state;
  view.innerHTML = '';
  view.append(el('p', { class: 'kicker' }, 'Training · ' + s.label));
  const sum = trainingSummary(s);

  // Kopfbereich je Typ
  let focus;
  if (s.type === 'atc' || s.type === 'doublesAtc') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, 'Aktuelles Ziel'),
      el('div', { class: 'value' }, String(s.targets[s.idx] ?? 'Fertig')));
  } else if (s.type === 'shanghai') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, `Runde ${s.round} – Ziel ${s.round}`),
      el('div', { class: 'value num' }, String(s.score)));
  } else if (s.type === 'bob27') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, `Doppel ${s.round <= 20 ? s.round : 'Bull'}`),
      el('div', { class: 'value num' }, String(s.score)), el('div', { class: 'small muted' }, 'Start 27 · Treffer +2×Wert · Miss-Runde −2×Wert'));
  } else if (s.type === 't20') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, 'Triple 20'),
      el('div', { class: 'value num' }, `${s.hits}/${25}`), el('div', { class: 'small muted' }, `${s.score} Punkte · noch ${s.dartsLeft} Darts`));
  } else if (s.type === 'checkout') {
    const rest = s.rests[s.pos];
    const route = s.route || checkoutTableFull(rest) || [];
    focus = el('div', { class: 'kpi', style: 'width:100%' },
      el('div', { class: 'label' }, `Rest ${rest} · Route`),
      el('div', { class: 'value', style: 'font-size:26px' }, route.join('  ')),
      el('div', { class: 'small muted' }, `${s.done}/${s.rests.length} Reste geschafft · ${s.routeHits} Treffer · ${s.misses} Fehler`)
    );
  }
  view.append(el('div', { class: 'grid kpi', style: 'grid-template-columns:1fr' }, focus),
    el('div', { class: 'small muted center mt' }, `${s.throws.length} Darts`));

  const boardwrap = el('div', { class: 'boardwrap' });
  const board = buildBoard({
    onThrow: (seg) => {
      clearQueue();
      session.snapshots.push(JSON.stringify(s));
      const t = makeThrow(seg.kind, seg.number);
      const ev = applyTrainingDart(s, t);
      callThrow({ k: t.k, n: t.n, v: t.v });
      if (ev.hit && s.type === 'checkout') toast(ev.message, 1400);
      else if (ev.message && s.type !== 'atc') toast(ev.message, 1400);
      else if (ev.hit) toast(ev.message || 'Treffer', 1200);
      if (ev.type === 'done') {
        finishTraining(session);
        return;
      }
      store.save();
      rerender();
    }
  });
  boardwrap.append(board);
  view.append(boardwrap);

  view.append(el('div', { class: 'row', style: 'justify-content:center' },
    el('button', {
      class: 'chip', onclick: () => {
        const prev = session.snapshots.pop();
        if (!prev) return;
        session.state = JSON.parse(prev);
        store.save(); rerender();
      }
    }, icon('i-undo'), 'Undo'),
    el('button', {
      class: 'chip red', onclick: () => {
        if (s.throws.length && confirm('Training beenden und werten?')) finishTraining(session);
        else { store.state.session = null; store.save(); rerender(); }
      }
    }, icon('i-x'), 'Beenden')
  ));
}

function finishTraining(session) {
  const s = session.state;
  const sum = trainingSummary(s);
  const record = {
    id: uid(), kind: 'training', mode: s.type, label: s.label,
    date: session.date || new Date().toISOString(),
    players: [s.player],
    results: [{ player: s.player, done: s.finished }],
    summary: {
      headline: sum.headline, detail: sum.detail,
      darts: s.throws.length,
      score: s.score ?? null, hits: s.hits ?? null,
      dartsOnTarget: s.type === 't20' ? 25 : s.type === 'checkout' ? s.rests?.length : null
    },
    boardThrows: s.throws.filter(t => t.k !== 'sum').map(t => ({ p: s.player, c: t.c, k: t.k, n: t.n, v: t.v }))
  };
  addGame(store.state, record);
  store.state.session = null;
  store.save();
  window.__DARTPRO_SESSION_ACTIVE = false;
  clearQueue();
  const view = document.getElementById('view');
  view.innerHTML = '';
  view.append(
    el('p', { class: 'kicker' }, 'Training beendet'),
    el('div', { class: 'panel center' },
      el('h2', {}, s.label),
      el('div', { class: 'value num', style: 'font-size:40px;font-weight:800;color:#e8dfc8' }, sum.headline),
      sum.detail ? el('div', { class: 'muted' }, sum.detail) : '',
      el('div', { class: 'muted small mt' }, `${s.throws.length} Darts`)
    ),
    el('div', { class: 'row', style: 'justify-content:center' },
      el('button', { class: 'btn primary', onclick: () => { startTraining(s.type); } }, 'Nochmal'),
      el('button', { class: 'btn', onclick: () => { location.hash = '#/stats'; rerender(); } }, 'Zur Statistik'),
      el('button', { class: 'btn ghost', onclick: () => { location.hash = '#/training'; rerender(); } }, 'Übersicht')
    )
  );
}
