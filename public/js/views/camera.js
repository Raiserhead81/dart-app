// KAMERA-ASSISTENT (KAY 24.10.): Handy ~1m vor der Scheibe, digitaler Zoom fuer
// den Blick, Erkennung im VOLLBILD. Kalibrierung: Bull tippen + aeussere
// Doppelkante antippen => Mitte/Radius => Segmente berechenbar.
// Auto-Zaehlung: Diff-Frames pro Wurf => Pfeilspitze => Feld => Callback.

import { el } from '/js/util.js';
import { store } from '/js/app.js';

import { segVonPixel as _segVonPixel, findeNeuenPfeil as _finde, setEngineCal, analyseBoardInFrame, normierraumZuBild as _nrZuBild, tapZuVideoPixel as _tapZuVideoPixel } from '/js/core/camera-engine.js';

let stream = null, video = null, canvas = null, ctx = null;
let recorder = null, recChunks = [], recOnStop = null;

// KAY: Aufnahmen PERSISTENT in IndexedDB (ueberlebt App-Neustart, kein Kabel noetig)
function idbSpeichereAufnahme(blob, ts) {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('dartpro-cam', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('recs'); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('recs', 'readwrite');
        tx.objectStore('recs').put({ blob, ts, size: blob.size }, 'letzte');
        tx.oncomplete = () => { window.__recPersist = 'ok ' + ts; resolve('ok'); };
        tx.onerror = () => resolve('tx-fehler');
      };
      req.onerror = () => resolve('db-fehler');
    } catch (e) { resolve('exception'); }
  });
}
export function aufnahmeLaeuft() { return recorder && recorder.state === 'recording'; }
export function toggleAufnahme(fertig) {
  return new Promise((resolve) => {
    if (recorder && recorder.state === 'recording') { recorder.stop(); resolve('gestoppt'); return; }
    if (!stream) { resolve('keine kamera'); return; }
    recChunks = [];
    try {
      const mt = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm';
      recorder = new MediaRecorder(stream, { mimeType: mt });
    } catch (e) { try { recorder = new MediaRecorder(stream); } catch (e2) { resolve('MediaRecorder fehlgeschlagen'); return; } }
    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) recChunks.push(ev.data); };
    recorder.onstop = () => {
      const blob = new Blob(recChunks, { type: 'video/webm' });
      window.__lastRecording = blob;
      idbSpeichereAufnahme(blob, Date.now()); // PERSISTENT: ueberlebt Neustart
      if (fertig) fertig(blob.size);
      resolve('gestartet-und-gestoppt ' + blob.size);
    };
    recorder.start(500);
    resolve('aufnahme laeuft');
  });
}
let cal = null; // {cx, cy, r}
let baseFrame = null; // ImageData vor dem Wurf

export function segVonPixel(x, y, c) { return _segVonPixel(x, y, c || cal); }

