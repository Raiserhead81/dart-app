// Regelbasierte Staerken/Schwaechen-Analyse mit Ranking und konkreten Trainings-Zuordnungen.

export function analysePlayer(stats) {
  const out = { strengths: [], weaknesses: [], dataQuality: { darts: stats.darts, enough: stats.darts >= 60 } };

  // --- Regeln mit Schwere (hoeher = dringender) bzw. Staerken-Punkten ---
  // Doppel-Quote (Ziel: 30%+)
  if (stats.doubles.attempts >= 8 && stats.doubles.pct != null) {
    const p = stats.doubles.pct;
    if (p < 20) out.weaknesses.push(id('doubles', `Doppel-Quote ${p}%`, `Nur ${stats.doubles.hits} von ${stats.doubles.attempts} Doppel-Darts trafen. Ziel sind 30% – hier liegen die meisten verlorenen Legs.`, p < 12 ? 10 : 7));
    else if (p < 30) out.weaknesses.push(id('doubles', `Doppel-Quote ${p}%`, `Unter dem Ziel von 30%. Mit stabileren Doubles drehst du enge Legs.`, 5));
    else if (p >= 40) out.strengths.push(id('doubles', `Doppel-Quote ${p}%`, `Starke Abschlussquote (${stats.doubles.hits}/${stats.doubles.attempts}) – Legs werden konvertiert.`, 8));
  }

  // Checkout-Quote (Ziel: 35%+)
  if (stats.checkout.attempts >= 5 && stats.checkout.pct != null) {
    const p = stats.checkout.pct;
    if (p < 25) out.weaknesses.push(id('checkout', `Checkout nur ${p}%`, `${stats.checkout.hits} von ${stats.checkout.attempts} Checkout-Aufnahmen verwandelt. Routen kennen und Bull/D20-Training bringt hier am meisten.`, 8));
    else if (p >= 40) out.strengths.push(id('checkout', `Checkout ${p}%`, `${stats.checkout.hits}/${stats.checkout.attempts} Aufnahmen sauber beendet.`, 7));
  }

  // 3-Dart-Average
  if (stats.darts >= 60 && stats.avg3 != null) {
    const a = stats.avg3;
    if (a < 40) out.weaknesses.push(id('scoring', `Average ${de(a)}`, `Unter 40 bedeutet: lange Legs. Mehr Scoring-Power (T20-Blöcke) kürzt jedes Leg spürbar.`, a < 32 ? 9 : 6));
    else if (a >= 55) out.strengths.push(id('scoring', `Average ${de(a)}`, `Solides Scoring-Niveau – Grundlage für schnelle Legs.`, 7));
    else if (a >= 60) out.strengths.push(id('scoring', `Average ${de(a)}`, `Sehr gutes Scoring.`, 9));
  }

  // T20-Quote
  if (stats.t20.darts >= 30 && stats.t20.pct != null) {
    const p = stats.t20.pct;
    if (p < 8) out.weaknesses.push(id('t20', `T20-Quote ${de(p)}%`, `Nur ${de(p)}% der Darts auf T20 trafen das Triple. Ziel: 12%+ – jedes Prozent sind Punkte pro Leg.`, 6));
    else if (p >= 13) out.strengths.push(id('t20', `T20-Quote ${de(p)}%`, `${de(p)}% Triple-Quote auf T20 ist stark.`, 6));
  }

  // 100+-Quote
  if (stats.visits >= 30) {
    const q = (stats.counts.c100 / stats.visits) * 100;
    if (q < 8) out.weaknesses.push(id('scoring', `Wenig 100+-Aufnahmen (${Math.round(q)}%)`, `Nur ${stats.counts.c100} Aufnahmen über 100 in ${stats.visits} Visits. Konstantes Triple-Hitting hebt das.`, 4));
  }

  // First-9 deutlich unter Average = langsamer Start
  if (stats.first9 != null && stats.avg3 != null && stats.darts >= 60) {
    const diff = stats.avg3 - stats.first9;
    if (diff > 5) out.weaknesses.push(id('first9', `Langsamer Start (First 9 ${de(stats.first9)})`, `Dein Einstieg liegt ${de(diff)} Punkte unter deinem Schnitt. Warmwerden und die ersten 3 Aufnahmen fester spielen.`, 4));
    else if (diff < -3) out.strengths.push(id('first9', `Starker Einstieg (First 9 ${de(stats.first9)})`, `Du startest besser als dein Schnitt – Druck von Anfang an.`, 5));
  }

  // Darts pro Leg
  if (stats.legsPlayed >= 5 && stats.dartsPerLeg != null) {
    if (stats.dartsPerLeg > 24) out.weaknesses.push(id('checkout', `${de(stats.dartsPerLeg)} Darts pro Leg`, `Lange Legs kosten Momentum. Checkout-Quote heben = weniger Darts pro Leg.`, 5));
    else if (stats.dartsPerLeg < 18) out.strengths.push(id('checkout', `${de(stats.dartsPerLeg)} Darts pro Leg`, `Schnelle Legs – gute Kombination aus Scoring und Abschluss.`, 6));
  }

  // 180er
  if (stats.counts.c180 >= 2) out.strengths.push(id('scoring', `${stats.counts.c180} Maxima (180)`, `Regelmäßige 180er – dein Scoring kann tragen.`, 5));

  out.weaknesses.sort((a, b) => b.severity - a.severity);
  out.strengths.sort((a, b) => b.severity - a.severity);
  return out;
}

function id(key, title, detail, severity) {
  return { key, title, detail, severity };
}

function de(x) { return String(x).replace('.', ','); }

// Kopfzeile: groesste Schwache + kurz
export function headlineFinding(analysis) {
  if (!analysis.dataQuality.enough) {
    return `Noch ${Math.max(0, 60 - analysis.dataQuality.darts)} Darts bis zur ersten belastbaren Auswertung – spiel los.`;
  }
  if (analysis.weaknesses.length === 0) return 'Keine nennenswerten Schwaechen erkannt – weiter so.';
  const w = analysis.weaknesses[0];
  return `Größter Baustelle: ${w.title}`;
}
