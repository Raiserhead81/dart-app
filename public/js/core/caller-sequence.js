// GENERATED aus src/ — nicht hier editieren. Quelle: ../src/ (npm run sync)
// Caller-Sequenz (pure): Visit-Ansage als Liste { clipId, gapBeforeMs }.
// KAY 02.12.: keine Rest-/You-require-/Checkout-/Summen-Ansagen mehr im Visit,
// nur Moment-Clips (gapBeforeMs 0); Zahlen pro Dart macht callDart in caller-voice.js.
// Kays Timing-Konstanten bleiben exportiert (Tests importieren sie).
// End-Momente: "Game Shot!" → 200ms → Applaus; Match: + "Game, set and match!" + laengerer Applaus.

export const GAP_DART = 220;
export const GAP_AFTER_DARTS = 400;
export const GAP_CHECKOUT = 350;
export const GAP_APPLAUSE = 200;

// visit: { labels: ['t20','t20','s20'], rest, bust, visit180, noin, points }
// KAY 02.12.: NUR Momente. Spezial: 1+5+20 (egal welche Reihenfolge) = "GAAAY!!",
// Summe 1..9 = Trash-Talk (Beleidigung), 3xT20 = 180.
export function visitSequence(visit) {
  const { labels = [], bust = false, visit180 = false, noin = false, points = null } = visit;
  const seq = [];
  // KAY: Die MOMENTE gewinnen — 1+5+20 = GAAAY und 3xT20 = 180 IMMER, auch beim Bust.
  // Double-In ohne Start-Doppel: KLARE Ansage statt lapidarem 'No score'.
  if (isGayVisit(labels)) {
    seq.push({ clipId: 'ph-gay', gapBeforeMs: 0 });
  } else if (isGayFriendsVisit(labels)) {
    // KAY 11.11.: T20 + 5 + 1 (Reihenfolge egal) = "GAAAY WITH FRIENDS!!"
    seq.push({ clipId: 'ph-gay-friends', gapBeforeMs: 0 });
  } else if (noin) {
    seq.push({ clipId: 'ph-din', gapBeforeMs: 0 });
  } else if (visit180) {
    seq.push({ clipId: 'ph-180', gapBeforeMs: 0 });
  } else if (bust) {
    seq.push({ clipId: 'ph-bust', gapBeforeMs: 0 });
  } else if (points != null && points >= 1 && points <= 9) {
    seq.push({ clipId: 'ph-low-' + (((points - 1) % 5) + 1), gapBeforeMs: 0 });
  }
  return seq;
}

// KAY: 1, 5 UND 20 im selben Visit (Reihenfolge egal) => "GAAAY!!" statt Summe
export function isGayVisit(labels = []) {
  return [...labels].slice(0, 3).sort().join(',') === 's1,s20,s5';
}

// KAY 11.11.: TRIPLE 20 + 5 + 1 im selben Visit => "GAAAY WITH FRIENDS!!"
export function isGayFriendsVisit(labels = []) {
  return [...labels].slice(0, 3).sort().join(',') === 's1,s5,t20';
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
