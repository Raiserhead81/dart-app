import { describe, it, expect } from 'vitest';
import { visitSequence, endSequence, GAP_DART, GAP_AFTER_DARTS, GAP_CHECKOUT, GAP_APPLAUSE } from '../src/caller-sequence.js';

const ids = seq => seq.map(s => s.clipId);

describe('Caller-Sequenz (KAY 02.12.: nur Momente)', () => {

  it('GAP-Konstanten (KAY 02.12.)', () => {
    expect(GAP_DART).toBe(220);
    expect(GAP_AFTER_DARTS).toBe(400);
    expect(GAP_CHECKOUT).toBe(350);
    expect(GAP_APPLAUSE).toBe(200);
  });

  it('Gay: 1+5+20 in beliebiger Reihenfolge => exakt ph-gay', () => {
    for (const labels of [['s1', 's5', 's20'], ['s20', 's1', 's5'], ['s5', 's20', 's1']]) {
      const seq = visitSequence({ labels, rest: 475, points: 26 });
      expect(ids(seq)).toEqual(['ph-gay']);
      expect(seq[0].gapBeforeMs).toBe(0);
    }
  });

  it('Gay AUCH beim Bust', () => {
    const seq = visitSequence({ labels: ['s1', 's5', 's20'], rest: 26, bust: true, points: 0 });
    expect(ids(seq)).toEqual(['ph-gay']);
  });

  it('GayFriends: s1,s5,t20 in beliebiger Reihenfolge => ph-gay-friends', () => {
    for (const labels of [['s1', 's5', 't20'], ['t20', 's1', 's5'], ['s5', 't20', 's1']]) {
      expect(ids(visitSequence({ labels, rest: 435, points: 66 }))).toEqual(['ph-gay-friends']);
    }
  });

  it('GayFriends AUCH beim Bust', () => {
    expect(ids(visitSequence({ labels: ['t20', 's1', 's5'], rest: 5, bust: true, points: 0 })))
      .toEqual(['ph-gay-friends']);
  });

  it('noin => ph-din', () => {
    expect(ids(visitSequence({ labels: ['noin', 'noin', 'noin'], rest: 501, points: 0, noin: true })))
      .toEqual(['ph-din']);
  });

  it('visit180 (3xT20) => ph-180, auch beim Bust', () => {
    const seq = visitSequence({ labels: ['t20', 't20', 't20'], rest: 321, visit180: true });
    expect(ids(seq)).toEqual(['ph-180']);
    const bust = visitSequence({ labels: ['t20', 't20', 't20'], rest: 180, bust: true, visit180: true, points: 0 });
    expect(ids(bust)).toEqual(['ph-180']);
  });

  it('Bust ohne Spezialmoment => ph-bust', () => {
    expect(ids(visitSequence({ labels: ['t20'], rest: 501, bust: true, points: 0 })))
      .toEqual(['ph-bust']);
  });

  it('Low Score: points 1..9 => ph-low-1..5 rotierend (points-1)%5+1', () => {
    expect(visitSequence({ labels: ['s3', 's2', 's1'], rest: 444, points: 6 })[0].clipId).toBe('ph-low-1');
    expect(visitSequence({ labels: ['s1', 'miss', 'miss'], rest: 499, points: 1 })[0].clipId).toBe('ph-low-1');
    expect(visitSequence({ labels: ['s5', 's4', 'miss'], rest: 491, points: 9 })[0].clipId).toBe('ph-low-4');
    expect(visitSequence({ labels: ['s2', 's2', 's1'], rest: 495, points: 5 })[0].clipId).toBe('ph-low-5');
    expect(visitSequence({ labels: ['s3', 's3', 's3'], rest: 442, points: 9 })[0].clipId).toBe('ph-low-4');
    expect(visitSequence({ labels: ['s3', 's3', 'miss'], rest: 495, points: 6 })[0].clipId).toBe('ph-low-1');
  });

  it('Normaler Visit (points 10..180, kein Moment) => LEERES Array', () => {
    expect(visitSequence({ labels: ['s20', 's19', 's18'], rest: 444, points: 57 })).toEqual([]);
    expect(visitSequence({ labels: ['s20', 's20', 's20'], rest: 441, points: 60 })).toEqual([]);
    expect(visitSequence({ labels: ['t19', 's20', 's5'], rest: 417, points: 82 })).toEqual([]);
    expect(visitSequence({ labels: ['s10', 'miss', 'miss'], rest: 491, points: 10 })).toEqual([]);
  });

  it('KEIN rest-, sc-, visit-, co-Clip; 2. Funktionsargument wird ignoriert', () => {
    const seq = visitSequence({ labels: ['s20', 's20'], rest: 40, points: 40 }, 'dx-D20-match');
    expect(seq).toEqual([]);
    expect(visitSequence({ labels: ['t20', 't15'], rest: 96, points: 45 }, 'co-96')).toEqual([]);
    for (const s of [
      ...visitSequence({ labels: ['s1', 's5', 's20'], rest: 475, points: 26 }),
      ...visitSequence({ labels: ['t20'], rest: 501, bust: true, points: 0 })
    ]) {
      expect(s.clipId).not.toMatch(/^(rest-|sc-|visit-|co-)/);
    }
  });

  it('Game-Shot-Sequenz: gameshot-high, ph-leg-a-b, applause (ohne matchOver)', () => {
    const seq = endSequence({ matchOver: false, legsWonMe: 1, legsWonOpp: 0, applause: true });
    expect(ids(seq)).toEqual(['ph-gameshot-high', 'ph-leg-1-0', 'applause']);
    expect(seq[2].gapBeforeMs).toBe(GAP_APPLAUSE);
    expect(seq[2].volume).toBeCloseTo(0.4);
    expect(seq[2].playMs).toBe(4000);
  });

  it('Match-Ende: gameshot-high, ph-match, laengerer Applaus; Applaus aus => kein applause', () => {
    const seq = endSequence({ matchOver: true, applause: true });
    expect(ids(seq)).toEqual(['ph-gameshot-high', 'ph-match', 'applause']);
    expect(seq[2].playMs).toBe(5000);
    expect(endSequence({ matchOver: false, applause: false }).some(s => s.clipId === 'applause')).toBe(false);
  });
});
