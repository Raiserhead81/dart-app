// Statistik: KPIs, Wochen-Trend, Heatmap, Stärken/Schwächen, Tipps.

import { computePlayerStats, knownPlayers } from '/js/core/stats.js';
import { weeklyTrend, weekSummaryText, fmt } from '/js/core/weeks.js';
import { analysePlayer, headlineFinding } from '/js/core/analysis.js';
import { tipsFor } from '/js/core/tips.js';
import { buildHeatmap } from '/js/board.js';
import { lineChart } from '/js/charts.js';
import { el, icon, pct } from '/js/util.js';
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
        el('p', { class: 'muted' }, 'Spiel ein X01 oder ein Training – ab 60 Darts erscheinen die ersten belastbaren Auswertungen.'),
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

  // ----- KPIs -----
  const delta = trend[11]?.delta;
  const kpis = [
    ['3-Dart-Avg', fmt(stats.avg3), delta?.avg, fmt],
    ['First 9', fmt(stats.first9), delta?.first9, fmt],
    ['Doppel-Quote', pct(stats.doubles.pct), delta?.doubles],
    ['Checkout-Quote', pct(stats.checkout.pct), delta?.checkout],
    ['Darts / Leg', fmt(stats.dartsPerLeg)],
    ['Legs', `${stats.legsWon}/${stats.legsPlayed}`],
    ['100+', String(stats.counts.c100)],
    ['140+', String(stats.counts.c140)],
    ['180', String(stats.counts.c180)],
    ['T20-Quote', stats.t20.pct != null ? fmt(stats.t20.pct) + '%' : '-']
  ].map(([label, value, d]) => el('div', { class: 'kpi' },
    el('div', { class: 'label' }, label),
    el('div', {}, el('span', { class: 'value num' }, value),
      d != null ? el('span', { class: 'delta ' + (d >= 0 ? 'up' : 'down') }, (d >= 0 ? '↑ ' : '↓ ') + fmt(Math.abs(d))) : '')
  ));
  view.append(el('div', { class: 'grid kpi' }, ...kpis));

  // ----- Wochenansicht -----
  const chart = lineChart([
    { values: trend.map(t => t.stats.avg3), labels: trend.map(t => t.label), color: SERIES[0].color },
    { values: trend.map(t => t.stats.doubles.pct), labels: trend.map(t => t.label), color: SERIES[2].color },
    { values: trend.map(t => t.stats.checkout.pct), labels: trend.map(t => t.label), color: SERIES[3].color }
  ], { yMin: 0, yMax: 100 });
  view.append(el('div', { class: 'panel' },
    el('h2', {}, 'Verlauf · 12 Wochen', el('span', { class: 'sub' }, 'ISO-Wochen, Montag-Start')),
    chart,
    el('div', { class: 'legend' },
      el('span', {}, el('i', { class: 'sw', style: 'background:#46c47a' }), '3-Dart-Avg'),
      el('span', {}, el('i', { class: 'sw', style: 'background:#cf4436' }), 'Doppel %'),
      el('span', {}, el('i', { class: 'sw', style: 'background:#d9a441' }), 'Checkout %')
    ),
    el('div', { class: 'weekgrid mt' },
      ...trend.slice().reverse().filter(t => t.stats.darts > 0).map(t => el('div', { class: 'weekrow' },
        el('div', { class: 'wk' }, t.label),
        el('div', { class: 'txt' }, weekSummaryText(t)),
        el('div', { class: 'num2 muted' }, `${t.stats.darts}`)
      ))
    )
  ));

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

  // ----- Heatmap -----
  const boardCounts = {};
  for (const g of games) {
    for (const t of g.boardThrows || []) {
      if (t.p !== current) continue;
      boardCounts[t.c] = (boardCounts[t.c] || 0) + 1;
    }
  }
  const heatEntries = Object.values(boardCounts).reduce((a, b) => a + b, 0);
  view.append(el('div', { class: 'panel' },
    el('h2', {}, 'Trefferbild', el('span', { class: 'sub' }, heatEntries ? `${heatEntries} gewertete Darts` : 'nur mit Board-Eingabe')),
    heatEntries >= 5 ? buildHeatmap(boardCounts, { size: 360 }) : el('p', { class: 'muted' }, 'Wirf über das Board ein, dann erscheint hier, welche Felder du triffst und welche verfehlst.'),
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
