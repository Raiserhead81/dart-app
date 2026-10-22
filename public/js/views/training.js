// Training: Wochenplan (aus Schwaechen), echte Benchmarks, 6 Drills mit Regelwerk,
// Technik-Grundlagen (6 Kapitel mit Line-Art), Start der Drills.

import { newTraining, applyTrainingDart, trainingSummary, TRAINING_TYPES } from '/js/core/training.js';
import { checkoutTableFull } from '/js/core/checkout.js';
import { addGame } from '/js/core/storage.js';
import { buildBoard } from '/js/board.js';
import { el, icon, uid } from '/js/util.js';
import { callDart, clearQueue } from '/js/caller-voice.js';
import { store, rerender, navigate } from '/js/app.js';
import { makeThrow } from '/js/core/segments.js';
import { computePlayerStats } from '/js/core/stats.js';
import { analysePlayer } from '/js/core/analysis.js';
import { avgToLevel, checkoutToLevel, doublesToLevel, t20ToLevel, first9Verdict, buildWeeklyPlan, fortniteLine } from '/js/core/benchmarks.js';
import { weeklyTrend } from '/js/core/weeks.js';

const DESCRIPTIONS = {
  atc: { rules: 'Alle Felder von 1 bis 20 und Bull, in Reihenfolge. Jeder Treffer schaltet weiter. Gezählt werden die Darts: unter 60 komplett ist solide, unter 45 stark.', trains: 'Grundgenauigkeit und Wurfroutine', goal: 'unter 60 Darts komplett' },
  doublesAtc: { rules: 'ATC nur auf Doubles: D1 bis D20, dann Bull. Harte Variante: je Feld max. 3 Versuche.', trains: 'Doppel-Trefferquote unter Druck', goal: 'unter 80 Darts komplett' },
  shanghai: { rules: 'Runden 1 bis 7, je 3 Darts auf die Runden-Zahl. Single zählt 1, Doppel 2, Triple 3 Punkte. S+D+T derselben Zahl in einer Runde = Shanghai = sofortiger Gesamtsieg. Maximal 63 Punkte.', trains: 'Zielfelder 1-7 gezielt treffen', goal: 'über 35 Punkte' },
  bob27: { rules: "Start bei 27 Punkten. Je Runde 3 Darts auf D1 bis D20, dann Bull. Jeder Treffer bringt das Doppel (2 x Wert), alle 3 daneben kosten den doppelten Wert. Ende bei 0 oder nach 21 Runden.", trains: 'Doubles unter Punktdruck', goal: 'Score 50+ gut, 100+ Weltklasse' },
  t20: { rules: '25 Darts auf Triple 20. Nur T20 zählt als Hit, andere 20er zaehlen Punkte aber keinen Hit.', trains: 'Scoring-Power auf das wichtigste Feld', goal: '8/25 solide, 12/25 stark, 15/25 Turnier' },
  checkout: { rules: '14 klassische Reste (32 bis 170). Die Route wird angezeigt — wirf sie Darts für Darts nach. Falsches Segment zählt als Fehler.', trains: 'Checkout-Routen aus dem Kopf, sauber ausspielen', goal: '10/14 Reste, max. 20 Fehler' }
};

