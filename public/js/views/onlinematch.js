// Online-Match-Ansicht: synchronisiertes Scoreboard via Polling (1.5s).
// Beide geben am eigenen Device ein; nur wer am Zug ist, kann werfen.

import { api, getAuth } from '/js/api.js';
import { buildBoard } from '/js/board.js';
import { el, icon, toast } from '/js/util.js';
import { parseThrowInput, makeThrow } from '/js/core/segments.js';
import { suggestCheckout } from '/js/core/checkout.js';
import { callDart, callVisitEnd, callGameShot, callBust, clearQueue, preloadForRest } from '/js/caller-voice.js';
import { store, rerender } from '/js/app.js';

const POLL_MS = 1500;

export function renderOnlineMatch(view, matchId) {
  const root = el('div', { class: 'panel' }, el('p', { class: 'muted' }, 'Match wird geladen…'));
  view.innerHTML = '';
  view.append(root);

  let lastState = null;
  let myLastVisitLength = 0;
  let pollTimer = null;
  let dead = false;

  async function refresh(silent = true) {
    try {
      const m = await api.getMatch(matchId);
      render(m);
    } catch (e) {
      if (!silent) toast('Match nicht erreichbar: ' + e.message);
    }
  }

  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(() => { if (!dead) refresh(); }, POLL_MS);
  }

  async function throwDart(t, boardSeg) {
    clearQueue();
    const restBefore = lastState?.state?.leg?.remaining?.[lastState.state.current];
    const forMatch = lastState && lastState.legsWonMe === lastState.firstTo - 1;
    try {
      const res = await api.throwDart(matchId, { dart: t });
      if (res.error) return toast(res.error);
      if (boardSeg) callDart({ k: t.k, n: t.n, v: t.v });
      if (res.event?.type === 'bust') callBust();
      if (res.event?.type === 'turn' || res.event?.type === 'bust') callVisitEnd(restBefore, { forMatch });
      if (res.event?.type === 'leg') callGameShot(res.legsWonMe, res.legsWonOpp, false);
      if (res.event?.type === 'match') callGameShot(res.legsWonMe, res.legsWonOpp, true);
      render(res);
    } catch (e) {
      toast(e.message || 'Fehler');
    }
  }

  function render(m) {
    lastState = m;
    const gameState = m.state;
    if (!gameState) return;
    root.innerHTML = '';
    view.querySelector('#onl-banner')?.remove();

    root.append(el('p', { class: 'kicker' }, `Online · ${gameState.start} · gegen ${m.opponentName || '?'} · First to ${gameState.firstTo}`));
    const status = el('div', { id: 'onl-banner' });
    if (m.status === 'finished') {
      status.className = 'banner win';
      status.textContent = m.winnerId === getAuth()?.userId ? 'Du hast gewonnen!' : 'Match beendet';
    } else {
      status.className = 'banner ' + (m.myTurn ? 'win' : 'info');
      status.textContent = m.myTurn ? 'Du bist am Zug' : 'Gegner ist am Zug – live synchronisiert';
    }
    view.prepend(status);

    const cards = el('div', { class: 'scorehead' });
    (gameState.players || []).forEach((p, i) => {
      cards.append(el('div', { class: 'pcard' + (gameState.current === i && m.status === 'active' ? ' turn' : '') },
        el('div', { class: 'name' }, p.name + ` · ${gameState.legsWon[i]}`),
        el('div', { class: 'rest num' }, String(gameState.leg.remaining[i])),
        el('div', { class: 'meta' }, gameState.current === i ? 'am Zug' : '')
      ));
    });
    root.append(cards);

    if (m.status !== 'active') {
      root.append(el('div', { class: 'row mt', style: 'justify-content:center' },
        el('a', { class: 'btn primary', href: '#/stats' }, 'Zur Statistik')));
      dead = true;
      clearInterval(pollTimer);
      return;
    }

    if (m.myTurn) {
      const rest = gameState.leg.remaining[gameState.current];
      const dartsInVisit = gameState.leg.visit.length;
      const co = suggestCheckout(rest, 3 - dartsInVisit);
      if (co) root.append(el('div', { class: 'checkout center mt' }, `${co.join(' ')}`));
      preloadForRest(rest);
      const boardwrap = el('div', { class: 'boardwrap mt' });
      boardwrap.append(buildBoard({
        onThrow: (seg) => throwDart(makeThrow(seg.kind, seg.number), seg)
      }));
      const input = el('input', { type: 'text', inputmode: 'text', placeholder: 'Zahl oder Segment (60 / T20 / D16)', style: 'max-width:420px' });
      const submit = el('button', {
        class: 'btn primary small', onclick: () => {
          const t = parseThrowInput(input.value);
          if (!t) return toast('Ungueltige Eingabe');
          input.value = '';
          throwDart(t, t.k !== 'sum');
        }
      }, 'Wurf melden');
      boardwrap.append(el('div', { class: 'row', style: 'justify-content:center' }, input, submit));
      root.append(boardwrap);
    } else {
      root.append(el('div', { class: 'empty' }, 'Warte auf Gegner… (Polling alle 1,5 s)'));
    }
  }

  function guessMyIndex(gameState) {
    // Der Spieler, dessen Rest sich zuletzt geaendert hat, war dran – fuer die Anzeige
    // reicht die Zuordnung ueber Namen: ich bin Index 0, wenn mein Name an Position 0 steht.
    const myName = store.state.activeProfile;
    const i = (gameState.players || []).findIndex(p => p.name === myName);
    return i >= 0 ? i : 0;
  }

  refresh(false);
  startPolling();
  window.addEventListener('hashchange', () => { dead = true; clearInterval(pollTimer); }, { once: true });
}
