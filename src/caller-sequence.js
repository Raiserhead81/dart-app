// Caller-Sequenz (pure): Visit-Ansage als Liste { clipId, gapBeforeMs }.
// Kays Timing: Dart-Calls einzeln mit 220ms Luft, 400ms nach dem letzten Dart-Call,
// IMMER "You require <rest>" (rest-<n>), bei checkoutbarem Rest +350ms der Weg.
// End-Momente: "Game shot!" → 200ms → Applaus; Match: + "Game, set and match!" + laengerer Applaus.

export const GAP_DART = 220;
export const GAP_AFTER_DARTS = 400;
export const GAP_CHECKOUT = 350;
export const GAP_APPLAUSE = 200;

// visit: { labels: ['t20','t20','s20'], rest, bust, visit180, visit100 }
// checkout: { clipId: 'co-96'|'dx-D16-match', } | null
export function visitSequence(visit, checkoutClipId = null) {
  const { labels = [], rest, bust = false, visit180 = false } = visit;
  const seq = [];
  if (bust) {
    seq.push({ clipId: 'ph-bust', gapBeforeMs: 0 });
  } else if (visit180) {
    seq.push({ clipId: 'ph-180', gapBeforeMs: 0 });
  } else {
    labels.forEach((l, i) => seq.push({ clipId: 'seg-' + l, gapBeforeMs: i === 0 ? 0 : GAP_DART }));
  }
  if (rest >= 2) {
    // "IMMER You require <rest>" — Clips existieren fuer 2..170, darueber greift TTS-Fallback
    seq.push({ clipId: 'rest-' + rest, gapBeforeMs: GAP_AFTER_DARTS });
    if (!bust && checkoutClipId) seq.push({ clipId: checkoutClipId, gapBeforeMs: GAP_CHECKOUT });
  }
  return seq;
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
