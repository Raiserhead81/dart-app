// Spiel-Ansicht: TV-Broadcast-Layout (DartCounter-Sprache: grosse farbige Spielerkarten,
// riesige Scores). Zahlenpad ist die Haupteingabe — Tap zaehlt SOFORT, Auto-Weiter nach
// 3 Darts. Board nur optional als Overlay ("Scheibe zeigen", Standard aus).

import { newX01, applyDart, setupFromSettings } from '/js/core/x01.js';
import { newCricket, applyCricketDart, cricketNextTurn } from '/js/core/cricket.js';
import { buildX01GameRecord } from '/js/core/result.js';
import { makeThrow } from '/js/core/segments.js';
import { suggestCheckout } from '/js/core/checkout.js';
import { addGame } from '/js/core/storage.js';
import { buildBoard } from '/js/board.js';
import { el, icon, toast, uid } from '/js/util.js';
import { callDart, callVisitEnd, callGameShot, callSetWon, callWhatPerformance, callDoubleRequired, callBigFish, clearQueue, flushPending, callerBusyMs, callerSettings, preloadForRest, unlockAudio, warmAudioPool, warmClipCache, warmClipProgress } from '/js/caller-voice.js';
import { newRecordsBroken } from '/js/core/records.js';
import { turnHoldMs } from '/js/core/turnhold.js';
import { padThrow, padSpecial, pushSnapshot, popSnapshot, checkoutLine, HAPTIC } from '/js/core/pad.js';
import { activePlayer, store, rerender } from '/js/app.js';
import { cricketMarksTable } from '/js/views/cricket-ui.js';

const STARTS = [101, 170, 301, 501, 701, 1001];
const restTickMemo = {}; // letzter Rest je Spieler — fuer den Score-Tick beim Wechsel
export const PLAYER_COLORS = ['#ff7f2a', '#ff4757', '#2dd4bf', '#a78bfa'];

function buzz(pattern) {
  try { navigator.vibrate && navigator.vibrate(pattern); } catch (e) { /* egal */ }
}

export function renderPlay(view, arg) {
  const session = store.state.session;
  if (session && session.type === 'cricket') return renderCricketGame(view);
  if (session && session.type === 'x01') return renderX01Game(view);
  return renderSetup(view);
}

