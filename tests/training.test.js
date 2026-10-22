import { describe, it, expect } from 'vitest';
import { newTraining, applyTrainingDart, trainingSummary, TRAINING_TYPES } from '../src/training.js';
import { makeThrow } from '../src/segments.js';

const T = n => makeThrow('triple', n);
const D = n => makeThrow('double', n);
const S = n => makeThrow('single', n);
const MISS = () => makeThrow('miss', 0);
const BULL = () => makeThrow('bull', 50);

describe('around the clock', () => {
  it('Treffer schaltet weiter, Ziel 1 zuerst', () => {
    const s = newTraining('atc');
    expect(s.targets[0]).toBe(1);
    applyTrainingDart(s, MISS());
    applyTrainingDart(s, T(1));
    expect(s.idx).toBe(1);
  });

  it('fertig nach Bull', () => {
    const s = newTraining('atc');
    for (let n = 1; n <= 20; n++) applyTrainingDart(s, S(n));
    const ev = applyTrainingDart(s, BULL());
    expect(s.finished).toBe(true);
    expect(ev.type).toBe('done');
    expect(s.throws.length).toBe(21);
  });
});

describe("bob's 27", () => {
  it('Regel: 3 Treffer D1 -> 27+6, Miss-Runde -2d', () => {
    const s = newTraining('bob27');
    for (const _ of [1, 2, 3]) applyTrainingDart(s, D(1));
    expect(s.score).toBe(27 + 2 * 1 * 3);
    // Runde 2: alle missen -> -4
    for (const _ of [1, 2, 3]) applyTrainingDart(s, S(2));
    expect(s.score).toBe(27 + 6 - 4);
    expect(s.round).toBe(3);
  });

  it('Abbruch bei Score <= 0', () => {
    const s = newTraining('bob27');
    // 27 - 2*3 Runden Miss: D1(-2), D2(-4), D3(-6), D4(-8), D5(-10) => 27-30 = -3 <= 0
    for (let r = 1; r <= 5; r++) for (let d = 0; d < 3; d++) applyTrainingDart(s, S(20));
    expect(s.finished).toBe(true);
    expect(s.score).toBe(-3);
  });
});

describe('shanghai', () => {
  it('Punkte: S=1 D=2 T=3 pro Treffer der Runden-Zahl', () => {
    const s = newTraining('shanghai');
    applyTrainingDart(s, T(1)); // 3
    applyTrainingDart(s, S(1)); // +1
    const ev = applyTrainingDart(s, S(2)); // keine Punkte, Visit zu Ende -> Runde 2
    expect(s.score).toBe(4);
    expect(s.round).toBe(2);
  });

  it('Shanghai = automatischer Sieg', () => {
    const s = newTraining('shanghai');
    applyTrainingDart(s, S(1));
    applyTrainingDart(s, D(1));
    const ev = applyTrainingDart(s, T(1));
    expect(s.shanghai).toBe(true);
    expect(s.finished).toBe(true);
  });
});

describe('25 Darts T20', () => {
  it('Hits und Score', () => {
    const s = newTraining('t20');
    for (let i = 0; i < 10; i++) applyTrainingDart(s, T(20));
    for (let i = 0; i < 15; i++) applyTrainingDart(s, S(20));
    expect(s.finished).toBe(true);
    expect(s.hits).toBe(10);
    expect(s.score).toBe(10 * 60 + 15 * 20);
  });
});

describe('checkout training', () => {
  it('Route wird geladen und Treffer weiterschalten', () => {
    const s = newTraining('checkout');
    const route = s.rests[0] === 170 ? ['T20', 'T20', 'Bull'] : null;
    expect(route).toEqual(['T20', 'T20', 'Bull']);
    applyTrainingDart(s, T(20));
    expect(s.idx).toBe(1);
    applyTrainingDart(s, T(20));
    applyTrainingDart(s, BULL());
    expect(s.done).toBe(1);
    expect(s.pos).toBe(1);
    // Falscher Dart zaehlt Fehler
    applyTrainingDart(s, S(20));
    expect(s.misses).toBe(1);
  });
});

describe('training summary', () => {
  it('liefert Kenzahlen ohne Fehler', () => {
    const s = newTraining('t20');
    applyTrainingDart(s, T(20));
    const sum = trainingSummary(s);
    expect(sum.headline).toContain('1/25');
  });
});
