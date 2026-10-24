import { describe, it, expect } from 'vitest';
import { visitSequence, endSequence, GAP_DART, GAP_AFTER_DARTS, GAP_CHECKOUT, GAP_APPLAUSE } from '../src/caller-sequence.js';

describe('Caller-Sequenz (Kays Timing)', () => {
  it('KAY: NUR Summe nach dem 3. Dart — keine Einzel-Segmente mehr', () => {
    const seq = visitSequence({ labels: ['t20', 't20', 's20'], rest: 361, points: 100 });
    expect(seq.map(s => s.clipId)).toEqual(['visit-100', 'rest-361']);
    expect(seq[1].gapBeforeMs).toBe(GAP_AFTER_DARTS);
  });

  it('Summe unter 100: sc-<points>-Clip', () => {
    const seq = visitSequence({ labels: ['t20', 's1', 's5'], rest: 455, points: 66 });
    expect(seq.map(s => s.clipId)).toEqual(['sc-66', 'rest-455']);
  });

  it('KAY: 1+5+20 in beliebiger Reihenfolge = GAAAY statt Summe', () => {
    for (const labels of [['s1', 's5', 's20'], ['s20', 's1', 's5'], ['s5', 's20', 's1']]) {
      const seq = visitSequence({ labels, rest: 475, points: 26 });
      expect(seq.map(s => s.clipId)).toEqual(['ph-gay', 'rest-475']);
    }
  });

  it('KAY: 1+5+20 = GAAAY AUCH beim Bust (Rest 26, kein Doppel)', () => {
    const seq = visitSequence({ labels: ['s1', 's5', 's20'], rest: 26, bust: true, points: 0 });
    expect(seq.map(s => s.clipId)).toEqual(['ph-gay', 'rest-26']);
  });

  it('KAY: Visit unter 10 => Summe + Beleidigung (5 Varianten rotierend)', () => {
    const seq = visitSequence({ labels: ['s3', 's2', 's1'], rest: 444, points: 6 });
    expect(seq.map(s => s.clipId)).toEqual(['sc-6', 'ph-low-1', 'rest-444']);
    expect(seq[1].gapBeforeMs).toBe(GAP_DART);
    expect(visitSequence({ labels: ['s3', 's3', 's3'], rest: 442, points: 9 })[1].clipId).toBe('ph-low-4');
    expect(visitSequence({ labels: ['s1', 'miss', 'miss'], rest: 499, points: 1 })[1].clipId).toBe('ph-low-1');
  });

  it('Rest <= 40: voller require-Satz + Doppel-Weg mit 350ms', () => {
    const seq = visitSequence({ labels: ['s20', 's20'], rest: 40, points: 40, checkoutRoute: true }, 'dx-D20-match');
    expect(seq.map(s => s.clipId)).toEqual(['sc-40', 'rest-40', 'dx-D20-match']);
    expect(seq[1].gapBeforeMs).toBe(GAP_AFTER_DARTS);
    expect(seq[2].gapBeforeMs).toBe(GAP_CHECKOUT);
  });

  it('grössere Rests: Checkout-Pfad-Ansage co-<n>', () => {
    const seq = visitSequence({ labels: ['t20', 't15'], rest: 96, points: 45 }, 'co-96');
    expect(seq.map(s => s.clipId)).toEqual(['sc-45', 'rest-96', 'co-96']);
  });

  it('180: grosser Call statt drei Segment-Calls', () => {
    const seq = visitSequence({ labels: ['t20', 't20', 't20'], rest: 321, visit180: true });
    expect(seq[0].clipId).toBe('ph-180');
    expect(seq[1].clipId).toBe('rest-321');
    expect(seq[1].gapBeforeMs).toBe(GAP_AFTER_DARTS);
  });

  it('Bust: No score + Rest', () => {
    const seq = visitSequence({ labels: ['t20'], rest: 501, bust: true });
    expect(seq[0].clipId).toBe('ph-bust');
    expect(seq[1].clipId).toBe('rest-501');
  });

  it('Rest > 170: require-Satz ja (TTS-Fallback), kein Checkout-Clip; rest < 2: kein rest-Item', () => {
    const over = visitSequence({ labels: ['t20'], rest: 501, points: 20 });
    expect(over.map(s => s.clipId)).toEqual(['sc-20', 'rest-501']);
    expect(visitSequence({ labels: ['t20'], rest: 1, points: 20 }).length).toBe(1);
  });

  it('Game-Shot-Sequenz mit Applaus', () => {
    const seq = endSequence({ matchOver: false, legsWonMe: 1, legsWonOpp: 0, applause: true });
    expect(seq.map(s => s.clipId)).toEqual(['ph-gameshot-high', 'ph-leg-1-0', 'applause']);
    expect(seq[2].gapBeforeMs).toBe(GAP_APPLAUSE);
    expect(seq[2].volume).toBeCloseTo(0.4);
    expect(seq[2].playMs).toBe(4000);
  });

  it('Match-Ende: Game, set and match + laengerer Applaus', () => {
    const seq = endSequence({ matchOver: true, applause: true });
    expect(seq.map(s => s.clipId)).toEqual(['ph-gameshot-high', 'ph-match', 'applause']);
    expect(seq[2].playMs).toBe(5000);
  });

  it('Applaus aus: keine applause-Clips', () => {
    const seq = endSequence({ matchOver: false, applause: false });
    expect(seq.some(s => s.clipId === 'applause')).toBe(false);
  });
});