function frameGrab() {
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Diff: neuen dunklen Punkt finden (Pfeilspitze). Liefert {x, y, staerke} oder null.
export function findeNeuenPfeil(a, b) { setEngineCal(cal); return _finde(a, b, cal); }

// ===== WEBVIEW-SICHERER ZOOM =====
// Android-WebView rendert <video> als eigene Surface: transform:scale(<1)
// laesst das Bild ploetzlich verschwinden. Deshalb Zoom <= 1x per LAYOUT
// (width%), transform nur noch fuer Zoom > 1x (Pinch-typisch, robust).
export function setzeAnsichtsZoom(v, z) {
  if (!v) return;
  if (z <= 1) {
    v.style.transform = 'none';
    v.style.width = Math.round(z * 100) + '%';
    v.style.marginLeft = 'auto'; v.style.marginRight = 'auto';
  } else {
    v.style.width = '100%';
    v.style.marginLeft = '0'; v.style.marginRight = '0';
    v.style.transform = `scale(${z})`;
    v.style.transformOrigin = 'center center';
  }
}
// Wirksamer Transform-Faktor fuer Klick-Mapping (1 bei Layout-Zoom).
export function leseAnsichtsZoom(v) {
  if (!v || !v.style.transform || v.style.transform === 'none') return 1;
  return parseFloat(v.style.transform.replace(/[^\d.]/g, '')) || 1;
}

// ===== MAXIMALE KAMERA-OPTIMIERUNG (nur Handy-Cam) =====
// 1) 1920er-Stream erzwingen, 30fps
// 2) Fokus beruhigen (continuous-video statt Foto-Pumpen)
// 3) Belichtung nach Kalibrierung einfrieren (keine Helligkeitsspruenge in Diffs)
// 4) TORCH: Handy-LED als Scheibenbeleuchtung bei Dunkelheit
export async function optimiereKamera(track) {
  const versuche = [
    { advanced: [{ focusMode: 'continuous-video' }] },
    { advanced: [{ frameRate: 30 }] },
  ];
  for (const v of versuche) { try { await track.applyConstraints(v); } catch (e) { /* nicht unterstuetzt */ } }
}
export async function setzeTorch(track, an) {
  try {
    await track.applyConstraints({ advanced: [{ torch: !!an }] });
    return true;
  } catch (e) { return false; }
}
export function kamerataste() { try { return stream?.getVideoTracks?.()[0] || null; } catch (e) { return null; } }

export async function startCam(deviceId) {
  const gespeichertesLabel = (() => { try { return localStorage.getItem('dartpro.camera.lenslabel') || ''; } catch (e) { return ''; } })();
  if (stream) { // Stream laeuft evtl. schon (alter View) -> NEUES Video anbinden!
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}
    return true;
  }
  // Ohne explizite deviceId: Weitwinkel-Linse per LABEL waehlen (IDs sind je Start neu!)
  if (!deviceId && gespeichertesLabel) {
    try {
      // Erst einmal kurz default oeffnen (macht Permissions + echte Labels verfuegbar)
      const probe = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const treffer = devs.find(d => d.label === gespeichertesLabel);
      probe.getTracks().forEach(t => t.stop());
      if (treffer && treffer.deviceId) deviceId = treffer.deviceId;
    } catch (e) { /* Probe fehlgeschlagen: default nutzen */ }
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false
    });
    // KAY: ECHTEN Kamera-Zoom auf MAXIMAL WEIT (Weitwinkel) stellen - breitester
    // Ausschnitt, die Scheibe mit Umfeld. Der Slider zoomt spaet NUR die Ansicht.
    let weitwinkelOk = false;
    try {
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.zoom && caps.zoom.min != null) {
        await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
        weitwinkelOk = (track.getSettings().zoom || caps.zoom.min) <= caps.zoom.min + 0.01;
      }
    } catch (e) { /* Geraet ohne Zoom-Control */ }
    stream._weitwinkelOk = weitwinkelOk;
    video.srcObject = stream;
    await video.play();
    optimiereKamera(stream.getVideoTracks()[0]).catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

export function stopCam() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
}

// Kalibrierung speichern (Handy-Position vorausgesetzt)
export function saveCal() { if (cal && store) { store.state.settings.cameraCal = cal; store.save(); } }
export function camCalRef() { return cal; }
export function aktuellerStream() { return stream; }
export function setCal(c) { cal = c; }
export function loadCal() {
  const c = store?.state?.settings?.cameraCal;
  if (c && c.cx && c.r) { cal = c; return true; }
  return false;
}
export function istKalibriert() { return !!cal; }

