// Profil & Einstellungen: Profile, Export/Import, Caller-Einstellungen, App-Info.

import { addProfile, setActiveProfile, exportJSON, importJSON, MAX_PROFILES } from '/js/core/storage.js';
import { el, icon, toast, download } from '/js/util.js';
import { store, rerender } from '/js/app.js';
import { configureCaller, callerSettings, unlockAudio } from '/js/caller-voice.js';
import { startManualUpdateCheck } from '/js/update-manual.js';

export function renderProfile(view) {
  const s = store.state;
  view.innerHTML = '';

  // ----- Profile -----
  const profPanel = el('div', { class: 'panel' },
    el('h2', {}, 'Profile', el('span', { class: 'sub' }, `${s.profiles.length}/${MAX_PROFILES} · Statistiken pro Spieler getrennt`)),
    el('a', { href: '#/legal', style: 'display:inline-block;margin:0 8px 10px 0;font-size:13px' }, 'Impressum & Datenschutz'),
    // ===== KAMERA-KALIBRIERUNG (direkt im Profil, wie Kay es will) =====
    (function kameraSektion() {
      const host = el('div', { class: 'panel', id: 'profilkamera' });
      const status = el('div', { class: 'small muted' }, store.state.settings.cameraCal ? '✓ kalibriert' : 'noch nicht kalibriert');
      const videoHost = el('div', { style: 'display:none;margin-top:8px;position:relative' });
      let phase = 'idle';
      const kalibBtn = el('button', { class: 'btn primary wide mt' }, '① Kalibrieren');
      const startBtn = el('button', { class: 'btn wide mt' }, 'Kamera anzeigen');
      startBtn.onclick = async () => {
        const v = el('video', { autoplay: '', playsinline: '', muted: '', style: 'width:100%;max-height:40vh;object-fit:contain;background:#000;border-radius:12px;display:block' });
        videoHost.innerHTML = '';
        videoHost.append(v);
        videoHost.style.display = '';
        kalibBtn.style.display = '';
        status.textContent = 'Kamera startet…';
        await startCam();
        v.srcObject = aktuellerStream();
        try { await v.play(); } catch (e) {}
        setTimeout(() => { status.textContent = v.videoWidth ? 'Kamera läuft' : 'Kein Bild - Kamera prüfen'; }, 1500);
        v.onclick = async (ev) => {
          if (phase === 'kalib-bull' || phase === 'kalib-rand') {
            const rect = v.getBoundingClientRect();
            const zoom = v.style.transform ? (parseFloat(v.style.transform.replace(/[^\d.]/g, '')) || 1) : 1;
            const lx = (ev.clientX - rect.left) / zoom, ly = (ev.clientY - rect.top) / zoom;
            const sc = Math.min(v.offsetWidth / (v.videoWidth || v.offsetWidth), v.offsetHeight / (v.videoHeight || v.offsetHeight));
            const px = (lx - (v.offsetWidth - (v.videoWidth || v.offsetWidth) * sc) / 2) / sc;
            const py = (ly - (v.offsetHeight - (v.videoHeight || v.offsetHeight) * sc) / 2) / sc;
            const c = camCalRef() || { cx: 0, cy: 0, r: 100 };
            if (phase === 'kalib-bull') { c.cx = px; c.cy = py; c.r = c.r || 100; setCal(c); phase = 'kalib-rand'; status.textContent = 'Jetzt UNTERE äußere Doppelkante antippen'; }
            else { c.r = Math.abs(py - c.cy); setCal(c); saveCal(); phase = 'idle'; status.textContent = '✓ Manuell kalibriert (R=' + Math.round(c.r) + 'px)'; kalibBtn.textContent = 'Neu kalibrieren'; }
          }
        };
      };
      kalibBtn.style.display = 'none';
      kalibBtn.onclick = async () => {
        const v = videoHost.querySelector('video');
        if (!v) { status.textContent = 'Erst Kamera anzeigen'; return; }
        kalibBtn.textContent = 'Kalibriere…';
        const erg = await autoKalibriere(v);
        if (erg) {
          setCal(erg); saveCal();
          kalibBtn.textContent = 'Neu kalibrieren';
          status.textContent = '✓ Automatisch kalibriert: Mitte ' + Math.round(erg.cx) + '/' + Math.round(erg.cy) + ', R=' + Math.round(erg.r) + 'px';
        } else {
          phase = 'kalib-bull';
          kalibBtn.textContent = 'Auto fehlgeschlagen - tippe aufs BULL';
          status.textContent = 'Automatik fand nichts (zu dunkel). TIPPE: 1. Bull-Mitte  2. untere Doppelkante';
        }
      };
      host.append(
        el('h2', {}, 'Kamera-Kalibrierung'),
        status, startBtn, videoHost, kalibBtn,
        el('p', { class: 'small muted mt' }, 'Handy vor die Scheibe, Kalibrieren drücken. Bei Dunkelheit: Bull und untere Doppelkante antippen.')
      );
      setTimeout(() => { const t = document.querySelector('#profilanchor'); if (t) t.after(host); else view.prepend ? view.prepend(host) : view.append(host); }, 0);
    })(),
    el('a', { href: '#/camera', style: 'display:inline-block;margin:0 0 10px;font-size:13px' }, 'Kamera-Assistent'),
    el('div', { class: 'list' },
      ...(s.profiles.length ? s.profiles.map(p => el('div', { class: 'listitem' },
        el('div', { class: 'grow' },
          el('div', { class: 'title' }, p.name,
            p.friendCode ? el('span', { class: 'mono', style: 'margin-left:8px' }, 'Code ' + p.friendCode) : ''),
          el('div', { class: 'sub' }, p.accountId ? 'Konto: ' + p.accountName : 'lokal')
        ),
        s.activeProfile === p.name ? el('span', { class: 'chip on small' }, 'aktiv') :
          el('button', {
            class: 'btn small', onclick: () => { setActiveProfile(s, p.name); store.save(); rerender(); }
          }, 'aktiv setzen'),
        s.activeProfile !== p.name ? el('button', {
          class: 'btn small danger', onclick: () => {
            if (confirm(`Profil "${p.name}" inkl. Spiele löschen?`)) {
              s.profiles = s.profiles.filter(x => x.name !== p.name);
              s.games = s.games.filter(g => !(g.results || []).some(r => r.player === p.name));
              if (s.activeProfile === p.name) s.activeProfile = s.profiles[0]?.name || null;
              store.save(); rerender();
            }
          }
        }, 'Löschen') : ''
      )) : [el('p', { class: 'muted' }, 'Noch kein Profil – leg eins an.')]),
    )
  );
  const nameInput = el('input', { type: 'text', placeholder: 'Name', maxlength: 24, style: 'max-width:260px' });
  profPanel.append(el('div', { class: 'row mt' },
    nameInput,
    el('button', {
      class: 'btn', onclick: () => {
        const res = addProfile(s, nameInput.value);
        if (!res.ok) return toast(res.error);
        nameInput.value = '';
        store.save(); rerender();
      }
    }, icon('i-plus'), 'Profil anlegen')
  ));

  // ----- Caller -----
  const cs = callerSettings();
  const caller = s.settings.caller || (s.settings.caller = { ...cs });
  const tgl = (key, label, hint) => {
    const b = el('button', {
      class: 'chip' + (caller[key] ? ' on' : ''), onclick: () => {
        caller[key] = !caller[key];
        if (key === 'enabled' && caller.enabled) unlockAudio();
        configureCaller(caller);
        store.save(); rerender();
      }
    }, label);
    return el('div', { class: 'row', style: 'justify-content:space-between;margin:8px 0' }, el('div', {},
      el('div', { style: 'font-weight:700' }, label), el('div', { class: 'small muted' }, hint)), b);
  };
  const voiceSelect = el('select', { onchange: (e) => { caller.voiceURI = e.target.value || null; configureCaller(caller); store.save(); } });
  function fillVoices() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith(caller.lang === 'de' ? 'de' : 'en'));
    voiceSelect.innerHTML = '';
    voiceSelect.append(el('option', { value: '' }, 'Automatisch (Beste Gerätestimme)'));
    vs.forEach(v => voiceSelect.append(el('option', { value: v.voiceURI, selected: caller.voiceURI === v.voiceURI ? '' : null }, `${v.name} (${v.lang})`)));
  }
  fillVoices();
  if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = fillVoices;

  const callerPanel = el('div', { class: 'panel' },
    el('h2', {}, 'Caller', el('span', { class: 'sub' }, 'echte Clips vom Server — fehlt ein Clip: Stille, kein Stimm-Mix')),
    tgl('enabled', 'Caller aktiv', 'Restscore nach jedem Wurfsatz (Kays Kernanforderung)'),
    tgl('checkout', 'Checkout-Ansage', '„Double twenty for the match" / Route ab Rest 170'),
    tgl('dartCalls', 'Wurfpunkte je Dart', '„Treble twenty", 180 mit Schmackes'),
    tgl('applause', 'Applaus bei Game Shot', 'Publikums-Beifall wie im TV (Mixkit CC0)'),
    el('div', { id: 'voicesets' }, el('p', { class: 'muted small' }, 'Stimm-Sets werden geladen…')),
    el('div', { class: 'row', style: 'margin:10px 0' },
      [['en', 'Englisch'], ['de', 'Deutsch']].map(([v, l]) => el('button', {
        class: 'chip' + (caller.lang === v ? ' on' : ''), onclick: (e) => {
          caller.lang = v; configureCaller(caller); store.save();
          [...e.currentTarget.parentNode.children].forEach(c => c.classList.remove('on'));
          e.currentTarget.classList.add('on'); fillVoices();
        }
      }, l))),
    el('label', { class: 'field' }, el('span', {}, 'Gerätstimme (nur bei Set „Gerätstimme")'), voiceSelect),
    el('label', { class: 'field' }, el('span', {}, `Tempo: ${caller.rate ?? 1}`),
      el('input', {
        type: 'number', step: '0.05', min: '0.8', max: '1.4', value: caller.rate ?? 1,
        onchange: (e) => { caller.rate = Math.min(1.4, Math.max(.8, parseFloat(e.target.value) || 1)); configureCaller(caller); store.save(); }
      })),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn small', onclick: () => {
          unlockAudio();
          import('/js/caller-voice.js').then(m => { m.clearQueue(); m.callVisitEnd(170, { forMatch: true }); });
        }
      }, icon('i-mic'), 'Caller testen (Rest 170)'))
  );

  // Stimm-Sets dynamisch aus Manifest
  import('/js/caller-voice.js').then(async m => {
    const mf = await m.loadCallerManifest();
    const box = callerPanel.querySelector('#voicesets');
    box.innerHTML = '';
    box.append(el('div', { class: 'small', style: 'font-weight:800;color:#e8dfc8;margin:8px 0 6px' }, 'Stimme'));
    const full = (mf.sets || []).filter(s => s.full !== false);
    const previews = (mf.sets || []).filter(s => s.full === false);
    for (const s of full) {
      box.append(el('div', { class: 'row', style: 'justify-content:space-between;margin:4px 0' },
        el('button', {
          class: 'chip' + ((caller.voiceSet || 'elevenlabs-brian') === s.id ? ' on' : ''),
          onclick: (e) => {
            caller.voiceSet = s.id; configureCaller(caller); store.save();
            box.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
            e.currentTarget.classList.add('on');
          }
        }, s.label + (s.complete === false ? '  · läuft noch ein' : '') + (s.provider === 'elevenlabs' ? '  · Premium' : '')),
        el('button', { class: 'btn small ghost', onclick: () => m.previewSet(s.id) }, 'Anhören')
      ));
    }
    if (previews.length) {
      box.append(el('div', { class: 'small muted', style: 'margin:10px 0 4px' }, 'Weitere Stimmen (Vorschau) — wenn eine gefällt: gen-caller.sh --voice-id'));
      for (const s of previews) {
        box.append(el('div', { class: 'row', style: 'justify-content:space-between;margin:2px 0' },
          el('span', { class: 'chip small' }, s.label),
          el('button', { class: 'btn small ghost', onclick: () => m.previewSet(s.id) }, 'Anhören')
        ));
      }
    }
  }).catch(() => {});

  // ----- Als App installieren (Fullscreen ohne Browserchrom) -----
  const installRow = (() => {
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    if (standalone || store.state.settings.installed) return '';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const btn = el('button', {
      class: 'btn primary wide mt',
      onclick: async () => {
        const evt = window.__installEvt;
        if (evt) { evt.prompt(); const r = await evt.userChoice; if (r && r.outcome === 'accepted') { store.state.settings.installed = true; store.save(); rerender(); } }
        else toast(isIOS ? 'iPhone: In Safari → Teilen → „Zum Home-Bildschirm"' : 'Menü → „Zum Startbildschirm hinzufügen"');
      }
    }, icon('i-download'), window.__installEvt ? 'Als App installieren' : isIOS ? 'Zum Home-Bildschirm hinzufügen' : 'Als App installieren');
    return el('div', { class: 'panel' },
      el('h2', {}, 'Vollbild', el('span', { class: 'sub' }, 'ohne Browserleiste — wie eine echte App')),
      el('p', { class: 'muted small', style: 'margin:0 0 4px' }, isIOS ? 'iPhone: Safari → Teilen → Zum Home-Bildschirm' : 'Installiert DartPro als App (Android/Chrome).'),
      btn);
  })();
  view.append(installRow);

  // ----- Daten -----
  const fileInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const text = await f.text();
    const res = importJSON(text, s);
    if (!res.ok) return toast(res.error);
    store.save();
    toast(`Import: ${res.added} Spiele übernommen`);
    rerender();
  });
  const dataPanel = el('div', { class: 'panel' },
    el('h2', {}, 'Daten', el('span', { class: 'sub' }, `${s.games.length} Spiele lokal (localStorage)`)),
    el('div', { class: 'row' },
      el('button', {
        class: 'btn', onclick: () => {
          download(`dartpro-export-${new Date().toISOString().slice(0, 10)}.json`, exportJSON(s));
        }
      }, icon('i-download'), 'Export (JSON)'),
      el('button', { class: 'btn', onclick: () => fileInput.click() }, icon('i-upload'), 'Import'),
      fileInput,
      el('button', {
        class: 'btn danger', onclick: () => {
          if (confirm('Wirklich ALLE lokalen Daten löschen?')) {
            localStorage.removeItem('dartpro.v1');
            location.reload();
          }
        }
      }, 'Alles löschen')
    )
  );

  // ----- App / Update -----
  // Download-Link 1:1 wie Tennis-App: plain <a href>, keine Extras (Kays Vorgabe 22.10.)
  const apkLink = el('a', { class: 'btn', href: '/download/dart-app.apk' }, icon('i-download'), 'Android-App laden (APK)');
  const appPanel = el('div', { class: 'panel' },
    el('h2', {}, 'App'),
    el('div', { class: 'row' },
      apkLink,
      el('button', { class: 'btn ghost', onclick: startManualUpdateCheck }, 'Nach Update suchen'),
      el('span', { class: 'mono', id: 'appversion' }, '')
    ),
    el('p', { class: 'small muted' }, 'PWA: installierbar über „Zum Home-Bildschirm". Updates kommen automatisch beim Öffnen.')
  );
  fetch('/VERSION', { cache: 'no-store' }).then(r => r.text()).then(v => {
    const n = view.querySelector('#appversion');
    if (n) n.textContent = 'Version ' + v.trim();
  }).catch(() => {});

  view.append(
    el('p', { class: 'kicker' }, 'Profil & Einstellungen'),
    el('h1', { class: 'serif', style: 'margin:0 0 14px;font-size:30px' }, 'Einstellungen'),
    profPanel, callerPanel, dataPanel, appPanel
  );
}
