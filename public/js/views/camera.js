// KAMERA-ASSISTENT (KAY 24.10.): Handy ~1m vor der Scheibe, digitaler Zoom fuer
// den Blick, Erkennung im VOLLBILD. Kalibrierung: Bull tippen + aeussere
// Doppelkante antippen => Mitte/Radius => Segmente berechenbar.
// Auto-Zaehlung: Diff-Frames pro Wurf => Pfeilspitze => Feld => Callback.

import { el } from '/js/util.js';
import { store } from '/js/app.js';

const SEKTORZAHLEN = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const RINGE = { bull: 0.037, bull25: 0.094, tripleIn: 0.527, tripleOut: 0.63, doubleIn: 0.92, doubleOut: 1.0 };

let stream = null, video = null, canvas = null, ctx = null;
let cal = null; // {cx, cy, r}
let baseFrame = null; // ImageData vor dem Wurf

export function segVonPixel(x, y, c) {
  const dx = x - c.cx, dy = y - c.cy;
  const r = Math.sqrt(dx * dx + dy * dy) / c.r;
  if (r > 1.06) return null;
  if (r <= RINGE.bull) return { k: 'bull', n: 50, v: 50, label: 'BULL' };
  if (r <= RINGE.bull25) return { k: 'outer', n: 25, v: 25, label: '25' };
  // Winkel: 20 steht oben, Sektoren gegen den Uhrzeigersinn je 18°
  let ang = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = oben, + = rechts
  if (ang < 0) ang += 360;
  const idx = Math.round(ang / 18) % 20;
  const zahl = SEKTORZAHLEN[idx];
  if (r <= RINGE.tripleIn) return { k: 'single', n: zahl, v: zahl, label: 'S' + zahl };
  if (r <= RINGE.tripleOut) return { k: 'triple', n: zahl, v: zahl * 3, label: 'T' + zahl };
  if (r <= RINGE.doubleIn) return { k: 'single', n: zahl, v: zahl, label: 'S' + zahl };
  if (r <= RINGE.doubleOut) return { k: 'double', n: zahl, v: zahl * 2, label: 'D' + zahl };
  return null;
}

function frameGrab() {
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

// Diff: neuen dunklen Punkt finden (Pfeilspitze). Liefert {x, y, staerke} oder null.
export function findeNeuenPfeil(a, b) {
  if (!a || !b || a.width !== b.width) return null;
  const A = a.data, B = b.data;
  let bestX = -1, bestY = -1, bestScore = 0;
  const step = 3; //Pixel-Raster
  const minR = cal ? cal.r * 0.02 : 5;
  for (let y = 0; y < a.height; y += step) {
    for (let x = 0; x < a.width; x += step) {
      const i = (y * a.width + x) * 4;
      const dA = A[i] + A[i + 1] + A[i + 2];
      const dB = B[i] + B[i + 1] + B[i + 2];
      const dunkler = dA - dB; // neuer Pfeil macht Pixel dunkler
      if (dunkler > 140) {
        const score = dunkler;
        if (score > bestScore) { bestScore = score; bestX = x; bestY = y; }
      }
    }
  }
  if (bestX < 0 || bestScore < 160) return null;
  return { x: bestX, y: bestY, staerke: bestScore };
}

export async function startCam() {
  if (stream) return true;
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