const TECHNIK = [
  {
    t: 'Stand', svg: 'stand',
    text: 'An die Oche, rechtes Bein vorn (Rechtshänder), Körper leicht seitlich gedreht, Gewicht auf dem vorderen Fuß. Fuß stabil, hinter der Linie bleiben.',
    check: 'Selbst-Test: Wackelst du nach dem Wurf? Dann Gewicht nach vorn verlagern.',
    wrong: 'Fehler: Zurücklehnen, Schwanken, Füße parallel.'
  },
  {
    t: 'Griff', svg: 'grip',
    text: '3 bis 4 Finger halten den Dart ruhig, Spitze zeigt leicht nach oben. Griffpunkt so, dass der Dart beim Loslassen gerade fliegt.',
    check: 'Selbst-Test: Rutscht der Dart beim Schwung? Dann Grifffläche wechseln.',
    wrong: 'Fehler: Todesgriff — verkrampte Finger killen den Wurf.'
  },
  {
    t: 'Arm & Wurf', svg: 'arm',
    text: 'Oberarm bleibt still, Ellenbogen ca. 90°. Der Wurf kommt aus Unterarm und Handgelenk, mit sauberem Nachführen: Die Hand zeigt nach dem Loslassen aufs Target.',
    check: 'Selbst-Test: Zeigt deine Hand nach dem Wurf noch Richtung Board?',
    wrong: 'Fehler: Ganzer Arm wirft, Nachführen wird abgerissen.'
  },
  {
    t: 'Blick & Routine', svg: 'aim',
    text: 'Beide Augen offen, Kopf still, Ziel fixieren VOR dem Wurf. Gleiche kleine Routine jeden Dart: Position → Atmen → Ziel → Wurf.',
    check: 'Selbst-Test: Ziehst du den Kopf mit? Dann Routine verlangsamen.',
    wrong: 'Fehler: Kopf mitbewegen, Zielen erst nach Wurfbeginn.'
  },
  {
    t: 'Häufige Fehler', svg: null,
    list: [
      'Schwanken/Lehnen — Gewicht auf Vorderfuß',
      'Todesgriff — Dart ruhig halten, nicht verkrampt',
      'Ganzer Arm wirft — Oberarm still, Unterarm arbeitet',
      'Kein Follow-through — Hand zeigt aufs Target',
      'Kopf zieht mit — Kopf still, beide Augen offen',
      'Jeder Dart neue Routine — gleiche Routine 100x'
    ]
  },
  {
    t: '5-Minuten-Aufwärmroutine', svg: 'warmup',
    text: 'Vor jedem Training/Spiel: 30 Darts locker in die T20-Region, dann 10 Darts auf Doubles (D20, D16, D10), 3 Darts auf Bull. Danach erst zählen.',
    check: 'Merksatz: Erst lockern, dann messen.',
    wrong: 'Fehler: Kalt ins erste Leg.'
  }
];

const SVG = {
  stand: '<circle cx="60" cy="22" r="9"/><path d="M60 31v26m0 0-12 28m12-28 8 28m-20-30h24m-4-2 22-12"/><line x1="14" y1="88" x2="106" y2="88"/><path d="M20 84v8M32 84v8"/>',
  grip: '<rect x="20" y="40" width="60" height="10" rx="5"/><path d="M80 45 106 38"/><circle cx="40" cy="45" r="6"/><circle cx="55" cy="45" r="6"/><circle cx="70" cy="45" r="6"/><path d="M36 33c4-6 14-6 18 0"/>',
  arm: '<circle cx="34" cy="22" r="9"/><path d="M34 31v20l16 10 34-6"/><path d="M50 61 84 55"/><circle cx="88" cy="53" r="4"/><path d="M34 51h16" stroke-dasharray="4 4"/>',
  aim: '<circle cx="45" cy="24" r="10"/><circle cx="41" cy="22" r="1.6" fill="currentColor"/><circle cx="49" cy="22" r="1.6" fill="currentColor"/><path d="M45 34v22m0 0-10 30m10-30 10 30"/><line x1="58" y1="30" x2="100" y2="30" stroke-dasharray="4 5"/><circle cx="100" cy="30" r="5"/>',
  warmup: '<circle cx="86" cy="30" r="14"/><circle cx="86" cy="30" r="6"/><path d="M10 84C30 60 60 44 82 34" stroke-dasharray="5 6"/><path d="M78 30l10 2-4 9"/><line x1="6" y1="90" x2="114" y2="90"/>'
};

function techSvg(name) {
  return `<svg viewBox="0 0 120 100" class="techsvg" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${SVG[name] || ''}</svg>`;
}

