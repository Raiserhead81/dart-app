// Spiel-Ansicht: X01 (101-1001) und Cricket, Board- + Zahlen-Eingabe, Caller, Undo.

import { newX01, applyDart, cloneState } from '/js/core/x01.js';
import { newCricket, applyCricketDart, cricketNextTurn } from '/js/core/cricket.js';
import { buildX01GameRecord } from '/js/core/result.js';
import { parseThrowInput, makeThrow, splitHint, segmentCode } from '/js/core/segments.js';
import { suggestCheckout, checkoutHint } from '/js/core/checkout.js';
import { addGame } from '/js/core/storage.js';
import { buildBoard } from '/js/board.js';
import { el, icon, toast, uid } from '/js/util.js';
import { callThrow, callVisitEnd, callGameShot, callBust, callDoubleRequired, clearQueue, preloadForRest, callerSettings } from '/js/caller-voice.js';
import { activePlayer, store, rerender, navigate } from '/js/app.js';
import { cricketMarksTable } from '/js/views/cricket-ui.js';

const STARTS = [101, 170, 301, 501, 701, 1001];

export function renderPlay(view, arg) {
  const session = store.state.session;
  if (session && session.type === 'cricket') return renderCricketGame(view);
  if (session && session.type === 'x01') return renderX01Game(view);
  return renderSetup(view);
}

