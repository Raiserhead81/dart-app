// API-Integrationstests: In-Memory-DB, echte HTTP-Aufrufe gegen die Express-App.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from '../server/index.js';

let server, base;
const D = { k: 'double', n: 16, v: 32 };
const T20 = { k: 'triple', n: 20, v: 60 };
const S9 = { k: 'single', n: 9, v: 9 };

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(base + '/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

beforeAll(async () => {
  await new Promise(resolve => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => { await new Promise(r => server.close(r)); });

describe('health + auth', () => {
  it('health ohne Auth', async () => {
    const r = await call('/health');
    expect(r.status).toBe(200);
    expect(r.data.ok).toBe(true);
  });

  it('register + login + me', async () => {
    const reg = await call('/auth/register', { method: 'POST', body: { name: 'KayTest', password: 'langespasswort1' } });
    expect(reg.status).toBe(200);
    expect(reg.data.friendCode).toMatch(/^\d{6}$/);
    const me = await call('/auth/me', { token: reg.data.token });
    expect(me.data.name).toBe('KayTest');
    const login = await call('/auth/login', { method: 'POST', body: { name: 'KayTest', password: 'langespasswort1' } });
    expect(login.data.token).toBeTruthy();
    const bad = await call('/auth/login', { method: 'POST', body: { name: 'KayTest', password: 'falsch' } });
    expect(bad.status).toBe(401);
    const short = await call('/auth/register', { method: 'POST', body: { name: 'X2', password: 'kurz' } });
    expect(short.status).toBe(400);
  });
});

describe('Freunde + Rangliste', () => {
  let a, b, c;
  beforeAll(async () => {
    a = (await call('/auth/register', { method: 'POST', body: { name: 'Anna', password: 'langespasswort1' } })).data;
    b = (await call('/auth/register', { method: 'POST', body: { name: 'Ben', password: 'langespasswort1' } })).data;
    c = (await call('/auth/register', { method: 'POST', body: { name: 'Cem', password: 'langespasswort1' } })).data;
  });

  it('Freundschaft per Code, beidseitig', async () => {
    const add = await call('/friends', { method: 'POST', token: a.token, body: { code: b.friendCode } });
    expect(add.status).toBe(200);
    const listA = await call('/friends', { token: a.token });
    expect(listA.data.some(f => f.name === 'Ben')).toBe(true);
    const listB = await call('/friends', { token: b.token });
    expect(listB.data.some(f => f.name === 'Anna')).toBe(true);
  });

  it('Fremde Konten koennen nicht gescoped werden: C sieht weder Annas noch Bens Matches', async () => {
    const m = await call('/matches', { method: 'POST', token: a.token, body: { friendId: b.userId, config: { start: 101, firstTo: 1 } } });
    expect(m.status).toBe(200);
    const peek = await call('/matches/' + m.data.matchId, { token: c.token });
    expect(peek.status).toBe(404);
    // C kann nicht auf B wirfen
    const thr = await call(`/matches/${m.data.matchId}/throws`, { method: 'POST', token: c.token, body: { dart: T20 } });
    expect(thr.status).toBe(404);
  });

  it('Online-Match: nur am Zug wirfen, Leg zu Ende, beide bekommen Sync-Game', async () => {
    const m = await call('/matches', { method: 'POST', token: a.token, body: { friendId: b.userId, config: { start: 101, firstTo: 1 } } });
    const id = m.data.matchId;
    // Ben (Gast, Index 1) ist NICHT am Zug
    const wrong = await call(`/matches/${id}/throws`, { method: 'POST', token: b.token, body: { dart: T20 } });
    expect(wrong.status).toBe(409);
    // Anna: T20 -> 41, dann T20 -> BUST (Turn an Ben)
    const t1 = await call(`/matches/${id}/throws`, { method: 'POST', token: a.token, body: { dart: T20 } });
    expect(t1.data.state.leg.remaining[0]).toBe(41);
    const turn = await call(`/matches/${id}/throws`, { method: 'POST', token: a.token, body: { dart: T20 } });
    expect(turn.data.event.type).toBe('bust');
    expect(turn.data.state.current).toBe(1);
    // Ben: 3x S20 -> 101-60=41, Turn zurueck an Anna
    const bThr = await call(`/matches/${id}/throws`, { method: 'POST', token: b.token, body: { dart: { k: 'single', n: 20, v: 20 } } });
    expect(bThr.status).toBe(200);
    expect(bThr.data.state.current).toBe(1);
    await call(`/matches/${id}/throws`, { method: 'POST', token: b.token, body: { dart: { k: 'single', n: 20, v: 20 } } });
    const b3 = await call(`/matches/${id}/throws`, { method: 'POST', token: b.token, body: { dart: { k: 'single', n: 20, v: 20 } } });
    expect(b3.data.state.current).toBe(0);
    expect(b3.data.state.leg.remaining[1]).toBe(41);
    // Anna (Rest 101 nach Bust): T20 (41) -> S9 (32) -> D16 -> Match
    await call(`/matches/${id}/throws`, { method: 'POST', token: a.token, body: { dart: T20 } });
    const t3 = await call(`/matches/${id}/throws`, { method: 'POST', token: a.token, body: { dart: S9 } });
    expect(t3.data.state.leg.remaining[0]).toBe(32);
    const fin = await call(`/matches/${id}/throws`, { method: 'POST', token: a.token, body: { dart: D } });
    expect(fin.data.status).toBe('finished');
    expect(fin.data.winnerId).toBe(a.userId);
    // Sync-Bezug: Anna und Ben haben je ein online-Game
    const sa = await call('/sync/games', { token: a.token });
    const sb = await call('/sync/games', { token: b.token });
    const onlineA = sa.data.games.find(g => g.id === 'onl-' + id);
    const onlineB = sb.data.games.find(g => g.id === 'onl-' + id);
    expect(onlineA?.online).toBe(true);
    expect(onlineB?.online).toBe(true);
    const resA = onlineA.results.find(r => r.player === 'Anna');
    expect(resA.won).toBe(true);
    expect(resA.darts).toBe(5);
  });

  it('Rangliste enthaelt beide mit Avg', async () => {
    const r = await call('/ranking', { token: a.token });
    expect(r.status).toBe(200);
    const anna = r.data.find(x => x.name === 'Anna');
    expect(anna?.avg3).toBeGreaterThan(0);
  });

  it('Cloud-Sync: upsert per ID, nur eigene Spiele lesbar', async () => {
    const push = await call('/sync/games', {
      method: 'POST', token: a.token,
      body: { games: [{ id: 'g-local-1', kind: 'x01', date: '2026-10-22T10:00:00Z', results: [{ player: 'Anna', points: 101, darts: 3 }] }] }
    });
    expect(push.data.saved).toBe(1);
    const pullA = await call('/sync/games', { token: a.token });
    expect(pullA.data.games.some(g => g.id === 'g-local-1')).toBe(true);
    const pullB = await call('/sync/games', { token: b.token });
    expect(pullB.data.games.some(g => g.id === 'g-local-1')).toBe(false);
  });
});
