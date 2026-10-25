// LIVE-Frame-Diagnose: was sieht die Engine im echten Oppo-Kamerabild?
const die = (m) => { console.log(m); process.exit(0); };
const PAGES = await fetch('http://127.0.0.1:9223/json/list', { signal: AbortSignal.timeout(6000) })
  .then(r => r.json()).catch(() => null);
if (!PAGES) die('CDP tot');
const page = PAGES.find(p => p.type === 'page');
if (!page) die('KEINE PAGE');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const waiters = new Map();
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; waiters.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); } };
const opened = await Promise.race([new Promise(r => ws.onopen = r), new Promise(r => setTimeout(() => r('timeout'), 6000))]);
if (opened === 'timeout') die('WS-Connect haengt');
setTimeout(() => process.exit(0), 15000);
await send('Runtime.enable');
const ev = async (e) => { try { return (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value; } catch (e2) { return 'ERR ' + e2.message; } };

const ERG = await ev(`(async () => {
  const v = document.querySelector('#camhost video') || document.querySelector('video');
  if (!v || !v.videoWidth) return JSON.stringify({ video: 'KEIN VIDEO' });
  const zielW = 270;
  const c = document.createElement('canvas');
  c.width = zielW; c.height = Math.round(zielW * v.videoHeight / v.videoWidth);
  c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, zielW, c.height);
  const data = c.getContext('2d').getImageData(0, 0, zielW, c.height);
  const eng = await import('/js/core/camera-engine.js');
  const e = eng.analyseBoardInFrame(data);
  let hell = 0, n = 0, mn = 999, mx = 0;
  for (let i = 0; i < data.data.length; i += 4 * 997) {
    const l = (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3;
    hell += l; n++; if (l < mn) mn = l; if (l > mx) mx = l;
  }
  return JSON.stringify({
    video: v.videoWidth + 'x' + v.videoHeight,
    hell: Math.round(hell / n), min: Math.round(mn), max: Math.round(mx),
    engine: e ? { q: e.qualitaet, cx: Math.round(e.cx), cy: Math.round(e.cy), r: Math.round(e.r), rx: Math.round(e.rx || 0), ry: Math.round(e.ry || 0), rot: Math.round(e.rot || 0), ringAnteil: e.ringAnteil, altAnteil: e.altAnteil } : null
  });
})()`);
console.log('DIAG:', ERG);
process.exit(0);