export function renderTraining(view, arg) {
  const session = store.state.session;
  if (session && session.type === 'training') return renderTrainingGame(view);
  if (arg && TRAINING_TYPES[arg]) { startTraining(arg); return; }

  const player = store.state.activeProfile || 'Spieler 1';
  const games = store.state.games;
  const stats = computePlayerStats(games, player);
  const analysis = analysePlayer(stats);
  const plan = buildWeeklyPlan(analysis);
  const trend = weeklyTrend(games, player, 3);
  const prev = trend[trend.length - 2]?.stats;
  const cur = trend[trend.length - 1]?.stats;

  view.innerHTML = '';
  view.append(
    el('p', { class: 'kicker' }, 'Training'),
    el('h1', { class: 'display', style: 'margin:0 0 6px' }, 'Drills & Plan'),
    el('p', { class: 'muted', style: 'margin:0 0 14px' }, `für ${player} — jede Session 20 Minuten, jede Marke messbar`)
  );

  // ----- Wochenplan -----
  const planPanel = el('div', { class: 'panel' },
    el('h2', {}, 'Dein Wochenplan', el('span', { class: 'sub' }, '3 × 20 Min., abgeleitet aus deinen Schwächen')),
    el('div', { class: 'plan-grid' },
      ...plan.map(s => el('div', { class: 'plancard', style: `--pc:${['#ff7f2a', '#2dd4bf', '#e8b64c'][s.nr - 1]}` },
        el('div', { class: 'plancard-nr' }, 'SESSION ' + s.nr),
        el('div', { class: 'plancard-title' }, s.title),
        el('ul', { class: 'planlist' }, ...s.plan.map(step => el('li', {}, step))),
        el('div', { class: 'planpass' }, 'Geschafft: ' + s.pass),
        el('div', { class: 'planworld muted' }, 'Weltklasse: ' + s.world)
      ))
    )
  );
  if (prev && cur) {
    planPanel.append(el('div', { class: 'mt small' },
      el('div', {}, fortniteLine(prev.doubles.pct, cur.doubles.pct, 'Doppel-%')),
      el('div', {}, fortniteLine(prev.checkout.pct, cur.checkout.pct, 'Checkout-%'))
    ));
  }
  view.append(planPanel);

  // ----- Benchmarks -----
  const avgLvl = avgToLevel(stats.avg3);
  const coLvl = checkoutToLevel(stats.checkout.pct);
  const dbLvl = doublesToLevel(stats.doubles.pct);
  const t20Lvl = t20ToLevel(stats.t20.pct);
  const f9 = first9Verdict(stats.avg3, stats.first9);
  const benchRow = (label, value, lvl) => el('div', { class: 'benchrow' },
    el('span', { class: 'bench-label' }, label),
    el('span', { class: 'bench-value num' }, value),
    el('span', { class: 'bench-lvl' }, lvl.label + (lvl.next ? ` → Ziel ${lvl.next}` : '')),
    el('span', { class: 'bench-note muted' }, lvl.note || '')
  );
  view.append(el('div', { class: 'panel' },
    el('h2', {}, 'Wo stehst du?', el('span', { class: 'sub' }, 'echte Benchmarks, ehrlich eingeordnet')),
    benchRow('3-Dart-Avg', stats.avg3 ?? '-', avgLvl),
    benchRow('First 9', stats.first9 ?? '-', f9),
    benchRow('Doppel-%', stats.doubles.pct != null ? stats.doubles.pct + '%' : '-', dbLvl),
    benchRow('Checkout-%', stats.checkout.pct != null ? stats.checkout.pct + '%' : '-', coLvl),
    benchRow('T20-Quote', stats.t20.pct != null ? String(stats.t20.pct).replace('.', ',') + '%' : '-', t20Lvl),
    el('div', { class: 'small muted mt' }, `Skala Avg: <40 Anfänger · 40-60 Hobby · 60-80 sehr gut · 80+ Profi. Aktuell: ${avgLvl.label}${avgLvl.next ? ' — nächstes Ziel Avg ' + avgLvl.next : ''}.`)
  ));

  // ----- Drills -----
  view.append(el('h2', { class: 'display', style: 'margin:16px 0 10px' }, 'Die Drills'));
  const cards = Object.entries(TRAINING_TYPES).map(([key, label]) => {
    const d = DESCRIPTIONS[key];
    return el('button', {
      class: 'listitem drill', style: 'text-align:left;cursor:pointer',
      onclick: () => startTraining(key)
    },
      el('div', { class: 'grow' },
        el('div', { class: 'title' }, label),
        el('div', { class: 'sub', style: 'margin:4px 0' }, d.rules),
        el('div', { class: 'small' }, el('strong', {}, 'Trainiert: '), d.trains),
        el('div', { class: 'small', style: 'color:#e8b64c;font-weight:700' }, 'Ziel: ' + d.goal)
      ),
      icon('i-bolt')
    );
  });
  view.append(el('div', { class: 'list' }, ...cards));

  // ----- Technik -----
  view.append(el('h2', { class: 'display', style: 'margin:20px 0 10px' }, 'Technik-Basics'));
  const techGrid = el('div', { class: 'techgrid' });
  for (const chapter of TECHNIK) {
    techGrid.append(el('div', { class: 'panel tight techcard' },
      chapter.svg ? el('div', { class: 'techsvg-wrap', html: techSvg(chapter.svg) }) : icon('i-check'),
      el('div', { class: 'grow' },
        el('div', { class: 'title' }, chapter.t),
        chapter.text ? el('p', { class: 'sub', style: 'margin:6px 0' }, chapter.text) : '',
        chapter.list ? el('ul', { class: 'planlist', style: 'margin:6px 0 6px 18px' }, ...chapter.list.map(x => el('li', {}, x))) : '',
        chapter.check ? el('div', { class: 'small', style: 'color:#46c47a;font-weight:700' }, chapter.check) : '',
        chapter.wrong ? el('div', { class: 'small muted' }, chapter.wrong) : ''
      )
    ));
  }
  view.append(techGrid);
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
  view.className = 'view view-game';
  view.append(el('p', { class: 'kicker' }, 'Training · ' + s.label));
  const sum = trainingSummary(s);

  let focus;
  if (s.type === 'atc' || s.type === 'doublesAtc') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, 'Aktuelles Ziel'),
      el('div', { class: 'value' }, String(s.targets[s.idx] ?? 'Fertig')));
  } else if (s.type === 'shanghai') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, `Runde ${s.round} – Ziel ${s.round}`),
      el('div', { class: 'value num' }, String(s.score)));
  } else if (s.type === 'bob27') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, `Doppel ${s.round <= 20 ? s.round : 'Bull'}`),
      el('div', { class: 'value num' }, String(s.score)), el('div', { class: 'small muted' }, 'Treffer +2×Wert · Miss-Runde −2×Wert · Ziel 50+, Weltklasse 100+'));
  } else if (s.type === 't20') {
    focus = el('div', { class: 'kpi' }, el('div', { class: 'label' }, 'Triple 20'),
      el('div', { class: 'value num' }, `${s.hits}/25`), el('div', { class: 'small muted' }, `${s.score} Punkte · noch ${s.dartsLeft} Darts · 8/25 solide, 12/25 stark`));
  } else if (s.type === 'checkout') {
    const rest = s.rests[s.pos];
    const route = s.route || checkoutTableFull(rest) || [];
    focus = el('div', { class: 'kpi', style: 'width:100%' },
      el('div', { class: 'label' }, `Rest ${rest} · Route`),
      el('div', { class: 'value', style: 'font-size:26px' }, route.join('  ')),
      el('div', { class: 'small muted' }, `${s.done}/${s.rests.length} Reste · ${s.routeHits} Treffer · ${s.misses} Fehler`)
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
      callDart({ k: t.k, n: t.n, v: t.v });
      if (ev.message) toast(ev.message, 1400);
      if (ev.type === 'done') { finishTraining(session); return; }
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
      el('div', { class: 'muted small mt' }, `${s.throws.length} Darts — Ergebnis zählt für deine Wochen-Statistik`)
    ),
    el('div', { class: 'row', style: 'justify-content:center' },
      el('button', { class: 'btn primary', onclick: () => { startTraining(s.type); } }, 'Nochmal'),
      el('button', { class: 'btn', onclick: () => { location.hash = '#/stats'; rerender(); } }, 'Zur Statistik'),
      el('button', { class: 'btn ghost', onclick: () => { location.hash = '#/training'; rerender(); } }, 'Übersicht')
    )
  );
}
