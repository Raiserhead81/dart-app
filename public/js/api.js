// API-Client: Bearer-Token (localStorage), alle Endpunkte same-origin unter /api/.

const TOKEN_KEY = 'dartpro.token';

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
}
export function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) { /* egal */ }
}
export function getAuth() {
  const s = window.__DARTPRO?.state?.auth;
  if (s?.token) return s;
  const t = getToken();
  return t ? { token: t } : null;
}

async function req(path, opts = {}) {
  const token = getToken();
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

export const api = {
  register: (name, password) => req('/auth/register', { method: 'POST', body: { name, password } }),
  login: (name, password) => req('/auth/login', { method: 'POST', body: { name, password } }),
  me: () => req('/auth/me'),
  friends: () => req('/friends'),
  addFriend: (code) => req('/friends', { method: 'POST', body: { code } }),
  removeFriend: (userId) => req('/friends/' + userId, { method: 'DELETE' }),
  ranking: () => req('/ranking'),
  createMatch: (friendId, config) => req('/matches', { method: 'POST', body: { friendId, config } }),
  matches: () => req('/matches'),
  getMatch: (id) => req('/matches/' + id),
  throwDart: (id, dart) => req(`/matches/${id}/throws`, { method: 'POST', body: { dart } }),
  syncPush: (games) => req('/sync/games', { method: 'POST', body: { games } }),
  syncPull: (since) => req('/sync/games?since=' + encodeURIComponent(since || ''))
};
