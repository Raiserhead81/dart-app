import { describe, it, expect } from 'vitest';
import { newX01, applyDart, setupFromSettings } from '../src/x01.js';
import { makeThrow, parseThrowInput } from '../src/segments.js';

const T20 = () => makeThrow('triple', 20);
const S = n => makeThrow('single', n);
const D = n => makeThrow('double', n);
const MISS = () => makeThrow('miss', 0);
const BULL = () => makeThrow('bull', 50);

describe('x01 basics', () => {
  it('Start-State 501 Double Out', () => {
    const s = newX01({ start: 501, players: ['Kay'] });
    expect(s.leg.remaining[0]).toBe(501);
    expect(s.doubleOut).toBe(true);
    expect(s.current).toBe(0);
  });

  it('normale Aufnahme: 3 Darts dann Wechsel', () => {
    const s = newX01({ start: 501, players: ['A', 'B'] });
    applyDart(s, T20());
    applyDart(s, T20());
    const ev = applyDart(s, T20());
    expect(ev.type).toBe('turn');
    expect(s.leg.remaining[0]).toBe(321);
    expect(s.current).toBe(1);
  });

  it('Leg-Gewinn mit Double-Out', () => {
    const s = newX01({ start: 101, players: ['A'], firstTo: 1 });
    for (const t of [T20(), T20(), T20()]) applyDart(s, t); // 101->... 3 Visits: 60*3=180? 101-60=41 etc.
    // gezielt spielen: 60, 41 rest -> T20? 41: S9 D16
    const s2 = newX01({ start: 101, players: ['A'], firstTo: 1 });
    applyDart(s2, T20()); // 41
    applyDart(s2, S(9));  // 32
    const ev = applyDart(s2, D(16)); // out
    expect(ev.type).toBe('match');
    expect(s2.finished).toBe(true);
    expect(s2.winner).toBe(0);
    expect(s2.legsWon[0]).toBe(1);
  });

  it('Bust: Rest unter 0 -> Ruecksetzung + Wechsel', () => {
    const s = newX01({ start: 50, players: ['A', 'B'] });
    // Visit 1: 20,20 -> Rest 10, dann D? -> wir machen Bust: S(9) -> Rest 1 -> Bust!
    applyDart(s, S(20));
    applyDart(s, S(20));
    const ev = applyDart(s, S(9)); // Rest 1 => Bust bei Double Out
    expect(ev.type).toBe('bust');
    expect(s.leg.remaining[0]).toBe(50);
    expect(s.current).toBe(1);
  });

  it('Rest 1 ohne Double ist Bust', () => {
    const s = newX01({ start: 40, players: ['A'] });
    applyDart(s, S(20));
    const ev = applyDart(s, D(10)); // 40-20=20 nach erstem, jetzt D10 -> 0? nein Rest 20 -> D10 = 0 out!
    expect(ev.type).toBe('match');
  });

  it('Finish ohne Double ist Bust (Double Out)', () => {
    const s = newX01({ start: 32, players: ['A'] });
    const ev = applyDart(s, S(16)); // Rest 16 -> nicht 0. anders testen:
    const s2 = newX01({ start: 60, players: ['A'] });
    const ev2 = applyDart(s2, S(60)); // 60 mit Single -> Bust
    expect(ev2.type).toBe('bust');
    expect(s2.leg.remaining[0]).toBe(60);
  });

  it('Bull 50 zaehlt als Double-Finish', () => {
    const s = newX01({ start: 50, players: ['A'] });
    const ev = applyDart(s, BULL());
    expect(ev.type).toBe('match');
  });

  it('Double-In: Wuerfe vor dem ersten Doppel zahlen nichts', () => {
    const s = newX01({ start: 301, players: ['A'], doubleIn: true });
    applyDart(s, T20());   // kein Score
    applyDart(s, S(5));    // kein Score
    const ev = applyDart(s, D(20)); // Start
    expect(s.leg.remaining[0]).toBe(261);
    expect(s.throws[0][0].noScore).toBe(true);
    expect(s.throws[0][1].noScore).toBe(true);
    expect(s.throws[0][2].noScore).toBeUndefined();
  });

  it('first to 2: nach Leg 1 kein Match-Ende', () => {
    const s = newX01({ start: 101, players: ['A'], firstTo: 2 });
    const play = () => {
      applyDart(s, T20());
      applyDart(s, S(9));
      return applyDart(s, D(16));
    };
    expect(play().type).toBe('leg');
    expect(s.finished).toBe(false);
    expect(s.leg.legNo).toBe(2);
    expect(play().type).toBe('match');
  });

  it('2 Spieler: Starter wechselt pro Leg', () => {
    const s = newX01({ start: 101, players: ['A', 'B'], firstTo: 3 });
    applyDart(s, T20());
    applyDart(s, S(9));
    applyDart(s, D(16)); // A gewinnt Leg 1
    expect(s.current).toBe(1);          // B startet Leg 2
    expect(s.leg.legNo).toBe(2);
    expect(s.legsWon).toEqual([1, 0]);
    applyDart(s, T20()); // B
    applyDart(s, S(9));
    applyDart(s, D(16)); // B gewinnt Leg 2
    expect(s.finished).toBe(false);
    expect(s.legsWon).toEqual([1, 1]);
  });

  it('visits: Bust-Aufnahme zaehlt 0 Punkte, 3 Darts', () => {
    const s = newX01({ start: 50, players: ['A'] });
    applyDart(s, S(20));
    applyDart(s, S(20));
    applyDart(s, S(9)); // Bust (Rest 1)
    expect(s.visits.length).toBe(1);
    expect(s.visits[0].points).toBe(0);
    expect(s.visits[0].darts).toBe(3);
  });

  it('visits: phase finish bei Rest <= 50', () => {
    const s = newX01({ start: 90, players: ['A'] });
    applyDart(s, S(20));
    applyDart(s, S(20));
    applyDart(s, S(1)); // Rest 49 -> Visit endet, phase score (visitStart war 90)
    applyDart(s, S(9));
    applyDart(s, S(20));
    applyDart(s, S(20)); // Rest 0? 49-49=0? Rest nach: 49, dann 9->40, 20->20, 20->0 ohne Double = Bust!
    expect(s.visits[1].phase).toBe('finish');
    expect(s.visits[1].points).toBe(0);
  });
});

