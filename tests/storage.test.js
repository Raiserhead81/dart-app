import { describe, it, expect } from 'vitest';
import { load, persist, addProfile, setActiveProfile, addGame, exportJSON, importJSON, migrate, defaultState, MAX_PROFILES } from '../src/storage.js';

function memStorage() {
  const m = new Map();
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k)
  };
}

describe('storage', () => {
  it('persist + load roundtrip', () => {
    const s = memStorage();
    const state = defaultState();
    addProfile(state, 'Kay');
    addGame(state, { id: 'g1', kind: 'x01', date: '2026-10-22T10:00:00Z', results: [{ player: 'Kay' }] });
    persist(state, s);
    const loaded = load(s);
    expect(loaded.profiles[0].name).toBe('Kay');
    expect(loaded.games.length).toBe(1);
    expect(loaded.schema).toBe(1);
  });

  it('max 4 Profile', () => {
    const state = defaultState();
    for (const n of ['A', 'B', 'C', 'D']) expect(addProfile(state, n).ok).toBe(true);
    expect(addProfile(state, 'E').ok).toBe(false);
    expect(addProfile(state, 'A').ok).toBe(false);
    expect(state.profiles.length).toBe(MAX_PROFILES);
  });

  it('import merged Games per ID ohne Duplikate', () => {
    const cur = defaultState();
    addGame(cur, { id: 'g1', date: '2026-10-01', results: [{ player: 'A' }] });
    const exported = exportJSON(cur);
    const other = JSON.parse(exported);
    other.data.games.push({ id: 'g2', date: '2026-10-02', results: [{ player: 'B' }] });
    other.data.games.push({ id: 'g1', date: '2026-10-01', results: [{ player: 'A', hacked: true }] });
    const res = importJSON(JSON.stringify(other), cur);
    expect(res.ok).toBe(true);
    expect(res.added).toBe(1);
    expect(cur.games.length).toBe(2);
    expect(cur.games[0].id).toBe('g1');
  });

  it('fremdes JSON wird abgelehnt', () => {
    const cur = defaultState();
    expect(importJSON('{"foo":1}', cur).ok).toBe(false);
    expect(importJSON('kein json', cur).ok).toBe(false);
  });

  it('migrate ergaenzt fehlende Felder', () => {
    const m = migrate({ games: [{ id: 'x' }] });
    expect(m.profiles).toEqual([]);
    expect(m.schema).toBe(1);
    expect(m.settings.theme).toBe('dark');
  });
});
