// Netzwerk: Login/Register, Freundescode, Freunde, Online-Match, Cloud-Sync.
// (Wird mit dem API-Layer befüllt; diese Datei enthaelt die komplette UI.)

import { el, icon, toast } from '/js/util.js';
import { store, rerender } from '/js/app.js';
import { api, setToken, getAuth } from '/js/api.js';
import { syncNow } from '/js/sync.js';

export function renderOnline(view) {
  const auth = getAuth();
  view.innerHTML = '';
  view.append(el('p', { class: 'kicker' }, 'Netzwerk'),
    el('h1', { class: 'serif', style: 'margin:0 0 14px;font-size:30px' }, 'Freunde & Online-Match'));

  if (!auth) return renderAuth(view);

  view.append(el('div', { class: 'panel' },
    el('div', { class: 'row', style: 'justify-content:space-between' },
      el('div', {},
        el('div', { style: 'font-weight:800;font-size:20px' }, auth.name),
        el('div', { class: 'sub muted' }, 'Dein Freundescode'),
        el('div', { class: 'num', style: 'font-size:34px;font-weight:800;color:#e8dfc8;letter-spacing:.12em' }, auth.friendCode)
      ),
      el('div', { class: 'row' },
        el('button', {
          class: 'btn small', onclick: () => {
            navigator.clipboard?.writeText(auth.friendCode).then(() => toast('Freundescode kopiert'), () => toast(auth.friendCode));
          }
        }, 'Code kopieren'),
        el('button', {
          class: 'btn small danger', onclick: async () => {
            setToken(null);
            store.state.auth = null;
            store.save();
            rerender();
          }
        }, 'Abmelden')
      )
    ),
    el('div', { class: 'small muted mt' }, `Cloud-Sync: ${store.state.lastSyncAt ? new Date(store.state.lastSyncAt).toLocaleString('de-DE') : 'noch nicht synchronisiert'}`),
    el('div', { class: 'row mt' },
      el('button', { class: 'btn small', onclick: async () => { toast('Sync läuft…'); const r = await syncNow(); toast(r.ok ? `Sync ok: ${r.uploaded} hoch, ${r.downloaded} runter` : 'Sync fehlgeschlagen: ' + (r.error || '')); rerender(); } }, 'Jetzt synchronisieren')
    )
  ));

  renderFriends(view);
  renderMatches(view);
}

function renderAuth(view) {
  const mode = { value: 'login' };
  const name = el('input', { type: 'text', placeholder: 'Spielername', maxlength: 24, autocomplete: 'username' });
  const pass = el('input', { type: 'password', placeholder: 'Passwort (min. 8 Zeichen)', autocomplete: 'current-password' });
  const submit = el('button', {
    class: 'btn primary wide', onclick: async () => {
      try {
        const fn = mode.value === 'login' ? api.login : api.register;
        const res = await fn(name.value.trim(), pass.value);
        setToken(res.token);
        store.state.auth = { token: res.token, name: res.name, friendCode: res.friendCode, userId: res.userId };
        // Profil anlegen/verknuepfen
        const { addProfile } = await import('/js/core/storage.js');
        if (!store.state.profiles.some(p => p.name === res.name)) addProfile(store.state, res.name);
        store.state.activeProfile = res.name;
        store.save();
        toast(mode.value === 'login' ? 'Willkommen zurück!' : `Konto erstellt · Freundescode ${res.friendCode}`);
        rerender();
      } catch (e) {
        toast(e.message || 'Fehler');
      }
    }
  }, 'Einloggen');
  const switchBtn = el('button', {
    class: 'btn ghost small', onclick: () => {
      mode.value = mode.value === 'login' ? 'register' : 'login';
      submit.textContent = mode.value === 'login' ? 'Einloggen' : 'Konto erstellen';
      switchBtn.textContent = mode.value === 'login' ? 'Neu hier? Konto erstellen' : 'Schon Konto? Einloggen';
    }
  }, 'Neu hier? Konto erstellen');

  view.append(el('div', { class: 'panel', style: 'max-width:460px' },
    el('h2', {}, 'Konto'),
    el('p', { class: 'small muted' }, 'Für Online-Matches, Freundes-Rangliste und geräteübergreifende Statistik. Offline-Spiele bleiben immer lokal gespeichert.'),
    el('label', { class: 'field' }, el('span', {}, 'Name'), name),
    el('label', { class: 'field' }, el('span', {}, 'Passwort'), pass),
    submit, el('div', { class: 'center mt' }, switchBtn)
  ));
}