// AUTO-MODUS: pollt Frames, findet NEUE Pfeile (stabil = 2 Treffer gleiche Stelle),
// ruft onThrow(seg) und aktualisiert das Referenzbild. stopAuto() beendet.
let autoTimer = null, autoBusy = false, bounces = 0;
export function startAuto(onThrow, onStatus) {
  if (autoTimer || !stream) return;
  let lastFrame = frameGrab();
  let pending = null; // {x, y, count}
  autoTimer = setInterval(async () => {
    if (autoBusy || !video.videoWidth) return;
    autoBusy = true;
    try {
      const now = frameGrab();
      const p = findeNeuenPfeil(lastFrame, now);
      // KAY-DIAGNOSE: jede Runde loggen (warum wird nichts gezaehlt?)
      try {
        window.__camlog = (window.__camlog || []).slice(-40);
        window.__camlog.push({ t: Date.now() % 100000, p: p ? [Math.round(p.x), Math.round(p.y), p.pixel + 'px'] : null, cal: cal ? [Math.round(cal.cx), Math.round(cal.cy), Math.round(cal.r)] : 'KEINE' });
      } catch (e) {}
      if (p && cal) {
        const seg = segVonPixel(p.x, p.y, cal);
        const selbeStelle = pending && Math.abs(pending.x - p.x) < 18 && Math.abs(pending.y - p.y) < 18;
        if (selbeStelle && pending.count >= 1 && seg) {
          // 2 Frames stabil + gueltiges Segment => Wurf! Punkt mitgeben (fuer Lern-Korrektur)
          onThrow(seg, { x: p.x, y: p.y });
          lastFrame = frameGrab();
          pending = null;
          bounces = 0;
        } else {
          pending = { x: p.x, y: p.y, count: selbeStelle ? pending.count + 1 : 0 };
          bounces = 0;
        }
      } else if (!p) {
        // KAY/OMNI: BOUNCE-OUT-SCHUTZ - Pfeil war kurz sichtbar (pending gesetzt)
        // und ist WIEDER VERSCHWUNDEN => Bounce-Out, NICHT werten.
        if (pending && pending.count >= 1) {
          bounces++;
          if (bounces >= 2) {
            if (onStatus) onStatus('bounce');
            lastFrame = frameGrab(); // Referenz erneuern, ohne zu werten
            pending = null;
            bounces = 0;
          }
        } else {
          pending = null;
          bounces = 0;
        }
      }
    } catch (e) { /* Frame-Drop */ }
    autoBusy = false;
  }, 850);
  if (onStatus) onStatus('live');
}
export function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
export function camCal() { return cal; }

// KAY: KORREKTUR-TAP - wenn die Automatik falsch gezaehlt hat, tippt Kay auf die
// ECHTE Pfeilposition. Einmaliger Capture-Handler (blockt den normalen Treffer-Tap),
// liefert Video-Pixel an fertig(px, py).
let korrekturAktiv = false;
export function starteKorrekturTap(videoEl, fertig) {
  if (!videoEl) return;
  korrekturAktiv = true;
  const handler = (ev) => {
    videoEl.removeEventListener('click', handler, true);
    ev.stopPropagation();
    korrekturAktiv = false;
    const rect = videoEl.getBoundingClientRect();
    const zoom = leseAnsichtsZoom(videoEl);
    const ow = videoEl.offsetWidth || videoEl.videoWidth, oh = videoEl.offsetHeight || videoEl.videoHeight;
    const lx = (ev.clientX - rect.left) / zoom, ly = (ev.clientY - rect.top) / zoom;
    const sc = Math.min(ow / (videoEl.videoWidth || ow), oh / (videoEl.videoHeight || oh));
    const offX = (ow - (videoEl.videoWidth || ow) * sc) / 2, offY = (oh - (videoEl.videoHeight || oh) * sc) / 2;
    fertig({ x: (lx - offX) / sc, y: (ly - offY) / sc });
  };
  videoEl.addEventListener('click', handler, true);
  // Sicherheitsnetz: nach 12s abbrechen, sonst bleibt jeder Tap gefangen
  setTimeout(() => { videoEl.removeEventListener('click', handler, true); korrekturAktiv = false; }, 12000);
}
export function istKorrekturAktiv() { return korrekturAktiv; }

