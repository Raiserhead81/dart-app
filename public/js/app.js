// DartPro App-Kern: State, Router, Boot.

import { load, persist } from '/js/core/storage.js';
import { configureCaller } from '/js/caller-voice.js';
import { startUpdateWatcher } from '/js/update.js';
import { renderPlay } from '/js/views/play.js';
import { renderOnlineMatch } from '/js/views/onlinematch.js';
import { renderTraining } from '/js/views/training.js';
import { renderStats } from '/js/views/stats.js';
import { renderProfile } from '/js/views/profile.js';
import { renderOnline } from '/js/views/online.js';

export const store = {
  state: load(),
  save() {
    persist(this.state);
    if (this.state.settings?.caller) configureCaller(this.state.settings.caller);
  }
};
window.__DARTPRO = store; // Debug/E2E-Hook

export function activePlayer() {
  return store.state.activeProfile || store.state.profiles[0]?.name || 'Spieler 1';
}

const routes = {
  play: renderPlay,
  training: renderTraining,
  stats: renderStats,
  online: renderOnline,
  profile: renderProfile,
  match: renderOnlineMatch
};

function currentRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, ...rest] = h.split('/');
  return { name: routes[name] ? name : 'play', arg: rest.join('/') };
}

export function navigate(hash) { location.hash = hash; }

let renderSeq = 0;
export function rerender() {
  const seq = ++renderSeq;
  const { name, arg } = currentRoute();
  const view = document.getElementById('view');
  view.innerHTML = '';
  document.querySelectorAll('.rail a[data-nav]').forEach(a => {
    a.classList.toggle('active', a.dataset.nav === name);
  });
  const render = routes[name];
  Promise.resolve(render(view, arg)).catch(err => {
    view.innerHTML = '';
    view.append(Object.assign(document.createElement('div'), {
      className: 'panel', textContent: 'Fehler beim Rendern: ' + err.message
    }));
    console.error(err);
  });
  window.scrollTo({ top: 0 });
}

// Boot-Hint entfernen, sobald die App das erste Mal gerendert hat
rerender();
const bootHint = document.getElementById('boot-hint');
if (bootHint) bootHint.remove();
const bootCss = document.getElementById('bootcss');
if (bootCss) bootCss.remove();

window.addEventListener('hashchange', rerender);

// Speichern bei Verlassen warnen, solange ein Spiel laeuft (verhindert versehentliches Swipe-Close)
window.addEventListener('beforeunload', (e) => {
  if (window.__DARTPRO_SESSION_ACTIVE) { e.preventDefault(); e.returnValue = ''; }
});

configureCaller(store.state.settings?.caller || {});
startUpdateWatcher(60000);
rerender();
