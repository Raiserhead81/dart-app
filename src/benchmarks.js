// Echte Darts-Benchmarks und Wochenplan: jede Zahl messbar, jede Einordnung ehrlich.

// 3-Dart-Avg-Level (uebliche Club-/Liga-Einordnung)
const AVG_LEVELS = [
  { min: 80, label: 'Profi-Niveau', note: 'PDC-Tour-Bereich', next: null },
  { min: 60, label: 'Sehr gut', note: 'Verbandsliga-Niveau', next: 80 },
  { min: 40, label: 'Hobby', note: 'solides Club-Niveau', next: 60 },
  { min: 0, label: 'Anfaenger', note: 'Basis steht', next: 40 }
];

export function avgToLevel(avg) {
  if (avg == null) return { label: '—', note: 'noch keine Daten', next: 40 };
  for (const l of AVG_LEVELS) {
    if (avg >= l.min) return { label: l.label, note: l.note, next: l.next, value: avg };
  }
  return { label: 'Anfaenger', note: 'Basis steht', next: 40, value: avg };
}

// Checkout-%-Ziele pro Level
export function checkoutToLevel(pct) {
  if (pct == null) return { label: '—', next: 30 };
  if (pct >= 50) return { label: 'Sehr gut', note: '50%+ heisst: Legs laufen dir zu', next: 60, value: pct };
  if (pct >= 35) return { label: 'Gut', note: 'Liga-Niveau', next: 50, value: pct };
  if (pct >= 25) return { label: 'OK', note: 'Ausbaufaehig', next: 35, value: pct };
  return { label: 'Schwach', note: 'hier liegen die meisten verlorenen Legs', next: 25, value: pct };
}

// Doppel-%-Ziele
export function doublesToLevel(pct) {
  if (pct == null) return { label: '—', next: 30 };
  if (pct >= 45) return { label: 'Sehr gut', next: 55, value: pct };
  if (pct >= 30) return { label: 'Gut', next: 45, value: pct };
  if (pct >= 20) return { label: 'OK', next: 30, value: pct };
  return { label: 'Schwach', next: 20, value: pct };
}

// T20-Quote (Anteil Triple bei Darts auf die 20)
export function t20ToLevel(pct) {
  if (pct == null) return { label: '—', next: 8 };
  if (pct >= 15) return { label: 'Sehr gut', note: 'Turnier-Niveau', next: 18, value: pct };
  if (pct >= 12) return { label: 'Gut', note: 'ueber Club-Durchschnitt', next: 15, value: pct };
  if (pct >= 8) return { label: 'OK', note: 'solide Basis', next: 12, value: pct };
  return { label: 'Schwach', note: 'Scoring kostet Legs', next: 8, value: pct };
}

// First-9-Ziel: 2 Punkte unter dem Schnitt ist ein guter Einstieg
export function first9Verdict(avg, first9) {
  if (avg == null || first9 == null) return { label: '—' };
  const diff = avg - first9;
  if (diff > 5) return { label: 'Langsamer Starter', note: `Einstieg ${Math.round(diff * 10) / 10} unter Schnitt — 5 Min. Warmup vor jedem Spiel`, target: Math.round(avg) };
  if (diff < -3) return { label: 'Starker Einstieg', note: 'du startest besser als dein Schnitt', target: Math.round(avg) };
  return { label: 'Konstant', note: 'Einstieg passt zum Schnitt', target: Math.round(avg) };
}

// ---------- Wochenplan: 3 Sessions aus den Schwaechen ----------
// analysis: { weaknesses: [{key,...}] } — Reihenfolge ist schon nach Schwere sortiert.
// Jede Session: ~20 Minuten, konkrete Darts-Anzahl + Pass-Marken.
const SESSION_LIBRARY = {
  doubles: {
    title: 'Doubles-Drill: D20/D19/D16',
    plan: [
      '10 Aufwaerm-Darts auf D20',
      '30 Darts auf D20/D19 im Wechsel: 12 Treffer = geschafft',
      '3 Runden Around-the-Clock auf Doubles (D1 bis D10)'
    ],
    pass: '12/30 Treffer auf D20/D19',
    world: '20/30'
  },
  checkout: {
    title: 'Checkout-Drill: Reste abwerfen',
    plan: [
      '3x Checkout 40 (D20) — alle innerhalb von 3 Darts',
      '5 Reste aus [32, 36, 41, 64, 81]: jeweils max. 3 Darts',
      'Bob\'s 27 komplett spielen (21 Runden)'
    ],
    pass: '3 der 5 Reste geschafft',
    world: '5/5 Reste, Bob\'s 27 ueber 60'
  },
  scoring: {
    title: 'Scoring-Drill: T20-Block',
    plan: [
      '25 Darts auf T20: 8 Treffer = solide, 12 = stark',
      '25 Darts auf T19 (Block-Wechsel, wenn 20 zubleibt)',
      '3 Visits aufs Ziel "100+": 2 von 3 Visits ueber 100'
    ],
    pass: '8/25 T20 im ersten Block',
    world: '14/25 T20'
  },
  t20: {
    title: 'Triple-20-Intensivblock',
    plan: [
      '3x 25 Darts auf T20, nach jedem Block 10 Darts auf Single-20 beruhigen',
      'Ziel pro Block: 8 Treffer, Steigerung +2 gegen letzten Lauf'
    ],
    pass: '8/25 T20 im ersten Block',
    world: '12/25 im dritten Block'
  },
  first9: {
    title: 'Einstiegs-Drill',
    plan: [
      '9 bewusste Darts auf T20/T19 als Warmup, 3 Durchgaenge',
      '1 kurzes Leg gegen die Uhr: unter 21 Darts',
      'Around the Clock einmal komplett vor jedem Spiel'
    ],
    pass: 'First 9 im Testleg >= Average',
    world: 'First 9 ueber Average'
  }
};

export function buildWeeklyPlan(analysis) {
  const weak = (analysis.weaknesses || []).map(w => w.key);
  const order = ['doubles', 'checkout', 'scoring', 't20', 'first9'];
  const chosen = [];
  for (const key of order) {
    if (weak.includes(key) && !chosen.includes(key)) chosen.push(key);
  }
  // Immer 3 Sessions: fehlende Schwaechen mit Grundlagen-Drills auffuellen
  const fallback = ['doubles', 'scoring', 'checkout'];
  for (const key of fallback) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(key)) chosen.push(key);
  }
  return chosen.slice(0, 3).map((key, i) => {
    const s = SESSION_LIBRARY[key] || SESSION_LIBRARY.scoring;
    return { nr: i + 1, key, title: s.title, plan: s.plan, pass: s.pass, world: s.world, minutes: 20 };
  });
}

// 2-Wochen-Vergleich als Satz ("Doppel-% letzte 2 Wochen: +6")
export function fortniteLine(prevPct, curPct, label) {
  if (prevPct == null || curPct == null) return `${label}: noch keine Vergleichswerte`;
  const d = Math.round((curPct - prevPct) * 10) / 10;
  return `${label} letzte 2 Wochen: ${d >= 0 ? '+' : ''}${String(d).replace('.', ',')}% (${prevPct}% → ${curPct}%)`;
}
