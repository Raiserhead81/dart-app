// Beobachtet LIVE-Frames: alle 3s eine Messung, 10 Runden
const die = (m) => { console.log(m); process.exit(0); };
const PAGES = await fetch('http://127.0.0.1:9223/json/list', { signal: AbortSignal.timeout(6000) }).then(r => r.json()).catch(() => null);
if (!PAGES) die('CDP tot');
const page = PAGES.find(p => p.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const waiters = new Map(); const errors = [];
const send = (m, p = {}) => new Promise(res => { const i = ++id; waiters.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') errors.push('EXC ' + ((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0].slice(0, 120))); };
await new Promise(r => ws.onopen = r);
await send('Runtime.enable');
const ev = async (e) => { try { return (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value; } catch { return '?'; } };
const MESS = `(async () => {
  const v = document.querySelector('#camhost video') || document.querySelector('video');
  if (!v || !v.videoWidth) return 'kein video';
  const zielW = 270;
  const c = document.createElement('canvas');
  c.width = zielW; c.height = Math.round(zielW * v.videoHeight / v.videoWidth);
  c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, zielW, c.height);
  const data = c.getContext('2d').getImageData(0, 0, zielW, c.height);
  const eng = await import('/js/core/camera-engine.js');
  const e = eng.analyseBoardInFrame(data);
  let hell = 0, n = 0;
  for (let i = 0; i < data.data.length; i += 4 * 997) { hell += (data.data[i] + data.data[i + 1] + data.data[i + 2]) / 3; n++; }
  hell = Math.round(hell / n);
  return 'hell=' + hell + ' q=' + (e ? e.qualitaet : 'null') + ' r=' + (e ? Math.round(e.r) : '-') + '/' + (e ? Math.round(e.rx || 0) + 'x' + Math.round(e.ry || 0) : '-') + ' cx=' + (e ? Math.round(e.cx) : '-') + ',cy=' + (e ? Math.round(e.cy) : '-') + (e ? '' : ' KEIN FIT');
})()`;
for (let r = 1; r <= 10; r++) {
  const t = new Date().toLocaleTimeString('de-DE');
  console.log(t, await ev(MESS));
  if (errors.length) { console.log(errors.slice(0, 3).join(' || ')); errors.length = 0; }
  await new Promise(s => setTimeout(s, 3000));
}
process.exit(0);
