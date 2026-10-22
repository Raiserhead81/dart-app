// Cloud-Sync: lokale Games (per UUID) hochladen, fremde/neue runterladen, merge.

import { api, getAuth } from '/js/api.js';
import { store } from '/js/app.js';

export async function syncNow() {
  const auth = getAuth();
  if (!auth?.token) return { ok: false, error: 'nicht eingeloggt' };
  try {
    const mine = store.state.games.filter(g => g.id);
    const pushed = await api.syncPush(mine);
    const since = store.state.lastSyncAt || '';
    const pulled = await api.syncPull(since);
    const byId = new Map(store.state.games.map(g => [g.id, g]));
    let downloaded = 0;
    for (const g of pulled.games || []) {
      if (!byId.has(g.id)) { byId.set(g.id, g); downloaded++; }
    }
    store.state.games = [...byId.values()].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    store.state.lastSyncAt = new Date().toISOString();
    store.save();
    return { ok: true, uploaded: pushed.saved ?? 0, downloaded };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