// SPIEL-EINBAU: Kamera-PiP in beliebigem Host-Element + Auto-Zaehlung.
// onThrow(seg) wird bei jedem erkannten Dart gerufen. Kalibrierung per Tap aufs PiP.
export function mountCam(host, onThrow, onStatus) {
  // IDEMPOTENT: Spiel rendert nach jedem Dart neu - kein Video-Stapeln!
  if (host.dataset.camMounted === '1' && host.querySelector('video')) {
    video = host.querySelector('video'); // Modul-Referenz frischen
    return;
  }
  host.dataset.camMounted = '1';
  const frame = el('div', { style: 'width:100%;height:min(75vh, 620px);overflow:hidden;border-radius:14px;background:#000;position:relative' });
  const v = el('video', { autoplay: '', playsinline: '', muted: '', style: 'width:100%;height:100%;object-fit:contain;display:block;transform-origin:center' });
  // KAY: Start MAXIMAL weit draussen (0,4x), dann gezielt reinziehen
  const zoomLabel = el('span', { class: 'small muted', style: 'float:right' }, '0,5x');
  const zoom = el('input', { type: 'range', min: 30, max: 500, value: 50, step: 5, style: 'width:100%;margin:6px 0 0' });
  
  zoom.oninput = () => { setzeAnsichtsZoom(v, zoom.value / 100); zoomLabel.textContent = (zoom.value / 100).toFixed(1).replace('.', ',') + 'x'; };
  const note = el('div', { class: 'small muted', style: 'text-align:center;margin-top:2px;font-size:10.5px;line-height:1.25' }, 'Kamera startet…');
  frame.append(v);
  // KAY: Ansicht startet IMMER weit draussen (0,5x) - dann gezielt reinzoomen
  zoom.value = 50; zoomLabel.textContent = '0,5x'; setzeAnsichtsZoom(v, 0.5);
  const zoomRow = el('div', {}, zoomLabel);
  host.append(frame, zoomRow, zoom, note);
  video = v; // Modul-Referenz fuer frameGrab/startAuto
  // KAY STATIV: Orientierungswechsel (Hoch<->Quer) aendert den Video-Pixelraum -
  // die alte Kalibrierung waere unbrauchbar. Automatisch NEU kalibrieren (Stativ
  // steht still, Scheibe auch - Auto-Kalibrierung greift ohne Zutun).
  v.addEventListener('resize', async () => {
    if (!v.videoWidth || !cal || !cal.ar) return;
    const neuAR = v.videoWidth / v.videoHeight;
    if (Math.abs(neuAR / cal.ar - 1) < 0.15) return;
    cal = null; saveCal();
    const oc = document.getElementById('camoverlay');
    if (oc) oc.getContext('2d').clearRect(0, 0, oc.width, oc.height);
    if (onStatus) { try { onStatus('orient'); } catch (_) {} }
    try {
      const erg = await autoKalibriere(v);
      if (erg) {
        setCal(erg); saveCal();
        try { zeichneRaster(v, erg); } catch (_) {}
        if (onStatus) onStatus('orient-ok');
      } else if (onStatus) onStatus('orient-fail');
    } catch (e) { if (onStatus) onStatus('orient-fail'); }
  });
  const phase = { m: 'idle' };
  v.onclick = async (ev) => {
    if (phase.mode === 'kalib-bull' || phase.mode === 'kalib-rand') {
      const rect = v.getBoundingClientRect();
      const zoom = leseAnsichtsZoom(v);
      const lx = (ev.clientX - rect.left) / zoom, ly = (ev.clientY - rect.top) / zoom;
      const sc = Math.min(v.offsetWidth / (v.videoWidth || v.offsetWidth), v.offsetHeight / (v.videoHeight || v.offsetHeight));
      const offX = (v.offsetWidth - (v.videoWidth || v.offsetWidth) * sc) / 2;
      const offY = (v.offsetHeight - (v.videoHeight || v.offsetHeight) * sc) / 2;
      const px = (lx - offX) / sc, py = (ly - offY) / sc;
      if (phase.mode === 'kalib-bull') {
        cal = { cx: px, cy: py, r: 100 };
        note.textContent = 'Jetzt UNTERE aeussere Doppelkante antippen';
        phase.mode = 'kalib-rand';
      } else {
        cal.r = Math.abs(py - cal.cy);
        saveCal();
        phase.mode = 'idle';
        note.textContent = 'MANUELL KALIBRIERT (R=' + Math.round(cal.r) + 'px) - fertig!';
        if (window.__manuellKalib) window.__manuellKalib(cal);
      }
      return;
    }
    if (phase.m !== 'kalib' && phase.m !== 'kalib-check') return;
    // ZOOM-SICHER (wie tapEingabe): offset-Masse + entzoomen vor contain-Mapping
    const ow = v.offsetWidth || v.videoWidth, oh = v.offsetHeight || v.videoHeight;
    const rect = v.getBoundingClientRect();
    const zoom = leseAnsichtsZoom(v);
    const lx = (ev.clientX - rect.left) / zoom;
    const ly = (ev.clientY - rect.top) / zoom;
    const sc = Math.min(ow / (v.videoWidth || ow), oh / (v.videoHeight || oh));
    const offX = (ow - (v.videoWidth || ow) * sc) / 2;
    const offY = (oh - (v.videoHeight || oh) * sc) / 2;
    const px = (lx - offX) / sc;
    const py = (ly - offY) / sc;
    if (!cal) { cal = { cx: px, cy: py, r: 100 }; note.textContent = 'Jetzt UNTERE Doppel-Aussenseite antippen'; }
    else if (cal.r === 100 && py !== cal.cy) {
      cal.r = Math.abs(py - cal.cy);
      saveCal();
      // KAY-FEINTUNING: Kontroll-Tipp aufs BULL => systematischer Versatz wird wegkorrigiert
      cal._check = true;
      note.textContent = 'FAST FERTIG: Tipp nochmal MITTLIG aufs BULL (Kontrolle)';
      phase.m = 'kalib-check';
    }
    else if (phase.m === 'kalib-check') {
      const versatzX = cal.cx - px, versatzY = cal.cy - py;
      cal.cx += versatzX; cal.cy += versatzY;
      saveCal();
      note.textContent = 'Feinjustiert (±' + Math.round(Math.hypot(versatzX, versatzY)) + 'px) - fertig!';
      phase.m = 'run';
      startAuto(onThrow, onStatus);
    }
  };
  (async () => {
    const ok = await startCam();
    if (!ok) { note.textContent = 'Kamera verweigert - Kamera-Assistent in der APK?'; return; }
    if (istKalibriert()) { note.textContent = 'Kamera live (kalibriert) - wirf!'; startAuto(onThrow, onStatus); }
    else { note.textContent = 'TIPPE aufs Bild: erst BULL-Zentrum, dann untere Doppelkante'; phase.m = 'kalib'; }
  })();
}

