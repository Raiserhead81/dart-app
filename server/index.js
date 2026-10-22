// DartPro API: Auth (bcrypt+Token), Freundesnetzwerk, Online-Matches (Polling), Cloud-Sync.
// Multi-Tenant-Regel: Jede Abfrage ist per user_id gescoped. Kein SSO in v1.

import express from 'express';
import { openDb } from './db.js';
import { hashPassword, checkPassword, newToken, newFriendCode } from './auth.js';
import { newX01, applyDart } from '../src/x01.js';
import { buildX01GameRecord } from '../src/result.js';
import { makeThrow } from '../src/segments.js';

const PORT = process.env.PORT || 3121;
const db = openDb();
const app = express();
app.use(express.json({ limit: '2mb' }));

// ---------- Rate-Limit (einfach, in-memory) ----------
const buckets = new Map();
function rateLimit(limit, windowMs, keyFn = req => req.ip) {
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const b = buckets.get(key) || { count: 0, reset: now + windowMs };
    if (now > b.reset) { b.count = 0; b.reset = now + windowMs; }
    b.count++;
    buckets.set(key, b);
    if (b.count > limit) return res.status(429).json({ error: 'Zu viele Anfragen – kurz warten' });
    next();
  };
}
// alte Buckets gelegentlich vergessen
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 120000).unref();

const authLimit = rateLimit(12, 60000);
const apiLimit = rateLimit(240, 60000);

// ---------- Auth-Middleware ----------
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Nicht eingeloggt' });
  const row = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.name, u.friend_code
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token);
  if (!row || row.expires_at < new Date().toISOString()) return res.status(401).json({ error: 'Session abgelaufen' });
  req.user = { id: row.id, name: row.name, friendCode: row.friend_code };
  next();
}

const pub = u => ({ userId: u.id, name: u.name, friendCode: u.friend_code });

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'dartpro-api', time: new Date().toISOString() });
});

// ---------- Auth ----------
app.post('/api/auth/register', authLimit, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const password = String(req.body?.password || '');
  if (!/^[a-zA-Z0-9 _.\-]{2,24}$/.test(name)) return res.status(400).json({ error: 'Name: 2-24 Zeichen (Buchstaben, Zahlen, _ - .)' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort: mindestens 8 Zeichen' });
  if (db.prepare('SELECT 1 FROM users WHERE name = ?').get(name)) return res.status(409).json({ error: 'Name vergeben' });
  const code = newFriendCode(db);
  const info = db.prepare('INSERT INTO users (name, pass_hash, friend_code, created_at) VALUES (?,?,?,?)')
    .run(name, hashPassword(password), code, new Date().toISOString());
  const token = newToken();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(token, info.lastInsertRowid, new Date().toISOString(), new Date(Date.now() + 180 * 864e5).toISOString());
  res.json({ token, userId: info.lastInsertRowid, name, friendCode: code });
});

app.post('/api/auth/login', authLimit, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const u = db.prepare('SELECT * FROM users WHERE name = ?').get(name);
  if (!u || !checkPassword(req.body?.password, u.pass_hash)) return res.status(401).json({ error: 'Name oder Passwort falsch' });
  const token = newToken();
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?,?,?,?)')
    .run(token, u.id, new Date().toISOString(), new Date(Date.now() + 180 * 864e5).toISOString());
  res.json({ token, userId: u.id, name: u.name, friendCode: u.friend_code });
});

app.get('/api/auth/me', auth, (req, res) => res.json(pub(req.user)));