/* ---------------- Setup ---------------- */
function renderSetup(view) {
  const profiles = store.state.profiles.map(p => p.name);
  const players = [activePlayer(), ...profiles.filter(p => p !== activeProfileExtra())].slice(0, 4);
  function activeProfileExtra() { return '___none___'; }

  const names = [...new Set([activePlayer(), ...profiles, 'Spieler 2', 'Spieler 3', 'Spieler 4'])].slice(0, 4);
  const sel = { mode: store.state.settings.lastMode || 'x01', start: 501, doubleOut: true, doubleIn: false, firstTo: 3, count: 1 };

  const nameInputs = names.map((n, i) => el('input', {
    type: 'text', value: i === 0 ? n : n.startsWith('Spieler') ? '' : n,
    'data-pi': i, placeholder: 'Spieler ' + (i + 1), maxlength: 24
  }));

  const startChips = STARTS.map(s => el('button', {
    class: 'chip num' + (s === 501 ? ' on' : ''), onclick: (e) => {
      sel.start = s;
      startChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, String(s)));

  const ftChips = [1, 2, 3, 5].map(n => el('button', {
    class: 'chip' + (n === 3 ? ' on' : ''), onclick: (e) => {
      sel.firstTo = n;
      ftChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, `First to ${n}`));

  const countChips = [1, 2, 3, 4].map(n => el('button', {
    class: 'chip num' + (n === 1 ? ' on' : ''), onclick: (e) => {
      sel.count = n;
      countChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, String(n)));

  const modeChips = [
    ['x01', 'X01'], ['cricket', 'Cricket'], ['cutthroat', 'Cut-Throat']
  ].map(([v, label]) => el('button', {
    class: 'chip' + (v === sel.mode ? ' on' : ''), onclick: (e) => {
      sel.mode = v;
      modeChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
      x01opts.style.display = v === 'x01' ? '' : 'none';
    }
  }, label));

  const outBtn = toggleChip('Double Out', true, v => sel.doubleOut = v);
  const inBtn = toggleChip('Double In', false, v => sel.doubleIn = v);
  const x01opts = el('div', {}, el('div', { class: 'row mt' }, outBtn, inBtn));

  const startBtn = el('button', {
    class: 'btn primary wide mt', onclick: () => {
      const chosen = [...view.querySelectorAll('input[data-pi]')]
        .map((inp, i) => inp.value.trim())
        .filter(Boolean)
        .slice(0, sel.count);
      if (!chosen.length) return toast('Mindestens ein Spielername');
      if (sel.mode === 'x01') {
        const st = newX01({ start: sel.start, players: chosen, doubleOut: sel.doubleOut, doubleIn: sel.doubleIn, firstTo: sel.firstTo, id: uid() });
        store.state.session = { type: 'x01', state: st, snapshots: [], inputMode: 'board', date: new Date().toISOString() };
      } else {
        const st = newCricket({ players: chosen, cutThroat: sel.mode === 'cutthroat' });
        store.state.session = { type: 'cricket', state: st, snapshots: [], date: new Date().toISOString() };
      }
      store.state.settings.lastMode = sel.mode;
      store.save();
      window.__DARTPRO_SESSION_ACTIVE = true;
      rerender();
    }
  }, icon('i-plus'), 'Spiel starten');

  view.append(
    el('p', { class: 'kicker' }, 'Spielen'),
    el('h1', { class: 'serif', style: 'margin:0 0 14px;font-size:30px' }, 'Neues Spiel'),
    el('div', { class: 'panel' },
      el('h2', {}, 'Modus'),
      el('div', { class: 'row' }, ...modeChips),
      x01opts,
      el('div', { class: 'row mt' }, ...startChips),
      el('div', { class: 'row mt' }, ...ftChips)
    ),
    el('div', { class: 'panel' },
      el('h2', {}, 'Spieler', el('span', { class: 'sub' }, '1 bis 4, lokal')),
      el('div', { class: 'row' }, ...countChips),
      el('div', { class: 'grid mt', style: 'grid-template-columns:repeat(auto-fill,minmax(200px,1fr))' }, ...nameInputs)
    ),
    startBtn
  );
}

function toggleChip(label, init, cb) {
  const b = el('button', { class: 'chip' + (init ? ' on' : ''), onclick: () => { const on = b.classList.toggle('on'); cb(on); } }, label);
  return b;
}

/* ---------------- X01 laufendes Spiel ---------------- */
function renderX01Game(view) {
  const session = store.state.session;
  const st = session.state;
  view.innerHTML = '';
  view.append(el('p', { class: 'kicker' }, `X01 · ${st.start} · ${st.doubleOut ? 'Double Out' : 'Straight Out'}${st.doubleIn ? ' · Double In' : ''} · First to ${st.firstTo}`));

  const banner = el('div', { id: 'banner' });
  const pcards = el('div', { class: 'scorehead', id: 'pcards' });
  const visitbar = el('div', { class: 'visitbar', id: 'visitbar' });
  const checkoutLine = el('div', { class: 'checkout center', id: 'coline' });
  const boardwrap = el('div', { class: 'boardwrap' }, pcards, visitbar, banner, checkoutLine);

  const onThrow = (seg) => doThrow(session, makeThrow(seg.kind === 'bull' ? 'bull' : seg.kind, seg.number), { board: seg, rerenderView: () => renderX01Game(view) });
  const board = buildBoard({ onThrow });
  boardwrap.append(board);

  // Eingabe-Modus
  const modeBoard = el('button', {
    class: 'chip' + (session.inputMode === 'board' ? ' on' : ''), onclick: () => { session.inputMode = 'board'; store.save(); renderX01Game(view); }
  }, 'Board');
  const modeNum = el('button', {
    class: 'chip' + (session.inputMode === 'num' ? ' on' : ''), onclick: () => { session.inputMode = 'num'; store.save(); renderX01Game(view); }
  }, 'Zahlen');
  view.append(el('div', { class: 'panel tight' },
    el('div', { class: 'modebar' },
      modeBoard, modeNum,
      el('button', { class: 'chip', onclick: () => undo(session) }, icon('i-undo'), 'Undo'),
      el('button', { class: 'chip red', onclick: endEarly }, icon('i-x'), 'Beenden')
    )
  ));

  if (session.inputMode === 'num') boardwrap.append(renderKeypad(session, () => renderX01Game(view)));
  view.append(boardwrap);
  paintX01(view, session, banner);
}

function renderKeypad(session, refresh) {
  const st = session.state;
  const rest = st.leg.remaining[st.current];
  let prefix = 'S';
  const input = el('input', { type: 'text', inputmode: 'numeric', placeholder: 'Summe oder Segment (z.B. 60 oder T20)', style: 'max-width:430px' });
  const hint = el('div', { class: 'small muted center', style: 'width:100%;max-width:430px' });
  const updateHint = () => {
    const v = parseInt(input.value, 10);
    if (v > 0 && v <= 180) {
      const parts = splitHint(v);
      hint.textContent = `${v} = ${parts.join(' + ')}`;
    } else hint.textContent = prefix === 'S' ? '' : ({ S: 'Single', D: 'Doppel', T: 'Triple' })[prefix] + ' wird vorangestellt';
  };
  input.addEventListener('input', updateHint);
  const pfxBtns = [['S', 'Single'], ['D', 'Doppel'], ['T', 'Triple']].map(([p, l]) => el('button', {
    class: 'chip' + (p === 'S' ? ' on' : ''), onclick: (e) => {
      prefix = p; pfxBtns.forEach(b => b.classList.remove('on'));
      e.currentTarget.classList.add('on'); updateHint();
    }
  }, l));
  const numbers = [];
  for (let n = 20; n >= 1; n--) numbers.push(n);
  const keys = numbers.map(n => el('button', {
    onclick: () => {
      const t = makeThrow(prefix === 'S' ? 'single' : prefix === 'D' ? 'double' : 'triple', n);
      doThrow(session, t, { board: { number: n, kind: prefix === 'S' ? 'single' : prefix === 'D' ? 'double' : 'triple' }, rerenderView: refresh });
    }
  }, (prefix === 'S' ? '' : prefix) + n));
  const wrap = el('div', { style: 'display:flex;flex-direction:column;align-items:center;gap:8px;width:100%' },
    el('div', { class: 'row', style: 'justify-content:center' }, ...pfxBtns),
    input,
    hint,
    el('div', { class: 'row', style: 'justify-content:center' },
      el('button', {
        class: 'btn small primary', onclick: () => {
          const raw = input.value.trim();
          const t = parseThrowInput(raw);
          if (!t) return toast('Ungueltige Eingabe');
          const segInfo = t.k === 'sum' ? null : { number: t.n, kind: t.k };
          doThrow(session, t, { board: segInfo, rerenderView: refresh });
          input.value = ''; updateHint();
        }
      }, 'Wurf eintragen'),
      el('button', { class: 'btn small', onclick: () => doThrow(session, makeThrow('miss', 0), { rerenderView: refresh }) }, 'Miss')
    ),
    el('div', { class: 'keypad' }, ...keys),
    el('div', { class: 'row', style: 'justify-content:center' },
      el('button', { class: 'chip num', onclick: () => doThrow(session, makeThrow('outer', 25), { board: { number: 25, kind: 'outer' }, rerenderView: refresh }) }, '25'),
      el('button', { class: 'chip num', onclick: () => doThrow(session, makeThrow('bull', 50), { board: { number: 50, kind: 'bull' }, rerenderView: refresh }) }, 'Bull 50')
    )
  );
  return wrap;
}

function snapshot(session) {
  session.snapshots.push(JSON.stringify(session.state));
  if (session.snapshots.length > 60) session.snapshots.shift();
}

function undo(session) {
  const prev = session.snapshots.pop();
  if (!prev) return toast('Nichts zum Rueckgaengigmachen');
  session.state = JSON.parse(prev);
  store.save();
  clearQueue();
  rerender();
}

function endEarly() {
  const session = store.state.session;
  if (session && confirm('Spiel beenden und werten?')) {
    finishSession(session, true);
  }
}

function doThrow(session, t, { board = null, rerenderView } = {}) {
  const st = session.state;
  const isX01 = session.type === 'x01';
  snapshot(session);
  clearQueue();

  if (isX01) {
    const playerIdx = st.current;
    const restBefore = st.leg.remaining[playerIdx];
    const dartsInVisit = st.leg.visit.length;
    const forMatch = st.legsWon[playerIdx] === st.firstTo - 1;
    const ev = applyDart(st, t);
    store.save();

    if (board) callThrow({ k: t.k, n: t.n, v: ev.throw.v });
    if (ev.type === 'bust') callBust();
    if (ev.type === 'ok') {
      // Zwischenruf: nach Dart 2 nur noch ein Doppel noetig
      const restNow = st.leg.remaining[st.current];
      const isSimpleDouble = restNow === 50 || (restNow >= 2 && restNow <= 40 && restNow % 2 === 0);
      if (isSimpleDouble && st.leg.visit.length < 3 && dartsInVisit >= 1) callDoubleRequired(restNow === 50 ? 50 : restNow / 2, forMatch);
      preloadForRest(st.leg.remaining[st.current]);
    }
    if (ev.type === 'turn' || ev.type === 'noin') callVisitEnd(st.leg.remaining[st.current], { forMatch });
    if (ev.type === 'bust') callVisitEnd(st.leg.remaining[st.current], { forMatch });
    if (ev.type === 'leg') callGameShot(st.firstTo - st.legsWon[playerIdx]);
    if (ev.type === 'match') { callGameShot(0); finishSession(session, false, ev); return ev; }

    if (rerenderView) rerenderView();
    return ev;
  }

  // Cricket
  const ev = applyCricketDart(st, t);
  callThrow({ k: t.k, n: t.n, v: t.v });
  if (ev.type === 'match') { callGameShot(0); finishSession(session, false, ev); return ev; }
  session.visitCount = (session.visitCount || 0) + 1;
  if (session.visitCount >= 3) { cricketNextTurn(st); session.visitCount = 0; }
  store.save();
  if (rerenderView) rerenderView();
  return ev;
}

function paintX01(view, session, banner) {
  const st = session.state;
  const cards = view.querySelector('#pcards');
  if (!cards) return;
  cards.innerHTML = '';
  st.players.forEach((p, i) => {
    const rest = st.leg.remaining[i];
    const turn = st.current === i && !st.finished;
    cards.append(el('div', { class: 'pcard' + (turn ? ' turn' : '') },
      el('div', { class: 'name' }, p.name, st.legsWon[i] ? ` · ${st.legsWon[i]}` : ''),
      el('div', { class: 'rest num' }, String(rest)),
      el('div', { class: 'meta' }, turn ? 'am Zug' : '')
    ));
  });
  const vb = view.querySelector('#visitbar');
  vb.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const code = st.leg.visit[i];
    vb.append(el('div', { class: 'dartpill' + (code ? '' : ' empty') }, code || '·'));
  }
  const co = view.querySelector('#coline');
  co.innerHTML = '';
  const rest = st.leg.remaining[st.current];
  if (!st.finished && st.doubleOut && rest <= 170 && rest >= 2) {
    const route = suggestCheckout(rest, 3 - st.leg.visit.length);
    if (route) {
      const forMatch = st.legsWon[st.current] === st.firstTo - 1;
      co.append(el('div', {}, `${route.join(' ')}${forMatch ? '  (for the match)' : ''}`));
      preloadForRest(rest);
    }
  }
  banner.innerHTML = '';
}

/* ---------------- Abschluss ---------------- */
export function finishSession(session, aborted, ev = null) {
  window.__DARTPRO_SESSION_ACTIVE = false;
  const st = session.state;
  const date = session.date || new Date().toISOString();
  let record = null;
  if (session.type === 'x01') {
    record = buildX01GameRecord(st, { id: st.id || uid(), date });
    const dur = (Date.now() - new Date(date).getTime()) / 1000;
    record.durationSec = Math.round(dur);
    addGame(store.state, record);
  } else {
    const winnerName = st.winner >= 0 ? st.players[st.winner].name : null;
    record = {
      id: uid(), kind: session.type === 'cricket' ? 'cricket' : 'cutthroat', mode: st.mode,
      label: st.mode === 'cutthroat' ? 'Cut-Throat' : 'Cricket',
      date,
      players: st.players.map(p => p.name),
      results: st.players.map((p, i) => ({
        player: p.name, won: st.winner === i, marks: st.marks[i], points: st.points[i]
      })),
      finished: st.finished,
      aborted
    };
    addGame(store.state, record);
  }
  store.state.session = null;
  store.save();
  clearQueue();
  showResultDialog(record, aborted, ev);
}

function showResultDialog(record, aborted, ev) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  const winner = record.results?.find(r => r.won);
  view.append(
    el('p', { class: 'kicker' }, aborted ? 'Spiel abgebrochen & gewertet' : 'Game Shot!'),
    el('div', { class: 'panel' },
      el('h2', {}, winner ? `${winner.player} gewinnt` : 'Ergebnis'),
      el('div', { class: 'list' },
        ...record.results.map(r => el('div', { class: 'listitem' },
          el('div', { class: 'grow' },
            el('div', { class: 'title' }, r.player),
            el('div', { class: 'sub num' },
              record.kind === 'x01'
                ? `Avg ${r.avg3 != null ? String(r.avg3).replace('.', ',') : '-'} · ${r.darts} Darts · Legs ${r.legsWon}/${r.legsPlayed}`
                : `Punkte ${r.points ?? 0}`
            )
          ),
          r.won ? icon('i-trophy') : ''
        ))
      ),
      record.kind === 'x01' ? el('div', { class: 'grid kpi mt' },
        ...record.results.map(r => el('div', { class: 'kpi' },
          el('div', { class: 'label' }, r.player),
          el('div', { class: 'value num' }, r.avg3 != null ? String(r.avg3).replace('.', ',') : '-'),
          el('div', { class: 'small muted' }, `100+ ${r.counts.c100} · 140+ ${r.counts.c140} · 180 ${r.counts.c180} · Checkout ${r.checkouts.attempts ? Math.round(r.checkouts.hits / r.checkouts.attempts * 100) + '%' : '-'}`
          )
        ))
      ) : ''
    ),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary', onclick: () => { location.hash = '#/play'; rerender(); } }, 'Neues Spiel'),
      el('button', { class: 'btn', onclick: () => { location.hash = '#/stats'; rerender(); } }, 'Zur Statistik')
    )
  );
}

/* ---------------- Cricket-Ansicht ---------------- */
function renderCricketGame(view) {
  const session = store.state.session;
  const st = session.state;
  view.innerHTML = '';
  view.append(el('p', { class: 'kicker' }, st.mode === 'cutthroat' ? 'Cricket · Cut-Throat' : 'Cricket · Standard'));
  const panel = cricketMarksTable(st);
  view.append(panel);
  const boardwrap = el('div', { class: 'boardwrap' });
  const board = buildBoard({
    onThrow: (seg) => doThrow(session, makeThrow(seg.kind, seg.number), { rerenderView: () => renderCricketGame(view) })
  });
  boardwrap.append(board);
  const modeBoard = el('button', {
    class: 'chip', onclick: () => { store.state.session = null; window.__DARTPRO_SESSION_ACTIVE = false; store.save(); rerender(); }
  }, icon('i-x'), 'Abbrechen (ohne Wertung)');
  view.append(
    el('div', { class: 'panel tight' }, el('div', { class: 'modebar' }, modeBoard)),
    boardwrap
  );
}
