// LIVE-Blick in die Oppo-WebView via CDP (Port 9223), mit harten Timeouts
const die = (m) => { console.log(m); process.exit(0); };
const PAGES = await fetch('http://127.0.0.1:9223/json/list', { signal: AbortSignal.timeout(6000) })
  .then(r => r.json()).catch(() => null);
if (!PAGES) die('CDP tot (Display aus?)');
const page = PAGES.find(p => p.type === 'page');
if (!page) die('KEINE PAGE');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const waiters = new Map(); const errors = [];
const send = (method, params = {}) => new Promise(res => {
  const i = ++id; waiters.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && waiters.has(m.id)) { waiters.get(m.id)(m.result); waiters.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').split('\n')[0].slice(0, 150));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console: ' + (m.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 150));
};
const opened = await Promise.race([new Promise(r => ws.onopen = r), new Promise(r => setTimeout(() => r('timeout'), 6000))]);
if (opened === 'timeout') die('WS-Connect haengt');
setTimeout(() => { console.log('EXCEPTIONS:', errors.length ? errors.slice(0, 5).join(' || ') : 'KEINE'); process.exit(0); }, 6000);
await send('Runtime.enable');
const ev = async (e) => { try { return (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.value; } catch { return '?'; } };
console.log('URL     :', await ev('location.href'));
console.log('VERSION :', await ev('fetch("/VERSION").then(r=>r.text()).catch(()=>"ERR")'));
console.log('TEXT    :', ((await ev('document.body.innerText')) || '').replace(/\n+/g, ' | ').slice(0, 260));
console.log('VIDEO   :', await ev('[...document.querySelectorAll("video")].map(v=>v.videoWidth+"x"+v.videoHeight+" ready:"+v.readyState).join(" ; ")||"kein video"'));
console.log('REGler  :', await ev('[...document.querySelectorAll("input[type=range]")].map(r=>"val:"+r.value+" sichtbar:"+(r.offsetParent!==null)).join(" ; ")||"kein slider"'));
