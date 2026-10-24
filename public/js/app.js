// DartPro App-Kern: State, Router, Boot.

import { load, persist } from '/js/core/storage.js';
import { configureCaller } from '/js/caller-voice.js';
import { startUpdateWatcher } from '/js/update.js';
import { renderPlay } from '/js/views/play.js';
import { renderOnlineMatch } from '/js/views/onlinematch.js';
import { renderTraining } from '/js/views/training.js';
import { renderStats } from '/js/views/stats.js';
import { renderLegal } from '/js/views/legal.js';
import { renderCamera } from '/js/views/camera.js';
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
  match: renderOnlineMatch,
  legal: renderLegal,
  camera: renderCamera
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
  }).then(() => requestAnimationFrame(fitGameScreen));
  window.scrollTo({ top: 0 });
}

// KAY: Spielscreen OHNE Scrollen — skaliert den ganzen Spiel-Inhalt so, dass er in den
// Viewport passt (Bottom-Rail bleibt drausen). Wirkt nur, wenn der Inhalt zu hoch ist.
function fitGameScreen() {
  const g = document.querySelector('.view-game');
  if (!g) return;
  g.style.transform = '';
  const rail = document.querySelector('.rail');
  const railFixed = rail && getComputedStyle(rail).position !== 'sticky';
  const avail = window.innerHeight - (railFixed ? rail.offsetHeight : 0) - 8;
  const padBottom = parseFloat(getComputedStyle(g).paddingBottom) || 0;
  // padBottom ist nur auf Mobile Rail-Freiraum — auf Desktop (Rail links) volle Höhe zaehlen
  const need = g.scrollHeight - (railFixed ? padBottom : 0);
  if (need <= 0 || avail <= 0) return;
  const f = Math.min(1, avail / need, (window.innerWidth - 8) / Math.max(1, g.scrollWidth));
  if (f < 0.99) {
    g.style.transformOrigin = 'top center';
    g.style.transform = `scale(${Math.max(0.4, Math.round(f * 1000) / 1000)})`;
    g.style.minHeight = '0';
    // KAY-FIX: Hoehe beschneiden clippt die letzte Reihe (BULL) trotz Scale —
    // negativer Margin verkuerzt das Layout OHNE Clip: alles sichtbar, kein Scroll.
    g.style.marginBottom = `-${Math.round(need * (1 - f))}px`;
  }
}
window.addEventListener('resize', fitGameScreen);
window.addEventListener('orientationchange', fitGameScreen);

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
// Stim-Migration: unvollstaendiges Set im Storage -> einmalig auf elevenlabs-brian
import('/js/caller-voice.js').then(async m => {
  await m.loadCallerManifest();
  if (store.state.settings?.caller?.voiceSet && !m.isVoiceSetComplete(store.state.settings.caller.voiceSet)) {
    store.state.settings.caller.voiceSet = 'elevenlabs-brian';
    store.state.settings.caller.voiceMigrated = true;
    persist(store.state);
    configureCaller(store.state.settings.caller);
    rerender();
  }
  // KAY: Warmup erst nach dem Boot starten (frisst sonst die Bandbreite des App-Ladens)
  setTimeout(() => m.warmClipCache(6), 8000);
});

// KAY-NEU: "Als App installieren" — Install-Prompt global fangen (Android/Chrome).
window.__installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installEvt = e; rerender(); });
window.addEventListener('appinstalled', () => { window.__installEvt = null; store.state.settings.installed = true; store.save(); rerender(); });

// KAY: App GLOBAL im Vollbild — erste User-Geste geht in den Fullscreen (Browser
// verlangt eine Geste dafuer). Einmalig, drueckt Kay Esc, bleibt es aus. iOS-PWA:
// kein requestFullscreen, laeuft eh standalone (Manifest display:fullscreen fuer Android).
document.addEventListener('pointerdown', function fsOnce() {
  if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  }
}, { once: true, capture: true });
startUpdateWatcher(60000);
rerender();
