import { describe, it, expect } from 'vitest';
import { buildCallerSentences, REST_MIN, REST_MAX, CHECKOUT_MAX } from '../src/caller-texts.js';
import { numberToCallerWords, remainingCallerWords } from '../src/caller.js';

// Kays Ton-Bug: rest-Clips gab es nur 2..170 -> bei Rest 171..501 fiel die App auf
// speechSynthesis (Weibliche Geraetestimme) zurueck. Die Satzliste muss den KOMPLETTEN
// Bereich 2..501 mappen, damit genau dort Clips generiert werden.
describe('Caller-Satzliste: rest-Komplettbereich 2..501', () => {
  const sentences = buildCallerSentences();

  it('je Sprache genau 500 rest-Clips (2..501) gemappt', () => {
    expect(REST_MIN).toBe(2);
    expect(REST_MAX).toBe(501);
    for (const lang of ['en', 'de']) {
      const ids = Object.keys(sentences).filter(k => k.startsWith(`${lang}/rest-`));
      expect(ids.length).toBe(500);
      for (let n = 2; n <= 501; n++) expect(ids).toContain(`${lang}/rest-${n}`);
    }
  });

  it('alle rest-Texte stammen aus numberToCallerWords (kein Drift zur App-Ansage)', () => {
    for (let n = 2; n <= 501; n++) {
      expect(sentences[`en/rest-${n}`]).toBe(remainingCallerWords(n, 'en'));
      expect(sentences[`de/rest-${n}`]).toBe(remainingCallerWords(n, 'de'));
    }
  });

  it('Beispieltexte exakt (u.a. Kays Beispiel 481)', () => {
    expect(sentences['en/rest-2']).toBe('You require two');
    expect(sentences['en/rest-170']).toBe('You require one hundred and seventy');
    expect(sentences['en/rest-171']).toBe('You require one hundred and seventy one');
    expect(sentences['en/rest-180']).toBe('You require one hundred and eighty');
    expect(sentences['en/rest-481']).toBe('You require four hundred and eighty one');
    expect(sentences['en/rest-501']).toBe('You require five hundred and one');
    expect(sentences['de/rest-481']).toBe('Du brauchst noch vierhunderteinundachtzig');
  });

  it('Rest 2..170 bleibt zahlwort-identisch zum bisherigen Stand (Regression)', () => {
    for (let n = 2; n <= 170; n++) {
      expect(sentences[`en/rest-${n}`]).toBe(`You require ${numberToCallerWords(n, 'en')}`);
    }
  });

  it('Bestand unverändert: co bis 170, dx, sc 0..180, seg, ph', () => {
    expect(Object.keys(sentences).filter(k => k.startsWith('en/co-')).length).toBe(162); // 2..170 ohne 7 nicht-checkoutbare
    expect(sentences['en/co-96']).toBe('You require treble twenty, double eighteen');
    expect(sentences['en/dx-D16']).toBe('double sixteen'); // Einzel-Doppel: kurz und knackig
    expect(sentences['en/dx-Bull']).toBe('You require bullseye');
    expect(sentences['en/sc-180']).toBe('one hundred and eighty');
    expect(sentences['en/seg-t20']).toBe('treble twenty');
    expect(sentences['en/ph-bust']).toBe('BUST!'); // KAY: BUST statt No score (24.10.)
    expect(sentences['en/ph-gameshot']).toBe('Game shot!');
    expect(sentences['en/ph-bigfish']).toBe('BIG FISH!! ONE HUNDRED AND SEVENTY!!');
    expect(sentences['en/ph-gameshot-high']).toBe('GAME SHOT!!');
  });
});

// KAY-NEU: ph-set ("SET!") ist Teil der Satzliste (Set-Gewinn-Ansage)
describe('Caller-Satzliste: ph-set', () => {
  it('ph-set vorhanden', () => {
    const s = buildCallerSentences();
    expect(s['en/ph-set']).toBe('SET!');
  });
});

// 100+-Visit-Jubel-Clips (visit-100..179) sind Teil der Satzliste
describe('Caller-Satzliste: visit-High-Clips', () => {
  it('visit-100..179 komplett gemappt (80 Clips)', () => {
    const s = buildCallerSentences();
    for (let n = 100; n <= 179; n++) expect(s[`en/visit-${n}`]).toBeTruthy();
    expect(s['en/visit-157']).toBe('one hundred and fifty seven!!');
  });
});
