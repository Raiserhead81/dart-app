// KAMERA-ASSISTENT (KAY 24.10.): Handy ~1m vor der Scheibe, digitaler Zoom fuer
// den Blick, Erkennung im VOLLBILD. Kalibrierung: Bull tippen + aeussere
// Doppelkante antippen => Mitte/Radius => Segmente berechenbar.
// Auto-Zaehlung: Diff-Frames pro Wurf => Pfeilspitze => Feld => Callback.

import { el } from '/js/util.js';
import { store } from '/js/app.js';

import { segVonPixel as _segVonPixel, findeNeuenPfeil as _finde, setEngineCal } from '/js/core/camera-engine.js';

let stream = null, video = null, canvas = null, ctx = null;
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

export async function startCam() {
  if (stream) { // Stream laeuft evtl. schon (alter View) -> NEUES Video anbinden!
    video.srcObject = stream;
    try { await video.play(); } catch (e) {}
    return true;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false
    });
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
  const frame = el('div', { style: 'height:clamp(300px,52vh,480px);aspect-ratio:9/16;width:auto;margin:0 auto;overflow:hidden;border-radius:14px;background:#000;position:relative' });
  const v = el('video', { autoplay: '', playsinline: '', muted: '', style: 'width:100%;height:100%;object-fit:cover;display:block;transform-origin:center' });
  // KAY: Start MAXIMAL weit draussen (0,4x), dann gezielt reinziehen
  const zoomLabel = el('span', { class: 'small muted', style: 'float:right' }, '0,4x');
  const zoom = el('input', { type: 'range', min: 40, max: 500, value: 40, step: 5, style: 'width:100%;margin:6px 0 0' });
  v.style.transform = 'scale(0.4)';
  zoom.oninput = () => { v.style.transform = `scale(${zoom.value / 100})`; zoomLabel.textContent = (zoom.value / 100).toFixed(1).replace('.', ',') + 'x'; };
  const note = el('div', { class: 'small muted', style: 'text-align:center;margin-top:2px;font-size:10.5px;line-height:1.25' }, 'Kamera startet…');
  frame.append(v);
  const zoomRow = el('div', {}, zoomLabel);
  host.append(frame, zoomRow, zoom, note);
  video = v; // Modul-Referenz fuer frameGrab/startAuto
  const phase = { m: 'idle' };
  v.onclick = async (ev) => {
    if (phase.m !== 'kalib') return;
    const r = v.getBoundingClientRect();
    // object-fit: COVER -> sichtbarer Video-Ausschnitt innerhalb des Elements
    const sc = Math.max(r.width / (v.videoWidth || r.width), r.height / (v.videoHeight || r.height));
    const offX = (r.width - (v.videoWidth || r.width) * sc) / 2;
    const offY = (r.height - (v.videoHeight || r.height) * sc) / 2;
    const px = (ev.clientX - r.left - offX) / sc;
    const py = (ev.clientY - r.top - offY) / sc;
    if (!cal) { cal = { cx: px, cy: py, r: 100 }; note.textContent = 'Jetzt UNTERE Doppel-Aussenseite antippen'; }
    else if (cal.r === 100 && py !== cal.cy) {
      cal.r = Math.abs(py - cal.cy);
      saveCal();
      note.textContent = 'Kalibriert! Kamera zaehlt jetzt selbst mit.';
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

export function unmountCam() {
  stopAuto();
  stopCam();
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

  startBtn.onclick = async () => {
    status.textContent = 'starte Kamera…';
    if (await startCam()) {
      video.style.display = '';
      zoom.style.display = '';
      status.textContent = 'Kalibrierung: Tippe auf das BULL-Zentrum';
      phase.mode = 'kalib-bull';
      startBtn.style.display = 'none';
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
      el('h2', {}, 'Scheibe filmen', el('span', { class: 'sub' }, 'Handy ~1m davor, Zoom fuer den Blick')),
      host, zoom, status, startBtn, refBtn, erkenne,
      el('p', { class: 'small muted mt' }, 'Test-Modus: kalibrieren, Referenz, werfen, erkennen. Auto-Zaehlung im Spiel folgt als nächster Schritt.')
    )
  );
}
