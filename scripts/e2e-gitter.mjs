import { chromium } from 'playwright';
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:8077/#/profile', { waitUntil: 'networkidle' });
const t = await p.evaluate(async () => {
  const cam = await import('/js/views/camera.js');
  const eng = await import('/js/core/camera-engine.js');
  return { gitterTest: typeof cam.gitterTest, vermesseScheibe: typeof eng.vermesseScheibe, ringe: typeof eng.RINGE === 'object' };
});
console.log('IMPORTS', JSON.stringify(t));
console.log('ERRORS', errs.length ? errs.join(' | ') : 'KEINE');
await b.close();