// KAY: TAP-AUF-DIE-SCHEIBE - das Kamerabild wird zum Eingabepad.
// Tap auf den Treffer => Segment => onThrow. Robust, sofort, ohne Erkennungsrisiko.
export function tapEingabeAnbinden(videoEl, onThrow, onKalibHinweis) {
  videoEl.addEventListener('click', (ev) => {
    if (korrekturAktiv) return; // Korrektur-Tap hat Vorrang
    if (!cal) { if (onKalibHinweis) onKalibHinweis(); return; }
    // BEWIESENE Core-Kette (tests/tap-kette.test.js): Finger -> Video -> Feld
    const rect = videoEl.getBoundingClientRect();
    const zoom = leseAnsichtsZoom(videoEl);
    const p = _tapZuVideoPixel(ev.clientX, ev.clientY, rect.left, rect.top, rect.width, rect.height,
      videoEl.offsetWidth || videoEl.videoWidth, videoEl.offsetHeight || videoEl.videoHeight,
      videoEl.videoWidth || 1, videoEl.videoHeight || 1, zoom);
    const seg = segVonPixel(p.x, p.y, cal);
    if (seg) onThrow(seg); else if (onKalibHinweis) onKalibHinweis();
  });
}

export function unmountCam() {
  stopAuto();
  stopCam();
  // KAY: Kamerabereich KOMPLETT entfernen (bleib sonst als schwarzer Kasten stehen)
  const h = document.getElementById('camhost');
  if (h) h.remove();
  const vg = document.querySelector('.view-game');
  if (vg) vg.style.paddingTop = '';
}

