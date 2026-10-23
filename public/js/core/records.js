// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Persoenliche Rekorde (pure): beste Avg, beste Checkout-%, schnellstes Leg,
// meiste 180er in einem Spiel — mit Datum. Quelle: games-Records der App.

function gameDate(g) {
  return g.date ? new Date(g.date) : null;
}
function shortDate(g) {
  const d = gameDate(g);
  return d ? d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';
}
const better = (cur, v) => cur == null || (v != null && v > cur);

export function bestRecords(games, player) {
  const out = {};
  for (const g of games) {
    if (g.kind !== 'x01') continue;
    const r = (g.results || []).find(x => x.player === player);
    if (!r) continue;
    const date = shortDate(g);
    const label = `${date} · ${g.label || 'X01'}`;
    if (better(out.avg?.v, r.avg3)) out.avg = { v: r.avg3, date, label };
    const co = r.checkouts?.attempts ? Math.round(r.checkouts.hits / r.checkouts.attempts * 100) : null;
    if (co != null && better(out.checkout?.v, co)) out.checkout = { v: co, date, label };
    for (const le of g.legEvents || []) {
      if (le.winner === player && le.darts && (out.fastestLeg == null || le.darts < out.fastestLeg.darts)) {
        out.fastestLeg = { darts: le.darts, date, label: `${label} · Leg in ${le.darts} Darts` };
      }
    }
    const c180 = r.counts?.c180 || 0;
    if (c180 > 0 && better(out.most180?.n, c180)) out.most180 = { n: c180, date, label };
  }
  return out;
}

// Welche Rekorde bricht dieses frische Ergebnis? games = Bestand OHNE das neue Game.
export function newRecordsBroken(games, player, result) {
  const out = [];
  if (!result) return out;
  const prev = bestRecords(games, player);
  if (result.avg3 != null && (prev.avg == null || result.avg3 > prev.avg.v)) {
    out.push({ kind: 'avg', v: result.avg3, label: `3-Dart-Avg ${result.avg3}` });
  }
  const co = result.checkouts?.attempts ? Math.round(result.checkouts.hits / result.checkouts.attempts * 100) : null;
  if (co != null && (prev.checkout == null || co > prev.checkout.v)) {
    out.push({ kind: 'checkout', v: co, label: `Checkout ${co}%` });
  }
  const c180 = result.counts?.c180 || 0;
  if (c180 > 0 && c180 > (prev.most180?.n || 0)) {
    out.push({ kind: 'most180', v: c180, label: `${c180}× 180 in einem Spiel` });
  }
  return out;
}
