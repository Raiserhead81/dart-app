// Statistik: KPIs, Wochen-Trend, Heatmap, Stärken/Schwächen, Tipps.

import { computePlayerStats, knownPlayers } from '/js/core/stats.js';
import { weeklyTrend, weekSummaryText, fmt } from '/js/core/weeks.js';
import { analysePlayer, headlineFinding } from '/js/core/analysis.js';
import { tipsFor } from '/js/core/tips.js';
import { buildHeatmap } from '/js/board.js';
import { lineChart } from '/js/charts.js';
import { el, icon, pct } from '/js/util.js';
import { bestRecords, } from '/js/core/records.js';
import { countFormat, trendProjection } from '/js/core/statsfx.js';
import { store, navigate } from '/js/app.js';

const SERIES = [
  { key: 'avg3', label: '3-Dart-Avg', color: '#46c47a', y: [0, 90] },
  { key: 'first9', label: 'First 9', color: '#e8dfc8', y: [0, 90] },
  { key: 'doublesPct', label: 'Doppel %', color: '#cf4436', y: [0, 100] },
  { key: 'checkoutPct', label: 'Checkout %', color: '#d9a441', y: [0, 100] }
];

export function renderStats(view, arg) {
  const games = store.state.games.filter(g => !g.online || g.synced !== false);
  const players = knownPlayers(games);
  if (!players.length) {
    view.append(
      el('p', { class: 'kicker' }, 'Statistik'),
      el('div', { class: 'panel empty' },
        el('h2', {}, 'Noch keine Spiele'),
        el('p', { class: 'muted' }, 'Spiel ein X01 oder ein Training – ab dem ersten Spiel zeigt die App deine Werte.'),
        el('button', { class: 'btn primary', onclick: () => { location.hash = '#/play'; } }, 'Jetzt spielen')
      )
    );
    return;
  }
  const current = arg || store.state.statsPlayer || players[0].player;
  store.state.statsPlayer = current;

  const sel = el('select', { onchange: (e) => { store.state.statsPlayer = e.target.value; store.save(); renderStats(view, e.target.value); } },
    ...players.map(p => el('option', { value: p.player, selected: p.player === current ? '' : null }, p.player)));

  const stats = computePlayerStats(games, current);
  const trend = weeklyTrend(games, current, 12);
  const analysis = analysePlayer(stats);
  const tips = tipsFor(analysis);

  view.append(el('div', { class: 'row', style: 'justify-content:space-between' },
    el('p', { class: 'kicker', style: 'margin:0' }, 'Statistik'),
    el('div', { style: 'max-width:220px' }, sel)
  ));
  view.append(el('h1', { class: 'serif', style: 'margin:2px 0 14px;font-size:30px' }, current));

  // ===== HERO (episch): RIESIGE Key-Numbers im LTHC-Bar-Look =====
  const delta = trend[11]?.delta;
  const badge = (d, invert = false) => {
    if (d == null || isNaN(d)) return el('span', { class: 'badge flat' }, '± Vorwoche');
    const good = invert ? d < 0 : d > 0;
    return el('span', { class: 'badge ' + (good ? 'up' : 'down') }, (good ? '▲ ' : '▼ ') + fmt(Math.abs(d)) + (invert ? '' : ''));
  };
  const hero = el('div', { class: 'stathero' },
    el('p', { class: 'kicker' }, 'Statistik'),
    el('div', { class: 'row', style: 'justify-content:space-between;align-items:center;margin:2px 0 0' },
      el('div', { class: 'stathero-name' }, current),
      el('div', { style: 'max-width:200px' }, sel)
    ),
    el('div', { class: 'herorow' },
      el('div', { class: 'hero-kpi red' },
        el('div', { class: 'hero-num' }, fmt(stats.avg3)),
        el('div', { class: 'hero-sub' }, '3-Dart-Avg'), el('div', { style: 'margin-top:6px' }, badge(delta?.avg))
      ),
      // KAY: 180er statt Checkout% als zweite Hero-Zahl — 100% Checkout bei 1
      // Versuch als Riesenzahl war irrefuehrend; Checkout% mit Versuchen in die Minis.
      el('div', { class: 'hero-kpi gold' },
        el('div', { class: 'hero-num' }, String(stats.counts.c180)),
        el('div', { class: 'hero-sub' }, '180er'),
        el('div', { style: 'margin-top:6px;font-size:11px;font-weight:800;color:var(--muted)' }, stats.counts.c180 ? 'MAXIMUM!' : 'noch keiner')
      )
    ),
    el('div', { class: 'herominis' },
      ...[
        ['First 9', fmt(stats.first9)],
        ['Doppel %', pct(stats.doubles.pct)],
        ['Checkout', `${pct(stats.checkout.pct)} (${stats.checkout.hits}/${stats.checkout.attempts})`],
        ['T20 %', stats.t20.pct != null ? fmt(stats.t20.pct) : '-'],
        ['Darts/Leg', fmt(stats.dartsPerLeg)],
        ['Legs', `${stats.legsWon}/${stats.legsPlayed}`],
        ['100+', String(stats.counts.c100)],
        ['140+', String(stats.counts.c140)]
      ].map(([l, v]) => el('div', { class: 'heromini' }, el('div', { class: 'v' }, v), el('div', { class: 'l' }, l)))
    )
  );
  view.append(hero);

  // ===== KAY-NEU: Letztes Match direkt unter dem Hero (nach Spielende nahtlos sichtbar) =====
  const lastGame = games.filter(g => g.kind === 'x01' && (g.results || []).some(r => r.player === current)).slice(-1)[0];
  if (lastGame) {
    const r = lastGame.results.find(x => x.player === current);
    const opp = (lastGame.results || []).find(x => x.player !== current);
    const co = r.checkouts?.attempts ? Math.round(r.checkouts.hits / r.checkouts.attempts * 100) + '%' : '-';
    view.append(el('div', { class: 'darkpanel', id: 'lastmatch' },
      el('h2', {}, 'Letztes Match ', el('span', { class: 'sub' }, lastGame.label || 'X01',
        opp ? el('span', { class: 'sub' }, ` · vs. ${opp.player} ${r.legsWon}-${opp.legsWon}`) : '')),
      el('div', { class: 'herominis', style: 'margin-top:8px' },
        ...[
          ['Avg', fmt(r.avg3)],
          ['Checkout', co],
          ['Darts', String(r.darts)],
          ['Legs', `${r.legsWon}/${r.legsPlayed}`]
        ].map(([l, v]) => el('div', { class: 'heromini' }, el('div', { class: 'v' }, v), el('div', { class: 'l' }, l)))
      )
    ));
  }

  // ===== Bestmarken-Feier: letzte aktive Woche schlägt alle 12 Wochen? =====
  const played = trend.filter(t => t.stats.darts > 0);
  if (played.length >= 2) {
    const last = played[played.length - 1];
    const bestAvg = Math.max(...played.map(t => t.stats.avg3 || 0));
    const bestCo = Math.max(...played.map(t => t.stats.checkout.pct || 0));
    const pbAvg = (last.stats.avg3 || 0) >= bestAvg && bestAvg > 0;
    const pbCo = (last.stats.checkout.pct || 0) >= bestCo && bestCo > 0;
    if (pbAvg || pbCo) {
      try { navigator.vibrate && navigator.vibrate([60, 80, 60, 80, 200]); } catch (e) { /* egal */ }
      view.append(el('div', { class: 'pbcard' },
        el('div', { class: 'kick' }, 'Neue Bestmarke'),
        el('div', { class: 'big' }, pbAvg ? fmt(last.stats.avg3) : pct(last.stats.checkout.pct)),
        el('div', { class: 'sub' }, pbAvg
          ? `Persönlicher 3-Dart-Avg-Rekord in ${last.label} — Starke Woche!`
          : `Beste Checkout-Quote aller Zeiten in ${last.label} — Kalte Kelle!`)
      ));
    }
  }

  // ===== REKORDE (Hero-Gold): beste Avg / Checkout / schnellstes Leg / 180er =====
  const recs = bestRecords(games, current);
  const recItems = [
    ['Beste Avg', recs.avg?.v != null ? fmt(recs.avg.v) : '-', recs.avg?.date],
    ['Beste Checkout', recs.checkout?.v != null ? pct(recs.checkout.v) : '-', recs.checkout?.date],
    ['Schnellstes Leg', recs.fastestLeg ? `${recs.fastestLeg.darts} Darts` : '-', recs.fastestLeg?.date],
    ['Meiste 180er', recs.most180 ? `${recs.most180.n}` : '-', recs.most180?.date]
  ];
  view.append(el('div', { class: 'recordsec' },
    el('div', { class: 'kick' }, 'REKORDE'),
    el('div', { class: 'recgrid' },
      ...recItems.map(([l, v, d]) => el('div', { class: 'reckpi' },
        el('span', { class: 'rebadge' }, 'REKORD'),
        el('div', { class: 'v num' }, v),
        el('div', { class: 'l' }, l),
        el('div', { class: 'd' }, d || '')))
    )
  ));

  // ===== Verlauf 2.0 (KAY 24.10.): Ø-Linie, Werte auf ALLEN Daten-Wochen,
  // Labels jeder 2. KW, Trend-Zeile im Kopf, Wochenliste mit Mini-Balken =====
  const avgs = trend.map(t => t.stats.avg3 || 0);
  const maxA = Math.max(10, ...avgs);
  const bestIdx = avgs.indexOf(Math.max(...avgs));
  const withData = trend.filter(t => t.stats.darts > 0);
  const valid = avgs.filter(v => v > 0);
  const avgAll = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const avgLineTop = avgAll > 0 ? Math.max(4, 100 - Math.round(avgAll / maxA * 100)) : null;
  const bars = el('div', { class: 'weekbars' + (withData.length < 2 ? ' few' : '') + (avgLineTop != null ? ' hasline' : '') },
    avgLineTop != null ? el('div', { class: 'avgline', style: `top:${avgLineTop}%` }, el('span', { class: 'avglbl' }, 'Ø ' + String(Math.round(avgAll)).replace('.', ','))) : '',
    ...trend.map((t, i) => {
      const v = t.stats.darts > 0 ? (t.stats.avg3 || 0) : 0;
      const h = v > 0 ? Math.max(12, Math.round(v / maxA * 100)) : 2;
      const zeigeWert = v > 0 && (withData.length <= 6 || i === bestIdx || i === trend.length - 1 || v >= avgAll);
      return el('div', { class: 'weekbar' + (i === trend.length - 1 && v > 0 ? ' now' : '') + (i === bestIdx && v > 0 ? ' best' : ''), style: `height:${h}%`, title: `${t.label}: Ø ${String(Math.round(v)).replace('.', ',')} · ${t.stats.darts} Darts` },
        el('span', { class: 'wv' }, zeigeWert ? String(Math.round(v)) : ''),
        el('span', { class: 'wl' }, i % 2 === 0 || i === trend.length - 1 ? t.label.replace(/[^0-9]/g, '').slice(-2) : ''));
    }));
  view.append(el('div', { class: 'darkpanel' },
    el('h2', {}, 'Verlauf', el('span', { class: 'sub' }, withData.length < 2 ? 'ab Woche 2 waechst dein Verlauf' : '3-Dart-Ø je Kalenderwoche')),
    bars,
    el('div', { class: 'legend' },
      el('span', {}, el('i', { class: 'sw', style: 'background:linear-gradient(180deg,#ffd479,#d9a441)' }), 'Beste Woche'),
      el('span', {}, el('i', { class: 'sw', style: 'background:rgba(255,107,87,.9)' }), 'Aktuell')),
    el('div', { class: 'weekgrid mt' },
      ...trend.slice().reverse().filter(t => t.stats.darts > 0).slice(0, 4).map(t => el('div', { class: 'weekrow' },
        el('div', { class: 'wk' }, t.label),
        el('div', { class: 'txt' }, weekSummaryText(t)),
        badge(t.delta?.avg),
        el('div', { class: 'num2 muted' }, `${t.stats.darts}`)
      ))
    ),
    (() => {
      const proj = trendProjection(trend.map(t => t.stats.avg3), 4);
      if (!proj) return '';
      const arrow = proj.direction === 'up' ? '↗ steigend' : proj.direction === 'down' ? '↘ fallend' : '→ stabil';
      const kw = 'KW' + (() => { const d = new Date(); d.setDate(d.getDate() + 7 * proj.horizon); return Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 864e5) + new Date(d.getFullYear(), 0, 1).getDay() + 1) / 7); })();
      return el('div', { class: 'progchip ' + proj.direction },
        el('span', { class: 'pa' }, arrow), el('span', {},
          `Wenn du so weitermachst: Ø ${String(proj.projected).replace('.', ',')} bis ${kw}`));
    })()
  ));
  animateStatsFx(view);

  // ----- Stärken / Schwächen -----
  view.append(el('div', { class: 'panel' },
    el('h2', {}, 'Analyse', el('span', { class: 'sub' }, headlineFinding(analysis))),
    analysis.dataQuality.enough ? '' : el('p', { class: 'muted small' }, 'Noch wenig Daten – Regeln greifen ab ca. 60 Darts.'),
    el('div', { class: 'list' },
      ...analysis.weaknesses.slice(0, 3).map(w => el('div', { class: 'listitem weak' },
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, w.title),
          el('div', { class: 'sub' }, w.detail)),
        icon('i-x'))),
      ...analysis.strengths.slice(0, 3).map(w => el('div', { class: 'listitem strong' },
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, w.title),
          el('div', { class: 'sub' }, w.detail)),
        icon('i-check')))
    )
  ));

  // ----- Trainings-Tipps -----
  if (tips.length) {
    view.append(el('h2', { class: 'serif', style: 'margin:8px 0 10px;font-size:22px;color:#e8dfc8' }, 'Deine Trainings-Tipps diese Woche'));
    for (const tip of tips) {
      view.append(el('div', { class: 'tipcard' },
        el('div', { class: 'small', style: 'color:#d9a441;font-weight:800;text-transform:uppercase;letter-spacing:.1em' }, `Schwäche ${tip.rank}: ${tip.weakness}`),
        el('div', { class: 't' }, tip.title),
        el('p', { style: 'margin:0 0 12px' }, tip.text),
        el('button', {
          class: 'btn primary small',
          onclick: () => { location.hash = '#/training/' + tip.training; }
        }, icon('i-bolt'), `Jetzt trainieren: ${tip.trainingLabel}`)
      ));
    }
  }

  // ----- Trefferbild: GROSS + zentral (episch, dunkle Tiefe) -----
  const boardCounts = {};
  for (const g of games) {
    for (const t of g.boardThrows || []) {
      if (t.p !== current) continue;
      boardCounts[t.c] = (boardCounts[t.c] || 0) + 1;
    }
  }
  const heatEntries = Object.values(boardCounts).reduce((a, b) => a + b, 0);
  view.append(el('div', { class: 'darkpanel heat-dark' },
    el('h2', {}, 'Trefferbild ', el('span', { class: 'sub' }, heatEntries ? `${heatEntries} gewertete Darts` : 'nur mit Board-Eingabe')),
    heatEntries >= 5 ? buildHeatmap(boardCounts, { size: 440 }) : el('p', { class: 'muted' }, 'Wirf über das Board ein, dann erscheint hier, welche Felder du triffst und welche verfehlst.'),
    heatEntries >= 5 ? el('div', { class: 'heat-legend mt' },
      el('span', {}, 'selten'),
      ...['rgba(60,72,64,.4)', 'rgba(94,150,110,.6)', 'rgba(160,190,110,.8)', 'rgba(226,150,70,.95)'].map(c => el('i', { class: 'heat-swatch', style: 'background:' + c })),
      el('span', {}, 'oft')
    ) : ''
  ));

  // ----- Letzte Spiele -----
  const mine = games.filter(g => (g.results || []).some(r => r.player === current)).slice(-8).reverse();
  view.append(el('div', { class: 'panel' },
    el('h2', {}, 'Letzte Spiele'),
    mine.length ? el('div', { class: 'list' }, ...mine.map(g => el('div', { class: 'listitem' },
      el('div', { class: 'grow' },
        el('div', { class: 'title' }, g.label || g.kind),
        el('div', { class: 'sub' }, new Date(g.date).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })
          + (g.online ? ' · Online' : ''))),
      g.kind === 'x01' ? el('div', { class: 'num2 num', style: 'font-weight:800' }, fmt(g.results?.find(r => r.player === current)?.avg3))
        : el('div', { class: 'small muted' }, g.summary?.headline || '')
    ))) : el('p', { class: 'muted' }, 'Noch keine Spiele für dieses Profil.')
  ));
}