export function renderCamera(view) {
  view.className = 'view';
  const status = el('div', { class: 'small muted', id: 'camstatus' }, 'Kamera aus');
  const erkenne = el('button', { class: 'btn primary wide mt', style: 'display:none' }, 'Wurf erkennen (Test)');
  video = el('video', { autoplay: '', playsinline: '', muted: '', style: 'width:100%;border-radius:14px;background:#000;display:none' });
  canvas = el('canvas', { style: 'display:none' });
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  const phase = { mode: 'idle' }; // idle | kalib-bull | kalib-rand
  const zoom = el('input', { type: 'range', min: 100, max: 300, value: 100, style: 'width:100%;display:none' });
  const startBtn = el('button', { class: 'btn primary wide mt' }, 'Kamera starten');
  // KAY: AUFNAHME fuer die Engine-Kalibrierung (Agent analysiert das Video offline)
  let recorder = null, chunks = [];
  const recBtn = el('button', { class: 'btn danger wide mt', style: 'display:none' }, 'Aufnahme starten');
  const recLink = el('a', { class: 'btn wide mt', style: 'display:none;text-decoration:none' }, 'Video herunterladen');
  recBtn.onclick = () => {
    if (!stream) return;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      recBtn.textContent = 'Aufnahme starten';
      return;
    }
    chunks = [];
    try {
      recorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm' });
    } catch (e) { recorder = new MediaRecorder(stream); }
    recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      window.__lastRecording = blob; // KAY-DIAGNOSE: Agent zieht das per CDP
      const url = URL.createObjectURL(blob);
      recLink.href = url;
      recLink.download = 'dart-aufnahme.webm';
      recLink.style.display = '';
      recLink.textContent = `Video speichern (${(blob.size / 1e6).toFixed(1)} MB)`;
      status.textContent = 'Aufnahme fertig - Agent kann sie jetzt analysieren';
    };
    recorder.start(500);
    recBtn.textContent = 'Aufnahme STOPPEN (jetzt werfen!)';
    status.textContent = 'AUFNAHME LÄUFT - wirf deine Darts';
  };
  startBtn.addEventListener('afterstart', () => {});
  // KAY/OPPO Find X: mehrere Linsen - Auswahl der Back-Kameras (Weitwinkel!)
  const lensRow = el('div', { class: 'row mt', style: 'gap:6px' });
  (async () => {
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && !/front/i.test(d.label || ''));
      devs.forEach((d, i) => {
        lensRow.append(el('button', {
          class: 'chip', onclick: async (e) => {
            [...lensRow.children].forEach(c => c.classList.remove('on'));
            e.currentTarget.classList.add('on');
            localStorage.setItem('dartpro.camera.lenslabel', d.label || ''); // KAY: per LABEL (deviceIds aendern sich je Start)
            stopCam();
            const ok = await startCam(d.deviceId);
            status.textContent = ok ? 'Linse ' + (i + 1) + ' gespeichert - Spiel nutzt sie jetzt!' : 'Linse ' + (i + 1) + ' ging nicht';
          }
        }, 'Linse ' + (i + 1) + (d.label ? ' (' + d.label.replace(/camera ?/i, 'Cam ') + ')' : '')));
      });
    } catch (e) { /* keine Auflistung */ }
  })();

  startBtn.onclick = async () => {
    status.textContent = 'starte Kamera…';
    if (await startCam()) {
      video.style.display = '';
      zoom.style.display = '';
      status.textContent = '① SCHEIBE KALIBRIEREN drücken (unten)';
      kalibBtn.style.display = '';
      phase.mode = 'idle'; // Auto-Kalibrierung ersetzt die Tipp-Kalibrierung
      startBtn.style.display = 'none';
      recBtn.style.display = '';
    } else {
      status.textContent = 'Kamera-Freigabe verweigert oder keine Kamera';
    }
  };

  const overlay = el('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none' });

  video.onclick = (ev) => {
    if (phase.mode === 'idle' || !video.videoWidth) return;
    const r = video.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * video.videoWidth;
    const py = (ev.clientY - r.top) / r.height * video.videoHeight;
    if (phase.mode === 'kalib-bull') {
      cal = { cx: px, cy: py, r: 100 };
      status.textContent = 'Jetzt auf die UNTERE äußere Doppelkante tippen';
      phase.mode = 'kalib-rand';
    } else if (phase.mode === 'kalib-rand') {
      cal.r = Math.abs(py - cal.cy);
      saveCal();
      status.textContent = `Kalibriert (R=${Math.round(cal.r)}px). Jetzt: „Referenzbild aufnehmen“, dann Dart werfen, dann „Wurf erkennen“`;
      phase.mode = 'idle';
      erkenne.style.display = '';
      malOverlay();
    }
  };

  function malOverlay(markX, markY) {
    if (!cal) return;
    overlay.width = overlay.clientWidth; overlay.height = overlay.clientHeight;
    const o = overlay.getContext('2d');
    const sx = overlay.width / video.videoWidth, sy = overlay.height / video.videoHeight;
    o.clearRect(0, 0, overlay.width, overlay.height);
    o.strokeStyle = 'rgba(232,182,76,.85)'; o.lineWidth = 2;
    o.beginPath(); o.arc(cal.cx * sx, cal.cy * sy, cal.r * sx, 0, Math.PI * 2); o.stroke();
    o.beginPath(); o.arc(cal.cx * sx, cal.cy * sy, cal.r * sx * RINGE.tripleIn, 0, Math.PI * 2); o.stroke();
    if (markX != null) { o.fillStyle = '#ff2d55'; o.beginPath(); o.arc(markX * sx, markY * sy, 8, 0, Math.PI * 2); o.fill(); }
  }

  const refBtn = el('button', { class: 'btn wide mt', style: 'display:none' }, 'Referenzbild aufnehmen');

  // ECHTE AUTO-KALIBRIERUNG in den Kamera-EINSTELLUNGEN: ein Druck + Raster-Beweis
  const kalibErgebnis = el('div', { class: 'small muted mt' }, '');
  const kalibBtn = el('button', { class: 'btn primary wide mt', style: 'display:none' }, '① SCHEIBE KALIBRIEREN');
  kalibBtn.onclick = async () => {
    kalibBtn.textContent = 'Kalibriere… 0 %';
    kalibBtn.disabled = true;
    const erg = await autoKalibriere(video, (p, gute) => {
      kalibBtn.textContent = 'Kalibriere… ' + p + ' %';
      kalibErgebnis.textContent = 'Analysiere Scheibe: ' + p + ' % (' + gute + '/5 Frames erkannt)…';
    });
    kalibBtn.disabled = false;
    if (!erg) {
      // FALLBACK: automatisch gescheitert -> MANUELL per Finger-Tipps (100% zuverlaessig)
      kalibBtn.textContent = 'Auto fehlgeschlagen - MANUELL: tippe aufs BULL';
      kalibErgebnis.textContent = 'Automatische Erkennung fand kein Board (zu dunkel/entsaettigt). TIPPE JETZT: 1. Bull-Mitte  2. untere aeussere Doppelkante  3. nochmal Bull (Kontrolle).';
      phase.mode = 'kalib-bull';
      window.__manuellKalib = (c) => { zeichneRaster(video, c); kalibBtn.textContent = '✓ Manuell kalibriert - nochmal?'; };
      return;
    }
    cal = erg; saveCal();
    kalibBtn.textContent = '✓ Kalibriert - nochmal?';
    kalibErgebnis.textContent = 'Zentrum ' + Math.round(erg.cx) + '/' + Math.round(erg.cy) + ' · Radius ' + Math.round(erg.r) + 'px — gespeichert, das Spiel nutzt sie ab sofort.';
    zeichneRaster(video, erg);
  };
  refBtn.style.display = '';
  refBtn.onclick = () => { baseFrame = frameGrab(); status.textContent = 'Referenz steht - Dart werfen!'; };

  erkenne.onclick = () => {
    const now = frameGrab();
    const p = findeNeuenPfeil(baseFrame, now);
    if (!p) { status.textContent = 'Kein neuer Pfeil erkannt - nochmal werfen oder Referenz neu'; return; }
    const seg = segVonPixel(p.x, p.y, cal);
    malOverlay(p.x, p.y);
    status.textContent = seg ? `ERKANNT: ${seg.label} (${seg.v} Punkte)` : 'Daneben / außerhalb';
  };

  zoom.oninput = () => {
    setzeAnsichtsZoom(video, zoom.value / 100);
  };

  const host = el('div', { style: 'position:relative;display:block' }, video, overlay);
  view.append(
    el('p', { class: 'kicker' }, 'Kamera-Assistent'),
    el('div', { class: 'panel' },
      el('h2', {}, 'Scheibe filmen', el('span', { class: 'sub' }, 'Handy ~1m davor')), lensRow, host, zoom, status, startBtn, refBtn, erkenne,
      el('p', { class: 'small muted mt' }, 'Test-Modus: kalibrieren, Referenz, werfen, erkennen. Auto-Zaehlung im Spiel folgt als nächster Schritt.')
    )
  );
}