// ---------- Freunde ----------
app.get('/api/friends', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT u.id, u.name FROM friendships f JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? ORDER BY u.name
  `).all(req.user.id);
  res.json(rows.map(r => ({ userId: r.id, name: r.name })));
});

app.post('/api/friends', auth, apiLimit, (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: 'Freundescode: 6 Ziffern' });
  const target = db.prepare('SELECT id FROM users WHERE friend_code = ?').get(code);
  if (!target) return res.status(404).json({ error: 'Kein Konto mit diesem Code' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'Das bist du selbst' });
  const dup = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(req.user.id, target.id);
  if (dup) return res.status(409).json({ error: 'Schon in deiner Liste' });
  db.prepare('INSERT INTO friendships (user_id, friend_id, created_at) VALUES (?,?,?)').run(req.user.id, target.id, new Date().toISOString());
  // gegenläufig automatisch mit (beidseitige Freundschaft)
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?,?,?)').run(target.id, req.user.id, new Date().toISOString());
  res.json({ ok: true, friend: { userId: target.id } });
});

app.delete('/api/friends/:userId', auth, (req, res) => {
  db.prepare('DELETE FROM friendships WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)')
    .run(req.user.id, req.params.userId, req.params.userId, req.user.id);
  res.json({ ok: true });
});

// ---------- Rangliste (ich + Freunde) ----------
app.get('/api/ranking', auth, (req, res) => {
  const ids = [req.user.id, ...db.prepare('SELECT friend_id id FROM friendships WHERE user_id=?').all(req.user.id).map(r => r.id)];
  const out = [];
  for (const id of ids) {
    const u = db.prepare('SELECT id, name FROM users WHERE id=?').get(id);
    if (!u) continue;
    const games = db.prepare('SELECT game FROM synced_games WHERE owner_id=?').all(id)
      .map(r => JSON.parse(r.game)).filter(g => g.kind === 'x01');
    let points = 0, darts = 0, coH = 0, coA = 0, wins = 0, max180 = 0, legs = 0, legsWon = 0;
    for (const g of games) {
      const r = (g.results || []).find(x => x.player === u.name);
      if (!r) continue;
      points += r.points || 0; darts += r.darts || 0;
      coH += r.checkouts?.hits || 0; coA += r.checkouts?.attempts || 0;
      legsWon += r.legsWon || 0; legs += r.legsPlayed || 0;
      if (r.won) wins++;
      max180 = Math.max(max180, r.counts?.c180 || 0);
    }
    out.push({
      userId: u.id, name: u.name,
      avg3: darts > 0 ? Math.round(points / darts * 3 * 10) / 10 : null,
      checkoutPct: coA > 0 ? Math.round(coH / coA * 100) : null,
      max180, wins, legs, legsWon
    });
  }
  out.sort((a, b) => (b.avg3 ?? -1) - (a.avg3 ?? -1));
  res.json(out);
});

// ---------- Online-Matches ----------
function matchView(m, viewerId) {
  const state = JSON.parse(m.state);
  const isOwner = m.owner_id === viewerId;
  const oppId = isOwner ? m.guest_id : m.owner_id;
  const opp = db.prepare('SELECT name FROM users WHERE id=?').get(oppId);
  const legsWonOpp = isOwner ? state.legsWon[1] : state.legsWon[0];
  const legsWonMe = isOwner ? state.legsWon[0] : state.legsWon[1];
  return {
    matchId: m.id,
    status: m.status,
    opponentName: opp?.name || '?',
    start: state.start,
    firstTo: state.firstTo,
    myTurn: m.status === 'active' && state.current === (isOwner ? 0 : 1),
    myIndex: isOwner ? 0 : 1,
    legsWonMe, legsWonOpp,
    winnerId: m.winner_id,
    state,
    updatedAt: m.updated_at
  };
}

app.post('/api/matches', auth, apiLimit, (req, res) => {
  const friendId = Number(req.body?.friendId);
  const cfg = req.body?.config || {};
  const f = db.prepare('SELECT 1 FROM friendships WHERE user_id=? AND friend_id=?').get(req.user.id, friendId);
  if (!f) return res.status(403).json({ error: 'Nicht in deiner Freundesliste' });
  const start = [101, 170, 301, 501, 701, 1001].includes(cfg.start) ? cfg.start : 501;
  const state = newX01({
    start,
    players: [req.user.name, (db.prepare('SELECT name FROM users WHERE id=?').get(friendId) || {}).name || 'Gegner'],
    doubleOut: cfg.doubleOut !== false,
    doubleIn: cfg.doubleIn === true,
    firstTo: Math.min(7, Math.max(1, cfg.firstTo || 3))
  });
  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const now = new Date().toISOString();
  db.prepare('INSERT INTO matches (id, owner_id, guest_id, config, state, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, req.user.id, friendId, JSON.stringify({ start, doubleOut: state.doubleOut, firstTo: state.firstTo }), JSON.stringify(state), 'active', now, now);
  const m = db.prepare('SELECT * FROM matches WHERE id=?').get(id);
  res.json(matchView(m, req.user.id));
});

app.get('/api/matches', auth, (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM matches WHERE owner_id=? OR guest_id=? ORDER BY updated_at DESC LIMIT 50
  `).all(req.user.id, req.user.id);
  res.json(rows.map(m => matchView(m, req.user.id)));
});

