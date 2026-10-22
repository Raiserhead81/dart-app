import { describe, it, expect } from 'vitest';
import { numberToCallerWords, throwCallerWords, remainingCallerWords, gameShotCallerWords, checkoutCallWords } from '../src/caller.js';

describe('numberToCallerWords EN', () => {
  it('Kernforderungen', () => {
    expect(numberToCallerWords(180)).toBe('one hundred and eighty');
    expect(numberToCallerWords(170)).toBe('one hundred and seventy');
    expect(numberToCallerWords(2)).toBe('two');
    expect(numberToCallerWords(0)).toBe('no score');
  });
  it('weitere Werte', () => {
    expect(numberToCallerWords(501)).toBe('five hundred and one');
    expect(numberToCallerWords(100)).toBe('one hundred');
    expect(numberToCallerWords(26)).toBe('twenty six');
    expect(numberToCallerWords(45)).toBe('forty five');
    expect(numberToCallerWords(105)).toBe('one hundred and five');
    expect(numberToCallerWords(140)).toBe('one hundred and forty');
    expect(numberToCallerWords(60)).toBe('sixty');
  });
});

describe('numberToCallerWords DE', () => {
  it('Kernwerte', () => {
    expect(numberToCallerWords(180, 'de')).toBe('hundertachtzig');
    expect(numberToCallerWords(170, 'de')).toBe('hundertsiebzig');
    expect(numberToCallerWords(2, 'de')).toBe('zwei');
    expect(numberToCallerWords(0, 'de')).toBe('kein Score');
    expect(numberToCallerWords(21, 'de')).toBe('einundzwanzig');
    expect(numberToCallerWords(501, 'de')).toBe('fünfhunderteins');
  });
});

describe('Caller-Saetze', () => {
  it('Rest-Satz', () => {
    expect(remainingCallerWords(170)).toBe('You require one hundred and seventy');
    expect(remainingCallerWords(170, 'de')).toBe('Du brauchst noch hundertsiebzig');
  });
  it('Segment-Call', () => {
    expect(throwCallerWords({ k: 'triple', n: 20, v: 60 })).toBe('treble twenty');
    expect(throwCallerWords({ k: 'double', n: 16, v: 32 })).toBe('double sixteen');
    expect(throwCallerWords({ k: 'bull', n: 50, v: 50 })).toBe('bullseye');
    expect(throwCallerWords({ k: 'miss', n: 0, v: 0 })).toBe('no score');
    expect(throwCallerWords({ k: 'sum', v: 45 })).toBe('forty five');
  });
  it('Game Shot', () => {
    expect(gameShotCallerWords()).toBe('Game shot!');
    expect(gameShotCallerWords('en', 2)).toBe('Game shot! 2 legs to go');
  });
});

describe('Checkout-Ansage', () => {
  it('Route-Ansagen mit Prefix', () => {
    expect(checkoutCallWords(170)).toBe('You require treble twenty, treble twenty, bullseye');
    expect(checkoutCallWords(167)).toBe('You require treble twenty, treble nineteen, bullseye');
  });
  it('einfaches Doppel: kurz und knackig', () => {
    expect(checkoutCallWords(40, 'en', 'match')).toBe('double twenty for the match');
    expect(checkoutCallWords(2, 'en', 'game')).toBe('double one for the game');
    expect(checkoutCallWords(32)).toBe('double sixteen');
  });
  it('ohne Prefix (Zwischenruf nach Dart 2)', () => {
    expect(checkoutCallWords(170, 'en', 'plain', false)).toBe('treble twenty, treble twenty, bullseye');
  });
  it('nicht checkoutbar -> null', () => {
    expect(checkoutCallWords(169)).toBeNull();
    expect(checkoutCallWords(200)).toBeNull();
  });
  it('deutsch', () => {
    expect(checkoutCallWords(40, 'de', 'game')).toBe('doppel zwanzig zum Sieg');
  });
});