// KAY-NEU: Sets (Best of N) — Leg-Zaehler startet pro Set bei 0, Set-Gewinn = 'set'-Event
describe('X01 Sets-Modus', () => {
  function finishLegFast(s, p) {
    // Solo-Leg per State-Injection abschliessen: remaining auf 40, dann D20
    s.leg.remaining[p] = 40;
    return applyDart(s, { k: 'double', n: 20, c: 'D20', v: 40 });
  }

  it('Best of 3 Sets, First to 1: Leg 1 gewinnt das SET (legs reset, setsWon 1-0)', () => {
    const s = newX01({ start: 501, players: ['A'], firstTo: 1, setsTo: 3 });
    const ev = finishLegFast(s, 0);
    expect(ev.type).toBe('set');
    expect(ev.sets).toEqual([1]);
    expect(s.setsWon).toEqual([1]);
    expect(s.legsWon).toEqual([0]); // neues Set: Legs bei 0
    expect(s.finished).toBe(false);
  });

  it('Best of 3 Sets: zweites Set entscheidet das MATCH', () => {
    const s = newX01({ start: 501, players: ['A'], firstTo: 1, setsTo: 3 });
    finishLegFast(s, 0); // Set 1 -> 1-0
    const ev2 = finishLegFast(s, 0); // Set 2 -> Match
    expect(ev2.type).toBe('match');
    expect(ev2.sets).toEqual([2]);
    expect(s.finished).toBe(true);
    expect(s.winner).toBe(0);
  });

  it('ohne SetsTo: Verhalten wie bisher (Leg entscheidet direkt das Match)', () => {
    const s = newX01({ start: 501, players: ['A'], firstTo: 2 });
    finishLegFast(s, 0);
    expect(s.legsWon).toEqual([1]);
    expect(s.finished).toBe(false); // firstTo 2: noch kein Match
    const ev = finishLegFast(s, 0);
    expect(ev.type).toBe('match');
    expect(s.legsWon).toEqual([2]); // Legs akkumulieren weiter
    expect(s.setsWon).toEqual([0]); // nie gesetzt
  });

  it('Verlust-Leg im Set-Modus resettet nicht (Sets bleiben)', () => {
    const s = newX01({ start: 501, players: ['A'], firstTo: 1, setsTo: 3 });
    finishLegFast(s, 0); // A gewinnt Set 1-0
    expect(s.setsWon).toEqual([1]);
    expect(s.leg.legNo).toBe(2);
  });
});

// KAY-NEU: gemerkte Voreinstellung (zuletzt genutzte Kombi bleibt vorausgewaehlt)
describe('Setup-Voreinstellung (setupFromSettings)', () => {
  it('Defaults ohne gespeicherte Werte: 501 / First to 3 / Keine Sets / X01', () => {
    const d = setupFromSettings({});
    expect(d).toEqual({ mode: 'x01', start: 501, firstTo: 3, setsTo: 0 });
  });

  it('zuletzt genutzte Kombi wird uebernommen (Kays Modus: 3 Legs je Set, Best of 5)', () => {
    const d = setupFromSettings({ lastMode: 'x01', lastStart: 501, lastFirstTo: 3, lastSetsTo: 5 });
    expect(d.firstTo).toBe(3);   // Legs pro Satz
    expect(d.setsTo).toBe(5);    // Best of 5 Sets
    const s = newX01({ start: d.start, players: ['A', 'B'], firstTo: d.firstTo, setsTo: d.setsTo });
    expect(s.setsTo).toBe(5);
    expect(s.firstTo).toBe(3);
  });

  it('Best of 5: Match bei 3-2 (Satzgewinn entscheidet)', () => {
    const s = newX01({ start: 501, players: ['A', 'B'], firstTo: 1, setsTo: 5 });
    // A holt Set 1, B Set 2, A Set 3, B Set 4, A Set 5 -> 3-2
    const winners = [0, 1, 0, 1, 0];
    const evs = winners.map(w => finishLegFor(s, w));
    expect(s.setsWon).toEqual([3, 2]);
    expect(evs[4].type).toBe('match');
    expect(evs.every(e => ['set', 'match'].includes(e.type))).toBe(true);
  });

  it('Leg-Gewinn ohne Set-Ende bleibt "leg" (Legstand-Call pro Set)', () => {
    const s = newX01({ start: 501, players: ['A', 'B'], firstTo: 2, setsTo: 3 });
    const ev = finishLegFor(s, 0);
    expect(ev.type).toBe('leg'); // erstes Leg von 2: kein Set-Ende
    expect(s.legsWon).toEqual([1, 0]);
    expect(s.setsWon).toEqual([0, 0]);
  });

  function finishLegFor(s, p) {
    s.current = p;
    s.leg.remaining[p] = 40;
    return applyDart(s, { k: 'double', n: 20, c: 'D20', v: 40 });
  }
});
