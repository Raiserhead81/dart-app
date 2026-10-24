// KAMERA-ASSISTENT (KAY 24.10.): Handy ~1m vor der Scheibe, digitaler Zoom fuer
// den Blick, Erkennung im VOLLBILD. Kalibrierung: Bull tippen + aeussere
// Doppelkante antippen => Mitte/Radius => Segmente berechenbar.
// Auto-Zaehlung: Diff-Frames pro Wurf => Pfeilspitze => Feld => Callback.

import { el } from '/js/util.js';
import { store } from '/js/app.js';

import { segVonPixel as _segVonPixel, findeNeuenPfeil as _finde, setEngineCal } from '/js/core/camera-engine.js';

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
      video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
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
export function setCal(c) { cal = c; }
export function loadCal() {
  const c = store?.state?.settings?.cameraCal;
  if (c && c.cx && c.r) { cal = c; return true; }
  return false;
}
export function istKalibriert() { return !!cal; }

// AUTO-MODUS: pollt Frames, findet NEUE Pfeile (stabil = 2 Treffer gleiche Stelle),
// ruft onThrow(seg) und aktualisiert das Referenzbild. stopAuto() beendet.
let autoTimer = null, autoBusy = false;
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
          // 2 Frames stabil + gueltiges Segment => Wurf!
          onThrow(seg);
          lastFrame = frameGrab();
          pending = null;
        } else {
          pending = { x: p.x, y: p.y, count: selbeStelle ? pending.count + 1 : 0 };
        }
      } else if (!p) {
        pending = null;
      }
    } catch (e) { /* Frame-Drop */ }
    autoBusy = false;
  }, 850);
  if (onStatus) onStatus('live');
}
export function stopAuto() { if (autoTimer) { clearInterval(autoTimer); autoTimer = null; } }
export function camCal() { return cal; }

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
  
  zoom.oninput = () => { v.style.transform = `scale(${zoom.value / 100})`; zoomLabel.textContent = (zoom.value / 100).toFixed(1).replace('.', ',') + 'x'; };
  const note = el('div', { class: 'small muted', style: 'text-align:center;margin-top:2px;font-size:10.5px;line-height:1.25' }, 'Kamera startet…');
  frame.append(v);
  // KAY: Ansicht startet IMMER weit draussen (0,5x) - dann gezielt reinzoomen
  zoom.value = 50; zoomLabel.textContent = '0,5x'; v.style.transform = 'scale(0.5)';
  const zoomRow = el('div', {}, zoomLabel);
  host.append(frame, zoomRow, zoom, note);
  video = v; // Modul-Referenz fuer frameGrab/startAuto
  const phase = { m: 'idle' };
  v.onclick = async (ev) => {
    if (phase.m !== 'kalib' && phase.m !== 'kalib-check') return;
    // ZOOM-SICHER (wie tapEingabe): offset-Masse + entzoomen vor contain-Mapping
    const ow = v.offsetWidth || v.videoWidth, oh = v.offsetHeight || v.videoHeight;
    const rect = v.getBoundingClientRect();
    const zoom = v.style.transform ? (parseFloat(v.style.transform.replace(/[^\d.]/g, '')) || 1) : 1;
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
    if (!cal) { if (onKalibHinweis) onKalibHinweis(); return; }
    // Zoom-sichere Umrechnung: offsetWidth = UNVERAENDERTE Elementgroesse,
    // getBoundingClientRect = skaliert. Tap erst entzoomen, dann contain-mappen.
    const ow = videoEl.offsetWidth || videoEl.videoWidth, oh = videoEl.offsetHeight || videoEl.videoHeight;
    const rect = videoEl.getBoundingClientRect();
    const zoom = videoEl.style.transform ? (parseFloat(videoEl.style.transform.replace(/[^\d.]/g, '')) || 1) : 1;
    const lx = (ev.clientX - rect.left) / zoom;
    const ly = (ev.clientY - rect.top) / zoom;
    const sc = Math.min(ow / (videoEl.videoWidth || ow), oh / (videoEl.videoHeight || oh));
    const offX = (ow - (videoEl.videoWidth || ow) * sc) / 2;
    const offY = (oh - (videoEl.videoHeight || oh) * sc) / 2;
    const px = (lx - offX) / sc;
    const py = (ly - offY) / sc;
    const seg = segVonPixel(px, py, cal);
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
      status.textContent = 'Kalibrierung: Tippe auf das BULL-Zentrum';
      phase.mode = 'kalib-bull';
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
    const z = zoom.value / 100;
    video.style.transform = `scale(${z})`;
    video.style.transformOrigin = 'center';
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
function analyseBoardInFrame(img) {
  // img: ImageData (runterskaliert ~270px breit). Liefert {cx, cy, r} oder null.
  const W = img.width, H = img.height, D = img.data;
  let sx = 0, sy = 0, n = 0;
  const punkte = [];
  for (let y = 2; y < H - 2; y += 2) {
    for (let x = 2; x < W - 2; x += 2) {
      const i = (y * W + x) * 4;
      const r = D[i], g = D[i + 1], b = D[i + 2];
      const istRot = r > 70 && r > g + 28 && r > b + 28;
      const istGruen = g > 45 && g > r + 16 && g > b + 6 && (g + r) > 90;
      if (istRot || istGruen) { punkte.push([x, y]); sx += x; sy += y; n++; }
    }
  }
  if (n < 40) return null;
  let cx = sx / n, cy = sy / n;
  // 2 Runden Verfeinerung: Ausreisser raus, neu mitteln, Radius aus 97%-Quantil
  for (let runde = 0; runde < 2; runde++) {
    const dists = punkte.map(p => Math.hypot(p[0] - cx, p[1] - cy));
    dists.sort((a, b) => a - b);
    const rMax = dists[Math.floor(dists.length * 0.97)] || 0;
    const innen = punkte.filter((p, i) => dists[i] <= rMax * 1.02);
    cx = innen.reduce((a, p) => a + p[0], 0) / innen.length;
    cy = innen.reduce((a, p) => a + p[1], 0) / innen.length;
    punkte.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
  }
  const dists2 = punkte.map(p => Math.hypot(p[0] - cx, p[1] - cy)).sort((a, b) => a - b);
  let r = dists2[Math.floor(dists2.length * 0.97)];
  // Double-Aussenkante = aeusserste R/G-Pixel => r ist bereits der Board-Radius
  return { cx, cy, r, n: punkte.length };
}

export function autoKalibriere(videoEl) {
  // 5 Frames im Abstand analysieren, Median aus den guten Ergebnissen
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
        if (e && e.r > 25 && e.r < zielW * 0.75) ergs.push(e);
      } catch (err) { /* Frame-Drop */ }
      await new Promise(r => setTimeout(r, 250));
    }
    if (ergs.length < 3) { resolve(null); return; }
    const med = (arr, key) => { const v = arr.map(e => e[key]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
    const skal = videoEl.videoWidth / 270;
    resolve({ cx: med(ergs, 'cx') * skal, cy: med(ergs, 'cy') * skal, r: med(ergs, 'r') * skal });
  });
}
