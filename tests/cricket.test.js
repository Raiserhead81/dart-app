import { describe, it, expect } from 'vitest';
import { newCricket, applyCricketDart, cricketNextTurn, CRICKET_NUMBERS } from '../src/cricket.js';
import { makeThrow } from '../src/segments.js';

const T = n => makeThrow('triple', n);
const D = n => makeThrow('double', n);
const S = n => makeThrow('single', n);
const BULL = () => makeThrow('bull', 50);

describe('cricket standard', () => {
  it('Marks korrekt: T=3, D=2, S=1', () => {
    const s = newCricket({ players: ['A', 'B'] });
    applyCricketDart(s, T(20));
    expect(s.marks[0][20]).toBe(3);
    applyCricketDart(s, S(19));
    expect(s.marks[0][19]).toBe(1);
  });

  it('Punkte nur bei geschlossener Zahl auf offenen Gegner', () => {
    const s = newCricket({ players: ['A', 'B'] });
    applyCricketDart(s, T(20));   // A schliesst 20
    cricketNextTurn(s);
    applyCricketDart(s, S(20));   // B: 1 Mark, eigene Zahl nicht zu -> keine Punkte
    cricketNextTurn(s);
    applyCricketDart(s, S(20));   // A: 20 zu, B offen -> +20
    expect(s.points[0]).toBe(20);
    expect(s.points[1]).toBe(0);
  });

  it('Punkte stoppen wenn Gegner geschlossen', () => {
    const s = newCricket({ players: ['A', 'B'] });
    applyCricketDart(s, T(20));
    cricketNextTurn(s);
    applyCricketDart(s, T(20));   // B schliesst auch
    cricketNextTurn(s);
    applyCricketDart(s, T(20));   // A: overflow, aber B zu -> keine Punkte
    expect(s.points[0]).toBe(0);
    expect(s.points[1]).toBe(0);
  });

  it('Bull: nur 50 zaehlt als Marke', () => {
    const s = newCricket({ players: ['A', 'B'] });
    applyCricketDart(s, makeThrow('outer', 25));
    expect(s.marks[0][25]).toBe(0);
    applyCricketDart(s, BULL());
    expect(s.marks[0][25]).toBe(1);
  });

  it('Sieg: alle Zahlen zu und Fuehrung', () => {
    const s = newCricket({ players: ['A', 'B'] });
    for (const n of [15, 16, 17, 18, 19, 20]) {
      applyCricketDart(s, T(n));
      cricketNextTurn(s);
      applyCricketDart(s, S(3)); // B wirft daneben (keine Marke)
      cricketNextTurn(s);
    }
    for (let i = 0; i < 3; i++) applyCricketDart(s, BULL()); // 3 Bull-Marks schliessen
    expect(s.finished).toBe(true);
    expect(s.winner).toBe(0);
  });
});

describe('cut throat', () => {
  it('Punkte gehen an Gegner', () => {
    const s = newCricket({ players: ['A', 'B'], cutThroat: true });
    applyCricketDart(s, T(20));   // A schliesst 20
    cricketNextTurn(s);
    applyCricketDart(s, S(20));   // B: 1 Mark
    cricketNextTurn(s);
    applyCricketDart(s, S(20));   // A: overflow -> B bekommt 20
    expect(s.points[1]).toBe(20);
    expect(s.points[0]).toBe(0);
  });
});