async function renderFriends(view) {
  const panel = el('div', { class: 'panel' }, el('h2', {}, 'Freunde'));
  view.append(panel);
  const codeInput = el('input', { type: 'text', placeholder: 'Freundescode (6 Ziffern)', inputmode: 'numeric', maxlength: 6, style: 'max-width:220px' });
  const list = el('div', { class: 'list' });
  panel.append(
    el('div', { class: 'row' },
      codeInput,
      el('button', {
        class: 'btn', onclick: async () => {
          try {
            await api.addFriend(codeInput.value.trim());
            codeInput.value = '';
            toast('Freund hinzugefügt');
            rerender();
          } catch (e) { toast(e.message || 'Fehler'); }
        }
      }, icon('i-plus'), 'Hinzufügen')
    ),
    list
  );
  try {
    const friends = await api.friends();
    const rank = await api.ranking();
    const byId = new Map(rank.map(r => [r.userId, r]));
    if (!friends.length) {
      list.append(el('p', { class: 'muted' }, 'Noch keine Freunde – teile deinen Freundescode oder füge einen Code hinzu.'));
    }
    for (const f of friends) {
      const r = byId.get(f.userId);
      list.append(el('div', { class: 'listitem' },
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, f.name),
          el('div', { class: 'sub num' }, r ? `Avg ${r.avg3 ?? '-'} · Checkout ${r.checkoutPct ?? '-'}% · 180er ${r.max180}` : 'keine Stats synchronisiert')),
        el('button', {
          class: 'btn small primary', onclick: async () => {
            try {
              const m = await api.createMatch(f.userId, { start: 501, doubleOut: true, firstTo: 3 });
              location.hash = '#/match/' + m.matchId;
              rerender();
            } catch (e) { toast(e.message || 'Fehler'); }
          }
        }, 'Match anbieten'),
        el('button', {
          class: 'btn small danger', onclick: async () => {
            if (!confirm(`${f.name} entfernen?`)) return;
            await api.removeFriend(f.userId);
            rerender();
          }
        }, 'X')
      ));
    }
    // Rangliste
    if (rank.length) {
      const tbl = el('table', { class: 'rank-table mt' },
        el('thead', {}, el('tr', {}, el('th', {}, '#'), el('th', {}, 'Spieler'), el('th', {}, 'Avg'), el('th', {}, 'Checkout'), el('th', {}, '180er'), el('th', {}, 'Siege'))),
        el('tbody', {}, ...rank.map((r, i) => el('tr', {},
          el('td', {}, String(i + 1)),
          el('td', {}, r.name + (r.userId === getAuth()?.userId ? ' (du)' : '')),
          el('td', {}, r.avg3 != null ? String(r.avg3).replace('.', ',') : '-'),
          el('td', {}, r.checkoutPct != null ? r.checkoutPct + '%' : '-'),
          el('td', {}, String(r.max180 ?? 0)),
          el('td', {}, String(r.wins ?? 0))
        )))
      );
      panel.append(el('h2', { class: 'mt' }, 'Rangliste'), tbl);
    }
  } catch (e) {
    list.append(el('p', { class: 'muted small' }, 'Netzwerk nicht erreichbar: ' + (e.message || '')));
  }
}

async function renderMatches(view) {
  const panel = el('div', { class: 'panel' }, el('h2', {}, 'Online-Matches'));
  view.append(panel);
  try {
    const matches = await api.matches();
    if (!matches.length) {
      panel.append(el('p', { class: 'muted' }, 'Keine laufenden Matches. Biete einem Freund eins an.'));
      return;
    }
    for (const m of matches) {
      const opp = m.opponentName;
      panel.append(el('div', { class: 'listitem' },
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, `gegen ${opp}`),
          el('div', { class: 'sub num' }, `${m.start} DO · ${m.legsWonMe}:${m.legsWonOpp} · ${m.status === 'active' ? 'läuft – du bist ' + (m.myTurn ? 'am Zug' : 'nicht am Zug') : m.status}`)),
        m.status === 'active' ? el('button', {
          class: 'btn small primary', onclick: () => {
            location.hash = '#/match/' + m.matchId;
            rerender();
          }
        }, 'Öffnen') : el('span', { class: 'chip small' }, m.status === 'finished' ? 'beendet' : m.status)
      ));
    }
  } catch (e) {
    panel.append(el('p', { class: 'muted small' }, 'Nicht erreichbar: ' + (e.message || '')));
  }
}