app.get('/api/matches/:id', auth, (req, res) => {
  const m = db.prepare('SELECT * FROM matches WHERE id=?').get(req.params.id);
  if (!m || (m.owner_id !== req.user.id && m.guest_id !== req.user.id)) return res.status(404).json({ error: 'Match nicht gefunden' });
  res.json(matchView(m, req.user.id));
});

app.post('/api/matches/:id/throws', auth, apiLimit, (req, res) => {
  const m = db.prepare('SELECT * FROM matches WHERE id=?').get(req.params.id);
  if (!m || (m.owner_id !== req.user.id && m.guest_id !== req.user.id)) return res.status(404).json({ error: 'Match nicht gefunden' });
  if (m.status !== 'active') return res.status(409).json({ error: 'Match beendet' });
  const state = JSON.parse(m.state);
  const isOwner = m.owner_id === req.user.id;
  const myIdx = isOwner ? 0 : 1;
  if (state.current !== myIdx) return res.status(409).json({ error: 'Du bist nicht am Zug' });
  const d = req.body?.dart || {};
  const thr = d.k ? d : makeThrow('miss', 0);
  const ev = applyDart(state, thr);
  const now = new Date().toISOString();
  let winnerId = null;
  if (state.finished) {
    const winnerIdx = state.winner;
    winnerId = winnerIdx === 0 ? m.owner_id : m.guest_id;
    db.prepare('UPDATE matches SET state=?, status=?, winner_id=?, updated_at=? WHERE id=?')
      .run(JSON.stringify(state), 'finished', winnerId, now, m.id);
    // Game-Record fuer beide als synced game ablegen
    try {
      const rec = buildX01GameRecord(state, { id: 'onl-' + m.id, date: state.createdAt, online: true });
      for (const uid of [m.owner_id, m.guest_id]) {
        db.prepare(`
          INSERT INTO synced_games (id, owner_id, game, date, created_at, updated_at)
          VALUES (?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET game=excluded.game, updated_at=excluded.updated_at
        `).run(rec.id + ':' + uid, uid, JSON.stringify(rec), rec.date, now, now);
      }
    } catch (e) { console.error('record failed', e); }
  } else {
    db.prepare('UPDATE matches SET state=?, updated_at=? WHERE id=?').run(JSON.stringify(state), now, m.id);
  }
  const m2 = db.prepare('SELECT * FROM matches WHERE id=?').get(m.id);
  res.json({ ...matchView(m2, req.user.id), event: { type: ev.type, message: ev.message } });
});

// ---------- Cloud-Sync ----------
app.post('/api/sync/games', auth, apiLimit, (req, res) => {
  const games = Array.isArray(req.body?.games) ? req.body.games.slice(0, 500) : [];
  const now = new Date().toISOString();
  let saved = 0;
  const ins = db.prepare(`
    INSERT INTO synced_games (id, owner_id, game, date, created_at, updated_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET game=excluded.game, updated_at=excluded.updated_at
  `);
  for (const g of games) {
    if (!g || !g.id || !g.kind) continue;
    ins.run(String(g.id).slice(0, 64), req.user.id, JSON.stringify(g), g.date || now, now, now);
    saved++;
  }
  res.json({ ok: true, saved });
});

app.get('/api/sync/games', auth, (req, res) => {
  const since = String(req.query.since || '');
  const rows = since
    ? db.prepare('SELECT game FROM synced_games WHERE owner_id=? AND updated_at > ? ORDER BY updated_at LIMIT 500').all(req.user.id, since)
    : db.prepare('SELECT game FROM synced_games WHERE owner_id=? ORDER BY date LIMIT 1000').all(req.user.id);
  res.json({ games: rows.map(r => JSON.parse(r.game)), now: new Date().toISOString() });
});

// ---------- Errors ----------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Serverfehler' });
});

if (process.env.DART_NO_LISTEN !== '1') {
  app.listen(PORT, '127.0.0.1', () => console.log(`dartpro-api on 127.0.0.1:${PORT}`));
}

export { app, db };
