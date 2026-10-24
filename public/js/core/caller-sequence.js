// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Caller-Sequenz (pure): Visit-Ansage als Liste { clipId, gapBeforeMs }.
// Kays Timing: Dart-Calls einzeln mit 220ms Luft, 400ms nach dem letzten Dart-Call,
// IMMER "You require <rest>" (rest-<n>), bei checkoutbarem Rest +350ms der Weg.
// End-Momente: "Game shot!" → 200ms → Applaus; Match: + "Game, set and match!" + laengerer Applaus.

export const GAP_DART = 220;
export const GAP_AFTER_DARTS = 400;
export const GAP_CHECKOUT = 350;
export const GAP_APPLAUSE = 200;

// visit: { labels: ['t20','t20','s20'], rest, bust, visit180, visit100, points }
// KAY-UMBAU: keine Einzel-Segment-Calls mehr im Visit — stattdessen NUR nach dem
// dritten Dart die SUMME. Spezial: 1+5+20 (egal welche Reihenfolge) = "GAAAY!!",
// Summe 1..9 = Trash-Talk (Beleidigung), 100..179 = euphorischer visit-Clip.
// checkout: { clipId: 'co-96'|'dx-D16-match', } | null
export function visitSequence(visit, checkoutClipId = null) {
  const { labels = [], rest, bust = false, visit180 = false, points = null } = visit;
  const seq = [];
  if (bust) {
    seq.push({ clipId: 'ph-bust', gapBeforeMs: 0 });
  } else if (visit180) {
    seq.push({ clipId: 'ph-180', gapBeforeMs: 0 });
  } else if (isGayVisit(labels)) {
    seq.push({ clipId: 'ph-gay', gapBeforeMs: 0 });
  } else {
    if (points != null && points >= 100 && points <= 179) seq.push({ clipId: 'visit-' + points, gapBeforeMs: 0 });
    else if (points != null) seq.push({ clipId: 'sc-' + points, gapBeforeMs: 0 });
    if (points != null && points >= 1 && points <= 9) seq.push({ clipId: 'ph-low-' + (((points - 1) % 5) + 1), gapBeforeMs: GAP_DART });
  }
  if (rest >= 2) {
    // "IMMER You require <rest>" — Clips existieren fuer 2..170, darueber greift TTS-Fallback
    seq.push({ clipId: 'rest-' + rest, gapBeforeMs: GAP_AFTER_DARTS });
    if (!bust && checkoutClipId) seq.push({ clipId: checkoutClipId, gapBeforeMs: GAP_CHECKOUT });
  }
  return seq;
}

// KAY: 1, 5 UND 20 im selben Visit (Reihenfolge egal) => "GAAAY!!" statt Summe
export function isGayVisit(labels = []) {
  return [...labels].slice(0, 3).sort().join(',') === 's1,s20,s5';
}

// End-Moment: Game Shot (+ Legstand), Match: + "Game, set and match" + laengerer Applaus.
export function endSequence({ matchOver = false, legsWonMe = 1, legsWonOpp = 0, applause = true } = {}) {
  const seq = [{ clipId: 'ph-gameshot-high', gapBeforeMs: 0 }];
  if (matchOver) {
    seq.push({ clipId: 'ph-match', gapBeforeMs: 150 });
    if (applause) {
      seq.push({ clipId: 'applause', gapBeforeMs: GAP_APPLAUSE, volume: 0.4, playMs: 5000 });
    }
  } else {
    const a = Math.min(3, Math.max(1, legsWonMe));
    const b = Math.min(3, Math.max(0, legsWonOpp));
    seq.push({ clipId: `ph-leg-${a}-${b}`, gapBeforeMs: 120 });
    if (applause) seq.push({ clipId: 'applause', gapBeforeMs: GAP_APPLAUSE, volume: 0.4, playMs: 4000 });
  }
  return seq;
}
