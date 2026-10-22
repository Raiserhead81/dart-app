import { describe, it, expect } from 'vitest';
import { visitSequence, endSequence, GAP_DART, GAP_AFTER_DARTS, GAP_CHECKOUT, GAP_APPLAUSE } from '../src/caller-sequence.js';

describe('Caller-Sequenz (Kays Timing)', () => {
  it('Dart-Calls einzeln mit 220ms Luft', () => {
    const seq = visitSequence({ labels: ['t20', 't20', 's20'], rest: 361 });
    expect(seq.map(s => s.clipId)).toEqual(['seg-t20', 'seg-t20', 'seg-s20', 'rest-361']);
    expect(seq[1].gapBeforeMs).toBe(GAP_DART);
    expect(seq[2].gapBeforeMs).toBe(GAP_DART);
    expect(seq[3].gapBeforeMs).toBe(GAP_AFTER_DARTS);
  });

  it('Rest <= 40: voller require-Satz + Doppel-Weg mit 350ms', () => {
    const seq = visitSequence({ labels: ['s20', 's20'], rest: 40, checkoutRoute: true }, 'dx-D20-match');
    expect(seq.map(s => s.clipId)).toEqual(['seg-s20', 'seg-s20', 'rest-40', 'dx-D20-match']);
    expect(seq[2].gapBeforeMs).toBe(GAP_AFTER_DARTS);
    expect(seq[3].gapBeforeMs).toBe(GAP_CHECKOUT);
  });

  it('grössere Rests: Checkout-Pfad-Ansage co-<n>', () => {
    const seq = visitSequence({ labels: ['t20', 't15'], rest: 96 }, 'co-96');
    expect(seq.map(s => s.clipId)).toEqual(['seg-t20', 'seg-t15', 'rest-96', 'co-96']);
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
    const over = visitSequence({ labels: ['t20'], rest: 501 });
    expect(over.map(s => s.clipId)).toEqual(['seg-t20', 'rest-501']);
    expect(visitSequence({ labels: ['t20'], rest: 1 }).length).toBe(1);
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