// ---------- ECHTE Auto-Kalibrierung: Board aus den rot/gruenen Sektoren finden ----------

export function autoKalibriere(videoEl, onProgress) {
  // 5 Frames im Abstand analysieren, Median aus den guten Ergebnissen.
  // onProgress(prozent, guteFrames) fuer Live-Anzeige "xx % kalibriert".
  return new Promise(async (resolve) => {
    const ergs = [];
    for (let f = 0; f < 5; f++) {
      try {
        const c = document.createElement('canvas');
        const zielW = 270;
        c.width = zielW; c.height = Math.round(zielW * videoEl.videoHeight / videoEl.videoWidth);
        c.getContext('2d', { willReadFrequently: true }).drawImage(videoEl, 0, 0, zielW, c.height);
        const data = c.getContext('2d').getImageData(0, 0, zielW, c.height);
        const e = analyseBoardInFrame(data);
        // QUALITAETS-GATE: nur echte Boards akzeptieren (kein TV / Wand / Rauschen)
        const q = e && typeof e.qualitaet === 'number' ? e.qualitaet : 0;
        if (e && q >= 60 && e.r > 25 && e.r < zielW * 0.75) ergs.push(e);
      } catch (err) { /* Frame-Drop */ }
      if (onProgress) { try { onProgress(Math.round((f + 1) / 5 * 100), ergs.length); } catch (_) {} }
      await new Promise(r => setTimeout(r, 250));
    }
    if (ergs.length < 3) { resolve(null); return; }
    const qs = ergs.map(e => e.qualitaet || 0);
    const med = (arr, key) => { const v = arr.map(e => e[key]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    // zirkulaerer Median fuer den Rotationswinkel (0..360, kein Umbruch bei 359->1)
    const medAng = () => {
      const v = ergs.map(e => e.rot || 0);
      let best = v[0], bestS = -1;
      for (const cand of v) {
        let sx = 0, sy = 0;
        for (const w of v) { const d = (w - cand) * Math.PI / 180; sx += Math.cos(d); sy += Math.sin(d); }
        const s = Math.hypot(sx, sy);
        if (s > bestS) { bestS = s; best = cand; }
      }
      return best;
    };
    const skal = videoEl.videoWidth / 270;
    // Homographie: nur wenn mindestens 2 Frames eine liefern; Median je Matrixeintrag, dann auf Video-Pixel skalieren
    const hs = ergs.map(e => e.h).filter(Boolean);
    let h = null;
    if (hs.length >= 2) {
      h = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        const w = hs.map(m => m[i][j]).sort((a, b) => a - b);
        h[i][j] = w[Math.floor(w.length / 2)] * (i < 2 ? skal : 1);
      }
    }
    resolve({
      cx: med(ergs, 'cx') * skal, cy: med(ergs, 'cy') * skal, r: med(ergs, 'r') * skal,
      rx: med(ergs, 'rx') * skal, ry: med(ergs, 'ry') * skal, theta: med(ergs, 'theta'),
      rot: medAng(), h, qualitaet: qs.sort((a, b) => a - b)[Math.floor(qs.length / 2)],
      ar: videoEl.videoWidth > 0 ? videoEl.videoWidth / videoEl.videoHeight : undefined
    });
  });
}


function zeichneRaster(videoEl, calErg) {
  let c = document.getElementById('camoverlay');
  if (!c) { c = el('canvas', { id: 'camoverlay', style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4' }); videoEl.parentElement.append(c); }
  const box = videoEl.getBoundingClientRect();
  c.width = box.width; c.height = box.height;
  const ctx = c.getContext('2d');
  const ow = videoEl.offsetWidth, oh = videoEl.offsetHeight;
  const zoom = leseAnsichtsZoom(videoEl);
  const sc = Math.min(ow / videoEl.videoWidth, oh / videoEl.videoHeight) * zoom;
  const vx = (box.width - videoEl.videoWidth * sc) / 2, vy = (box.height - videoEl.videoHeight * sc) / 2;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.strokeStyle = 'rgba(70,196,122,.95)'; ctx.lineWidth = 2;
  const rot = calErg.rot || 0;
  const zuScreen = (u, v) => { const p = _nrZuBild(u, v, calErg); return [vx + p.x * sc, vy + p.y * sc]; };
  if (calErg.h) {
    // projektiv: Kreise werden zu Kurven -> Polygon; Speichen bleiben Geraden
    ctx.beginPath();
    for (let k = 0; k <= 72; k++) {
      const a = k / 72 * 2 * Math.PI;
      const [sx, sy] = zuScreen(Math.sin(a), -Math.cos(a));
      if (k === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(vx + calErg.cx * sc, vy + calErg.cy * sc, calErg.r * sc, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,196,122,.5)';
  for (let i = 0; i < 20; i++) {
    const a = (i * 18 - 9 + rot) * Math.PI / 180;
    const ex = calErg.h ? zuScreen(Math.sin(a), -Math.cos(a)) : [vx + (calErg.cx + Math.sin(a) * calErg.r) * sc, vy + (calErg.cy - Math.cos(a) * calErg.r) * sc];
    ctx.beginPath();
    ctx.moveTo(vx + calErg.cx * sc, vy + calErg.cy * sc);
    ctx.lineTo(ex[0], ex[1]);
    ctx.stroke();
  }
}
