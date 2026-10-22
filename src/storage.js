// Persistenz: localStorage, Schema versioniert, Export/Import, Profile (max 4).
// storage ist injizierbar (Tests ohne Browser).

const SCHEMA = 1;
export const MAX_PROFILES = 4;
const KEY = 'dartpro.v1';

export function defaultState() {
  return {
    schema: SCHEMA,
    profiles: [],          // { name, createdAt, friendCode?, accountId? }
    activeProfile: null,   // Name
    games: [],             // Game-Records (x01/training/online)
    settings: { theme: 'dark', lastMode: 'x01' },
    auth: null             // { token, name, friendCode, userId }
  };
}

export function load(save = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!save) return defaultState();
  try {
    const raw = save.getItem(KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return defaultState();
    return migrate(data);
  } catch (e) {
    return defaultState();
  }
}

export function persist(state, save = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!save) return;
  state.schema = SCHEMA;
  save.setItem(KEY, JSON.stringify(state));
}

export function migrate(data) {
  // Schema-Felder ergaenzen (additiv, niemals Daten wegwerfen)
  const d = defaultState();
  const out = { ...d, ...data };
  out.schema = SCHEMA;
  if (!Array.isArray(out.games)) out.games = [];
  if (!Array.isArray(out.profiles)) out.profiles = [];
  return out;
}

export function addProfile(state, name) {
  name = String(name || '').trim().slice(0, 24);
  if (!name) return { ok: false, error: 'Name fehlt' };
  if (state.profiles.some(p => p.name === name)) return { ok: false, error: 'Profil existiert schon' };
  if (state.profiles.length >= MAX_PROFILES) return { ok: false, error: `Maximal ${MAX_PROFILES} Profile` };
  state.profiles.push({ name, createdAt: new Date().toISOString() });
  if (!state.activeProfile) state.activeProfile = name;
  return { ok: true };
}

export function setActiveProfile(state, name) {
  if (!state.profiles.some(p => p.name === name)) return false;
  state.activeProfile = name;
  return true;
}

export function addGame(state, game) {
  state.games.push(game);
  // Ring-Puffer begrenzen (aelteste Spiele behalten, aber Deckel gegen Speicher-Explosion)
  if (state.games.length > 2000) state.games = state.games.slice(-2000);
}

export function exportJSON(state) {
  return JSON.stringify({ app: 'DartPro', exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function importJSON(text, current) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: 'Kein gueltiges JSON' };
  }
  const data = obj && obj.data ? obj.data : obj;
  if (!data || !Array.isArray(data.games)) return { ok: false, error: 'Kein DartPro-Export (games fehlt)' };
  const migrated = migrate(data);
  // Merge: Games per ID zusammenfuehren, keine Duplikate
  const byId = new Map(current.games.map(g => [g.id, g]));
  let added = 0;
  for (const g of migrated.games) {
    if (g.id && !byId.has(g.id)) { byId.set(g.id, g); added++; }
  }
  current.games = [...byId.values()].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (const p of migrated.profiles || []) {
    if (!current.profiles.some(x => x.name === p.name)) current.profiles.push(p);
  }
  return { ok: true, added };
}

export function gamesOfPlayer(state, name) {
  return state.games.filter(g => (g.results || []).some(r => r.player === name) || g.player === name);
}