// ===== Episch-Layer: Count-Up der Key-Numbers + Chart Draw-In =====
function animateCountUps(root) {
  const nodes = [...root.querySelectorAll('.hero-num, .heromini .v, #lastmatch .v')];
  for (const n of nodes) {
    const raw = n.textContent.trim();
    if (!/^\d+([.,]\d+)?$/.test(raw)) continue;
    const target = parseFloat(raw.replace(',', '.'));
    const dec = raw.includes(',') ? 1 : 0;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 800);
      n.textContent = countFormat(target, p, dec);
      if (p < 1) requestAnimationFrame(tick);
      else n.closest('.hero-kpi')?.classList.add('arrived');
    };
    requestAnimationFrame(tick);
  }
}

export function animateStatsFx(view) {
  // Count-Up der grossen Zahlen
  animateCountUps(view);
  // Chart-Linien zeichnen sich sanft (stroke-dashoffset)
  requestAnimationFrame(() => {
    for (const path of view.querySelectorAll('.darkpanel svg path[d]')) {
      try {
        const len = path.getTotalLength();
        if (!len || len > 5000) continue;
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        path.style.transition = 'stroke-dashoffset 1.1s ease-out';
        requestAnimationFrame(() => { path.style.strokeDashoffset = '0'; });
      } catch (e) { /* egal */ }
    }
  });
}
