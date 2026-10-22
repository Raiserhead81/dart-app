// Konkrete Trainingstipps je Schwaeche, mit direktem Sprung ins passende Training.

import { TRAINING_TYPES } from './training.js';

const TIPS = {
  doubles: {
    training: 'doublesAtc',
    title: 'Doubles festigen',
    text: (w) => `Doubles-Training: 3 Sätze à 21 Ziele (D1 bis Bull). Fokus auf D16, D20 und D10 – die haeufigsten Finish-Felder. Regel: Erst zieln, dann werfen, 2 Sekunden still stehen. Schon 10 Minuten pro Session heben die Quote messbar.`
  },
  checkout: {
    training: 'checkout',
    title: 'Checkout-Drill',
    text: (w) => `Checkout-Training: 14 klassische Reste (32 bis 170) abwerfen – die App zeigt die Route, du wirfst sie Darts für Darts. Zusätzlich Bob's 27 für das reine Doppelgefühl. Ziel: 2 Darts Punkte + Doppel sauber, dann enden Legs in 18 statt 24 Darts.`
  },
  scoring: {
    training: 't20',
    title: 'Scoring aufbauen',
    text: (w) => `25 Darts auf T20, drei Durchgaenge. Notiere deine Hits – ab 8/25 bist du solide, 12/25 stark. Danach 20 Darts auf T19 (fuer 140+-Aufnahmen, wenn T20 blockiert ist).`
  },
  t20: {
    training: 't20',
    title: 'Triple 20 treffen',
    text: (w) => `Gruppe fixieren: 25 Darts nur auf T20. Achte auf identischen Stand und Wurfbogen. Wenn die 20 blockiert ist: bewusst auf T19 wechseln, nicht "danebenwerfen". Ziel diese Woche: +2 Hits gegenüber dem letzten Lauf.`
  },
  first9: {
    training: 'atc',
    title: 'Einstieg warmwerden',
    text: (w) => `Vor jedem Spiel: 1 Runde Around the Clock + 9 bewusste Darts auf T20/T19 als "First 9"-Warmup. Deine ersten 3 Aufnahmen liegen deutlich unter deinem Schnitt – 5 Minuten Warmup beheben das.`
  }
};

export function tipsFor(analysis) {
  return analysis.weaknesses.slice(0, 3).map((w, i) => {
    const tip = TIPS[w.key] || TIPS.scoring;
    return {
      rank: i + 1,
      key: w.key,
      weakness: w.title,
      severity: w.severity,
      title: tip.title,
      text: tip.text(w),
      training: tip.training,
      trainingLabel: TRAINING_TYPES[tip.training] || tip.training
    };
  });
}