/* ---------------- Setup ---------------- */
function renderSetup(view) {
  const profiles = store.state.profiles.map(p => p.name);
  const names = [...new Set([activePlayer(), ...profiles, 'Spieler 2', 'Spieler 3', 'Spieler 4'])].slice(0, 4);
  // KAY-NEU: gemerkte Voreinstellung — zuletzt genutzte Kombi ist vorausgewaehlt
  const sel = { ...setupFromSettings(store.state.settings), doubleOut: true, doubleIn: false, count: 1, useBoard: false };

  const nameInputs = names.map((n, i) => el('input', {
    type: 'text', value: i === 0 ? n : n.startsWith('Spieler') ? '' : n,
    'data-pi': i, placeholder: 'Spieler ' + (i + 1), maxlength: 24
  }));

  const startChips = STARTS.map(s => el('button', {
    class: 'chip num' + (s === sel.start ? ' on' : ''), onclick: (e) => {
      sel.start = s;
      startChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, String(s)));

  const ftLabel = el('div', { class: 'small muted mt', style: 'margin:0 0 -6px' },
    sel.setsTo > 0 ? 'Legs pro Satz (Set)' : 'Legs fürs ganze Match (First to)');
  const ftChips = [1, 2, 3, 5].map(n => el('button', {
    class: 'chip' + (n === sel.firstTo ? ' on' : ''), onclick: (e) => {
      sel.firstTo = n;
      ftChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, `First to ${n}`));

  // KAY-NEU: Sätze konfigurierbar — Best of N oder nur Legs (Default)
  sel.setsTo = store.state.settings.lastSetsTo || 0;
  const setsLabel = el('div', { class: 'small muted mt', style: 'margin:0 0 -6px' }, 'Sätze');
  const setChips = [0, 3, 5, 7].map(n => el('button', {
    class: 'chip' + (sel.setsTo === n ? ' on' : ''), onclick: (e) => {
      sel.setsTo = n;
      store.state.settings.lastSetsTo = n;
      ftLabel.textContent = sel.setsTo > 0 ? 'Legs pro Satz (Set)' : 'Legs fürs ganze Match (First to)';
      setChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, n === 0 ? 'Keine Sets' : `Best of ${n} Sets`));

  const countChips = [1, 2, 3, 4].map(n => el('button', {
    class: 'chip num' + (n === 1 ? ' on' : ''), onclick: (e) => {
      sel.count = n;
      countChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, String(n)));

  const modeChips = [['x01', 'X01'], ['cricket', 'Cricket'], ['cutthroat', 'Cut-Throat']].map(([v, label]) => el('button', {
    class: 'chip' + (v === sel.mode ? ' on' : ''), onclick: (e) => {
      sel.mode = v;
      modeChips.forEach(c => c.classList.remove('on'));
      e.currentTarget.classList.add('on');
      x01opts.style.display = v === 'x01' ? '' : 'none';
    }
  }, label));

  const outBtn = toggleChip('Double Out', true, v => sel.doubleOut = v);
  const inBtn = toggleChip('Double In', false, v => sel.doubleIn = v);
  const boardBtn = toggleChip('Dartboard-Eingabe (Overlay)', false, v => sel.useBoard = v);
  const x01opts = el('div', {}, el('div', { class: 'row mt' }, outBtn, inBtn, boardBtn));

  const startBtn = el('button', {
    class: 'btn primary wide mt', onclick: () => {
      const chosen = [...view.querySelectorAll('input[data-pi]')].map(inp => inp.value.trim()).filter(Boolean).slice(0, sel.count);
      if (!chosen.length) return toast('Mindestens ein Spielername');
      if (sel.mode === 'x01') {
        const st = newX01({ start: sel.start, players: chosen, doubleOut: sel.doubleOut, doubleIn: sel.doubleIn, firstTo: sel.firstTo, setsTo: sel.setsTo, id: uid() });
        store.state.session = { type: 'x01', state: st, snapshots: [], useBoard: sel.useBoard, date: new Date().toISOString() };
      } else {
        const st = newCricket({ players: chosen, cutThroat: sel.mode === 'cutthroat' });
        store.state.session = { type: 'cricket', state: st, snapshots: [], useBoard: sel.useBoard, date: new Date().toISOString() };
      }
      store.state.settings.lastMode = sel.mode;
      store.state.settings.lastStart = sel.start;
      store.state.settings.lastFirstTo = sel.firstTo;
      store.state.settings.lastSetsTo = sel.setsTo;
      store.save();
      window.__DARTPRO_SESSION_ACTIVE = true;
      // KAY-NEU: Auto-Fullscreen im selben Tap (Geste-Constraint) — ohne Browserleiste
      try {
        const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
        if (!standalone && !document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) { /* egal */ }
      // iOS-PWA: Audio-Element-Pool JETZT (in der User-Geste) vorbereiten, damit
      // mitten im Spiel kein Element mehr erzeugt/entsperrt werden muss -> keine
      // abgeschnittenen Clips, Reihenfolge 100%.
      unlockAudio();
      warmAudioPool(6);
      warmClipCache(6); // KAY: ALLE Caller-Clips vorab in den Browser-Cache
      if (sel.mode === 'x01') preloadForRest(sel.start);
      rerender();
    }
  }, icon('i-plus'), 'Spiel starten');

  const warmLine = el('p', { class: 'kicker', id: 'clipwarm', style: 'margin:6px 0 0;font-size:11px' }, '');
  (function tickWarm() {
    const w = warmClipProgress();
    if (!w.running && w.total === 0) { import('/js/caller-voice.js').then(m => m.warmClipCache(6)).catch(() => {}); }
    warmLine.textContent = w.running ? 'Caller wird geladen \u2026 ' + Math.round(w.done / Math.max(1, w.total) * 100) + ' %' : '';
    if (w.running) setTimeout(tickWarm, 500);
  })();

  view.append(
    el('p', { class: 'kicker' }, 'Spielen'),
    warmLine,
    el('h1', { class: 'display', style: 'margin:0 0 14px' }, 'Neues Spiel'),
    el('div', { class: 'panel' },
      el('h2', {}, 'Modus'),
      el('div', { class: 'row' }, ...modeChips),
      x01opts,
      el('div', { class: 'row mt' }, ...startChips),
      ftLabel,
      el('div', { class: 'row' }, ...ftChips),
      setsLabel,
      el('div', { class: 'row' }, ...setChips)
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

/* ---------------- X01: TV-Spielscreen ---------------- */
function renderX01Game(view) {
  const session = store.state.session;
  const st = session.state;
  view.innerHTML = '';
  view.className = 'view view-game';

  const top = el('div', { class: 'gtop' },
    el('span', { class: 'glabel' }, `X01 ${st.start} · ${st.doubleOut ? 'DO' : 'SO'} · ${st.setsTo ? `Best of ${st.setsTo} Sets · First to ${st.firstTo}` : `Best of ${st.firstTo}`}`),
    el('span', { class: 'spacer' }),
    el('button', { class: 'gbtn', onclick: () => undo(session), title: 'Undo' }, icon('i-undo'), el('span', { class: 'hide-sm' }, 'Undo')),
    session.useBoard ? el('button', { class: 'gbtn', onclick: () => showBoardOverlay(session) }, icon('i-target'), el('span', { class: 'hide-sm' }, 'Scheibe')) : '',
    matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches ? '' : el('button', { class: 'gbtn', onclick: () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} }, title: 'Vollbild' }, icon('i-target'), el('span', { class: 'hide-sm' }, 'Vollbild')),
    el('button', { class: 'gbtn danger', onclick: endEarly, title: 'Spiel beenden' }, el('span', {}, 'Beenden'))
  );

  const cards = el('div', { class: 'scorecards', id: 'scorecards' });
  const checkout = el('div', { class: 'checkout-banner', id: 'coline' });
  const visitbar = el('div', { class: 'visitbar', id: 'visitbar' });
  const pad = el('div', { class: 'pad', id: 'pad' });

  view.append(top, cards, checkout, visitbar, pad);
  view.append(el('div', { id: 'bigevent' }), el('div', { id: 'boardoverlay' }));

  paintGame(view, session);
  buildPad(view, session);

  // KAY-NEU: laufendes Spiel fortgesetzt -> erster Tap im Spiel holt Vollbild (Geste noetig)
  if (!window.matchMedia?.('(display-mode: standalone)').matches) {
    view.addEventListener('pointerdown', () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) { /* egal */ }
    }, { once: true });
  }
}

/* ---- Pad: Tap zaehlt SOFORT ---- */
function buildPad(view, session) {
  const pad = view.querySelector('#pad');
  if (!pad) return;
  session.padMode = session.padMode || 'single';

  const modeRow = el('div', { class: 'padmodes' });
  const modeBtns = [['single', 'SINGLE'], ['double', 'DOUBLE'], ['triple', 'TRIPLE']].map(([m, label]) => el('button', {
    class: 'padmode' + (session.padMode === m ? ' on' : ''),
    onclick: (e) => {
      session.padMode = m;
      buzz(HAPTIC.tap);
      modeBtns.forEach(b => b.classList.remove('on'));
      e.currentTarget.classList.add('on');
    }
  }, label));
  modeRow.append(...modeBtns);

  const grid = el('div', { class: 'padgrid' });
  for (let n = 20; n >= 1; n--) {
    grid.append(el('button', {
      class: 'padkey num',
      onclick: () => {
        firePad(session, view, () => padThrow(session.padMode, n));
        // KAY: DOUBLE/TRIPLE gelten nur fuer DEN EINEN Wurf — danach automatisch zurueck auf SINGLE
        if (session.padMode !== 'single') {
          session.padMode = 'single';
          modeBtns.forEach(b => b.classList.toggle('on', b.textContent === 'SINGLE'));
        }
      }
    }, String(n)));
  }

  const special = el('div', { class: 'padspecial' },
    el('button', { class: 'padkey hot num', onclick: () => firePad(session, view, () => padSpecial('t20')) }, 'T20'),
    el('button', { class: 'padkey num', onclick: () => firePad(session, view, () => padSpecial('25')) }, '25'),
    el('button', { class: 'padkey bull num', onclick: () => firePad(session, view, () => padSpecial('bull')) }, 'BULL'),
    el('button', { class: 'padkey miss', onclick: () => firePad(session, view, () => padSpecial('miss')) }, 'MISS'),
    el('button', { class: 'padkey undo', onclick: () => undo(session), title: 'Undo' }, icon('i-undo'))
  );

  pad.append(modeRow, grid, special);
}

function firePad(session, view, makeThr) {
  doThrow(session, makeThr(), { rerenderView: () => renderX01Game(view) });
}

function showBoardOverlay(session) {
  const host = document.getElementById('boardoverlay');
  if (!host) return;
  host.innerHTML = '';
  const sheet = el('div', { class: 'sheet' },
    el('div', { class: 'sheet-head' },
      el('span', { class: 'kicker', style: 'margin:0' }, 'Dartboard — Tap zählt sofort'),
      el('button', { class: 'gbtn', onclick: () => { host.innerHTML = ''; } }, icon('i-x'))),
    buildBoard({
      onThrow: (seg) => {
        host.innerHTML = '';
        doThrow(session, makeThrow(seg.kind, seg.number), { rerenderView: () => renderX01Game(document.getElementById('view')) });
      }
    })
  );
  host.append(sheet);
}

/* ---- Zeichnen ---- */
function paintGame(view, session) {
  const st = session.state;
  const cards = view.querySelector('#scorecards');
  if (!cards) return;
  cards.innerHTML = '';

  st.players.forEach((p, i) => {
    const rest = st.leg.remaining[i];
    const turn = st.current === i && !st.finished;
    const darts = st.throws[i].length;
    const avg = darts > 0 ? Math.round((st.start - st.leg.remaining[i]) / darts * 3 * 10) / 10 : null;
    const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
    const legBoxes = [];
    for (let l = 0; l < st.firstTo; l++) legBoxes.push(el('span', { class: 'legbox' + (l < st.legsWon[i] ? ' won' : '') }));
    // KAY-NEU: Sets-Chips neben den Leg-Chips (nur im Sets-Modus)
    const setChipsUi = st.setsTo ? [el('span', { class: 'setsbox' },
      ...Array.from({ length: st.setsTo }, (_, s) => el('span', { class: 'legbox setbox' + (s < st.setsWon[i] ? ' won set' : ' set') }))) ] : [];
    const lastVisits = st.visits.filter(v => v.p === i);
    const lv = lastVisits[lastVisits.length - 1];
    const scored = Math.max(0, st.start - rest);
    cards.append(el('div', { class: 'scorecard' + (turn ? ' turn' : ' dim'), style: `--pc:${color}` },
      el('div', { class: 'sc-head' }, el('span', { class: 'sc-name' }, p.name), el('span', { class: 'legboxes' }, ...setChipsUi, ...legBoxes)),
      el('div', { class: 'sc-rest num' + (restTickMemo[i] !== rest ? ' tick' : '') }, String(rest)),
      el('div', { class: 'sc-progress' }, el('div', { class: 'sc-progress-fill', style: `width:${Math.min(100, scored / st.start * 100)}%` })),
      el('div', { class: 'sc-meta' },
        el('span', { class: 'sc-turn' }, turn ? 'AM ZUG' : ''),
        st.setsTo ? el('span', { class: 'sets-score' }, `Sets ${st.setsWon[i]}`) : '',
        el('span', {}, avg != null ? 'Ø ' + String(avg).replace('.', ',') : ''),
        el('span', {}, lv != null ? `Last ${lv.points}` : `${darts} Darts`)
      )
    ));
    restTickMemo[i] = rest;
  });

  // Checkout dauerhaft sichtbar
  const co = view.querySelector('#coline');
  co.innerHTML = '';
  const rest = st.leg.remaining[st.current];
  if (!st.finished && st.doubleOut && rest <= 170 && rest >= 2) {
    const forMatch = matchPoint(st, st.current);
    const line = checkoutLine(rest, 3 - st.leg.visit.length, forMatch, suggestCheckout);
    if (line) {
      co.append(el('span', { class: 'co-label' }, 'CHECKOUT'), el('span', { class: 'co-route num' }, line));
      preloadForRest(rest);
    }
  }

  // Last visit
  const vb = view.querySelector('#visitbar');
  vb.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const code = st.leg.visit[i];
    vb.append(el('div', { class: 'dartpill' + (code ? '' : ' empty') }, code || '·'));
  }
}

/* ---- Wurf: sofort, Caller + Haptik + Gross-Momente ---- */
// Match-Point (fuer "for the match"-Ansage): ohne Sets = Leg-Point zum Match;
// mit Sets = nur wenn DIESER Leg-Gewinn auch das MATCH entscheidet.
function matchPoint(st, p) {
  if (st.setsTo) return st.setsWon[p] === Math.ceil(st.setsTo / 2) - 1 && st.legsWon[p] === st.firstTo - 1;
  return st.legsWon[p] === st.firstTo - 1;
}

function doThrow(session, t, { rerenderView } = {}) {
  const st = session.state;
  pushSnapshot(session.snapshots, st);
  // MURMEL-FIX: laufende Ansage zu Ende spielen, nur WARTENDE verwerfen (früher:
  // clearQueue pausierte mitten im Satz -> abgeschnittene Fragmente = "Gebrabbel").
  if (session._turnHoldTimer) { clearTimeout(session._turnHoldTimer); session._turnHoldTimer = null; }
  flushPending();
  buzz(HAPTIC.tap);

  const p = st.current;
  const restBefore = st.leg.remaining[p];
  const legVisitStartBefore = st.leg.visitStart;
  const dartsInVisit = st.leg.visit.length;
  const forMatch = matchPoint(st, p);
  const ev = applyDart(st, t);
  store.save();


  const restAfter = st.leg.remaining[p];
  const visitDartsNow = st.leg.visit.length;
  const visitPoints = ev.type === 'bust' ? 0 : (legVisitStartBefore != null ? legVisitStartBefore - restAfter : restBefore - restAfter);
  const segLabel = t.k === 'bull' ? 'bull' : t.k === 'outer' ? '25' : (t.k[0] + t.n);
  session.visitLabels = session.visitLabels || [];
  session.visitLabels.push(segLabel);

  // 3. PILL SOFORT (Kays Hard-Stopp): applyDart leert st.leg.visit beim Turn — ohne
  // dieses Live-Paint wuerde die 3. Wurfzahl NIE erscheinen (DOM stammt vom Rerender
  // des Vor-Darts). Zeichne die 3 Pills aus den visitLabels, BEVOR der Hold laeuft.
  if (rerenderView && (ev.type !== 'ok') && (ev.type !== 'noin')) {
    try {
      const vb = document.querySelector('#visitbar');
      if (vb) {
        const labels = (session.visitLabels || []).slice(0, 3);
        vb.innerHTML = '';
        for (let i = 0; i < 3; i++) vb.append(el('div', { class: 'dartpill' + (labels[i] ? '' : ' empty') }, labels[i] || '·'));
      }
    } catch (e) { /* egal */ }
  }

  if (ev.type === 'bust') {
    buzz(HAPTIC.bust);
    flashBig('BUST', 'bust');
  } else if (visitPoints === 180 && visitDartsNow === 3) {
    buzz(HAPTIC.oneEighty);
    flashBig('180', 'one80', 'ONE HUNDRED AND EIGHTY!');
  } else if (visitPoints >= 100 && visitDartsNow === 3) {
    flashBig(String(visitPoints), 'hundreds');
  }
  // KAY: KEINE Einzel-Dart-Ansage mehr — der Caller spricht erst nach dem 3. Dart
  // die Summe (siehe callVisitEnd / visitSequence).

  if (ev.type === 'ok') {
    const restNow = st.leg.remaining[st.current];
    const isSimpleDouble = restNow === 50 || (restNow >= 2 && restNow <= 40 && restNow % 2 === 0);
    if (isSimpleDouble && st.leg.visit.length < 3 && dartsInVisit >= 1) callDoubleRequired(restNow === 50 ? 50 : restNow / 2, forMatch);
    preloadForRest(st.leg.remaining[st.current]);
  }
  if (ev.type === 'turn' || ev.type === 'noin' || ev.type === 'bust' || ev.type === 'leg' || ev.type === 'match') {
    const visit180 = visitPoints === 180 && !ev.type.includes('bust');
    const visitHigh = (visitPoints >= 100 && visitPoints < 180) ? visitPoints : null;
    // KAY: volle Visit-Labels (Gay-Check 1+5+20) + Summe — Einzel-Segmente werden
    // nicht mehr angesagt, nur die Summe nach dem 3. Dart.
    callVisitEnd(st.leg.remaining[p] === 0 && ev.type !== 'match' ? 0 : st.leg.remaining[st.current] ?? restAfter, {
      forMatch, bust: ev.type === 'bust', visit180, visitHigh, labels: session.visitLabels, points: visitPoints
    });
    session.visitLabels = [];
  }
  if (ev.type === 'set') {
    // KAY-NEU: Set-Gewinn — Animation + "Set!"-Ansage mit Setstand
    buzz(HAPTIC.gameShot);
    flashBig('SET!', 'gameshot', `${st.players[p].name} ${st.setsWon[0]}-${st.setsWon[1] ?? 0} in Sets`);
    callSetWon(st.setsWon[p], 1 - st.setsWon[p]);
  }
  if (ev.type === 'leg' || ev.type === 'match') {
    if (legVisitStartBefore === 170) callBigFish();
    const oppLegs = st.players.length > 1 ? Math.max(...st.legsWon.filter((_, i) => i !== p)) : 0;
    buzz(HAPTIC.gameShot);
    callGameShot(st.legsWon[p], oppLegs, ev.type === 'match');
    flashBig('GAME SHOT', 'gameshot', ev.type === 'match' ? st.players[p].name + ' gewinnt das Spiel' + (st.setsTo ? ` ${st.setsWon[0]}-${st.setsWon[1] ?? 0} in Sets` : '') : st.players[p].name + ' holt das Leg in ' + (ev.darts || '?') + ' Darts');
  }
  if (ev.type === 'match') {
    // KAY-NEU: Rekorde pruefen (Avg/Checkout/180er gegen bisherigen Bestand)
    const winnerName = st.players[p].name;
    let broken = [];
    try {
      const record = buildX01GameRecord(st, { id: session.id || st.id, date: new Date().toISOString() });
      const fresh = (record.results || []).find(r => r.player === winnerName);
      const gamesWithout = store.state.games.filter(g => g.id !== (session.id || st.id));
      broken = newRecordsBroken(gamesWithout, winnerName, fresh);
    } catch (e) { /* Rekord-Check darf das Spiel nie brechen */ }
    if (broken.length) {
      buzz(HAPTIC.oneEighty);
      flashBig('NEUER REKORD!', 'record', broken.map(b => b.label).join('  ·  '));
      goldBurst();
      callWhatPerformance();
    } else {
      goldBurst();
    }
    // Match-Moment SICHTBAR lassen (Flash + Rest), dann nahtlos in die Auswertung
    clearTimeout(session._turnHoldTimer);
    session._turnHoldTimer = setTimeout(() => { session._turnHoldTimer = null; finishSession(session, false, ev); }, broken.length ? 2200 : 1800);
    return ev;
  }

  if (rerenderView) {
    if (ev.type === 'set' || ev.type === 'leg') {
      // SET!/GAME-SHOT-Flash + 3. Dart stehen lassen: min 1,6 s oder bis Ansage grob fertig
      const hold = Math.max(1600, callerBusyMs());
      clearTimeout(session._turnHoldTimer);
      session._turnHoldTimer = setTimeout(() => { session._turnHoldTimer = null; rerenderView(); }, hold);
    } else if (ev.type === 'turn' || ev.type === 'noin' || ev.type === 'bust') {
      // DRITTE ZAHL SICHTBAR (Kays Test): Pills + Visit-Score stehen lassen —
      // mindestens 1,2 s ODER bis der Caller-Satz fertig ist (was länger ist).
      const hold = turnHoldMs(callerBusyMs());
      clearTimeout(session._turnHoldTimer);
      session._turnHoldTimer = setTimeout(() => { session._turnHoldTimer = null; rerenderView(); }, hold);
    } else {
      clearTimeout(session._turnHoldTimer);
      rerenderView();
    }
  }
  return ev;
}

// Vollbild-Moment (180 / Game Shot / Bust / 100+)
function flashBig(text, kind, sub = null) {
  const host = document.getElementById('bigevent');
  if (!host) return;
  host.innerHTML = '';
  const box = el('div', { class: 'bigevent ' + kind },
    el('div', { class: 'bigevent-text display' }, text),
    sub ? el('div', { class: 'bigevent-sub' }, sub) : ''
  );
  host.append(box);
  setTimeout(() => { if (host.firstChild === box) host.innerHTML = ''; }, kind === 'gameshot' ? 1500 : 1100);
}

// Edler Gold-Burst (wenige grosse Splitter, kurz) bei Spiel-/Set-Gewinn
function goldBurst() {
  const host = document.getElementById('bigevent');
  if (!host) return;
  const layer = el('div', { class: 'goldburst' });
  for (let i = 0; i < 14; i++) {
    const a = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = 90 + Math.random() * 160;
    layer.append(el('i', { style: `--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist - 40}px;--rot:${Math.round(Math.random() * 260 - 130)}deg;--d:${Math.round(Math.random() * 120)}ms` }));
  }
  host.append(layer);
  setTimeout(() => { if (layer.parentNode === host) layer.remove(); }, 1400);
}

function undo(session) {
  const prev = popSnapshot(session.snapshots);
  if (!prev) return toast('Nichts zum Rückgängigmachen');
  session.state = prev;
  store.save();
  clearQueue();
  buzz(HAPTIC.tap);
  rerender();
}

function endEarly() {
  const session = store.state.session;
  if (session && confirm('Spiel beenden und werten?')) finishSession(session, true);
}

/* ---- Abschluss ---- */
export function finishSession(session, aborted, ev = null) {
  window.__DARTPRO_SESSION_ACTIVE = false;
  const st = session.state;
  const date = session.date || new Date().toISOString();
  let record = null;
  if (session.type === 'x01') {
    record = buildX01GameRecord(st, { id: st.id || uid(), date });
    record.durationSec = Math.round((Date.now() - new Date(date).getTime()) / 1000);
    addGame(store.state, record);
  } else {
    record = {
      id: uid(), kind: session.type === 'cricket' ? 'cricket' : 'cutthroat', mode: st.mode,
      label: st.mode === 'cutthroat' ? 'Cut-Throat' : 'Cricket',
      date,
      players: st.players.map(p => p.name),
      results: st.players.map((p, i) => ({ player: p.name, won: st.winner === i, marks: st.marks[i], points: st.points[i] })),
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

function showResultDialog(record, aborted) {
  const view = document.getElementById('view');
  view.innerHTML = '';
  view.className = 'view';
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
          el('div', { class: 'small muted' }, `100+ ${r.counts.c100} · 140+ ${r.counts.c140} · 180 ${r.counts.c180} · Checkout ${r.checkouts.attempts ? Math.round(r.checkouts.hits / r.checkouts.attempts * 100) + '%' : '-'}`)
        ))
      ) : ''
    ),
    el('div', { class: 'row' },
      el('button', { class: 'btn primary wide', onclick: () => { location.hash = '#/stats'; rerender(); } }, icon('i-chart'), 'Statistik ansehen'),
      el('button', { class: 'btn', onclick: () => { location.hash = '#/play'; rerender(); } }, 'Neues Spiel')
    )
  );
}

/* ---------------- Cricket (Pad 20..15 + Bull) ---------------- */
function renderCricketGame(view) {
  const session = store.state.session;
  const st = session.state;
  view.innerHTML = '';
  view.className = 'view view-game';
  view.append(el('p', { class: 'kicker' }, st.mode === 'cutthroat' ? 'Cricket · Cut-Throat' : 'Cricket · Standard'));
  view.append(cricketMarksTable(st));

  const pad = el('div', { class: 'pad' });
  session.padMode = session.padMode || 'single';
  const modeRow = el('div', { class: 'padmodes' });
  [['single', 'SINGLE'], ['double', 'DOUBLE'], ['triple', 'TRIPLE']].forEach(([m, label]) => {
    modeRow.append(el('button', {
      class: 'padmode' + (session.padMode === m ? ' on' : ''),
      onclick: (e) => {
        session.padMode = m;
        modeRow.querySelectorAll('.padmode').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
      }
    }, label));
  });
  const grid = el('div', { class: 'padgrid' });
  for (let n = 20; n >= 15; n--) {
    grid.append(el('button', {
      class: 'padkey num', onclick: () => fireCricket(session, makeThrow(session.padMode, n), view)
    }, String(n)));
  }
  const special = el('div', { class: 'padspecial' },
    el('button', { class: 'padkey bull num', onclick: () => fireCricket(session, makeThrow('bull', 50), view) }, 'BULL'),
    el('button', { class: 'padkey miss', onclick: () => fireCricket(session, makeThrow('miss', 0), view) }, 'MISS'),
    el('button', { class: 'padkey undo', onclick: () => { const prev = popSnapshot(session.snapshots); if (!prev) return toast('Nichts zum Rückgängigmachen'); session.state = prev; store.save(); rerender(); } }, icon('i-undo')),
    el('button', { class: 'padkey miss', onclick: () => { store.state.session = null; window.__DARTPRO_SESSION_ACTIVE = false; store.save(); rerender(); } }, icon('i-x'))
  );
  pad.append(modeRow, grid, special);
  view.append(pad);
}

function fireCricket(session, t, view) {
  buzz(HAPTIC.tap);
  pushSnapshot(session.snapshots, session.state);
  flushPending(); // einmal gestartete Clips nie mitten drin stoppen
  const st = session.state;
  const ev = applyCricketDart(st, t);
  callDart({ k: t.k, n: t.n, v: t.v });
  if (ev.type === 'match') {
    buzz(HAPTIC.gameShot);
    callGameShot(0);
    flashBig('GAME SHOT', 'gameshot');
    finishSession(session, false, ev);
    return;
  }
  session.visitCount = (session.visitCount || 0) + 1;
  if (session.visitCount >= 3) { cricketNextTurn(st); session.visitCount = 0; }
  store.save();
  renderCricketGame(document.getElementById('view'));
}
