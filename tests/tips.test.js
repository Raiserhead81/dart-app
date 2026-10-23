import { describe, it, expect } from 'vitest';
import { tipsFor } from '../src/tips.js';
import { TRAINING_TYPES } from '../src/training.js';

// KAY-BEFUND: zwei Schwaechen bekamen IDENTISCHEN Tipp/Drill — jetzt je Schwaeche eigener Drill.
describe('Trainings-Tipps: keine Duplikate mehr', () => {
  const analysis = {
    weaknesses: [
      { key: 'scoring', title: 'Average 38', severity: 6 },
      { key: 't20', title: 'T20-Quote 9%', severity: 7 },
      { key: 'doubles', title: 'Doppel-Quote 18%', severity: 7 }
    ],
    strengths: [], dataQuality: { darts: 200, enough: true }
  };

  it('jede Schwaech-Gruppe bekommt einen VERSCHIEDENEN Drill', () => {
    const tips = tipsFor(analysis);
    expect(tips.length).toBe(3);
    const trainings = tips.map(t => t.training);
    expect(new Set(trainings).size).toBe(trainings.length);
    expect(tips.find(t => t.key === 't20').training).toBe('shanghai'); // Triple-Wechsel-Drill
    expect(tips.find(t => t.key === 'scoring').training).toBe('t20');  // Scoring-Drill
    expect(tips.find(t => t.key === 'doubles').training).toBe('doublesAtc');
    for (const t of tips) expect(TRAINING_TYPES[t.training]).toBeTruthy();
  });

  it('t20-Schwaech-Drill spricht Triple-Wechsel + 140+ an', () => {
    const tips = tipsFor(analysis);
    const t = tips.find(x => x.key === 't20');
    expect(t.title).toBe('Triple-Wechsel-Drill');
    expect(/Shanghai|T19|140/.test(t.text)).toBe(true);
  });

  it('Dedup-Ersatz greift, wenn zwei Schwaechen aufs gleiche Training laufen wuerden', () => {
    const a2 = { weaknesses: [{ key: 'scoring', title: 'Avg 35', severity: 6 }, { key: 't20', title: 'T20 8%', severity: 6 }], strengths: [], dataQuality: { darts: 120, enough: true } };
    const tips = tipsFor(a2);
    expect(tips[0].training).not.toBe(tips[1].training);
  });
});
