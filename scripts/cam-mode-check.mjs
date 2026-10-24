import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const page = await (await browser.newContext({ viewport: { width: 360, height: 752 } })).newPage();
await page.goto('https://dart.gemivo.de/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
// Session mit Kamera direkt anlegen
await page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem('dartpro.v1') || '{}');
  st.session = { type: 'x01', useCamera: true, useBoard: false, snapshots: [], date: new Date().toISOString(),
    state: { start: 501, doubleOut: true, doubleIn: false, firstTo: 3, setsTo: 0, current: 0, finished: false, legNo: 1,
      players: [{ name: 'Kay' }], throws: [[]], legsWon: [0], setsWon: [0], legEvents: [],
      leg: { remaining: [501], visit: [], visitThrows: [], visitStart: 501, started: [false], dartsInLeg: [0], legNo: 1 } } };
  localStorage.setItem('dartpro.v1', JSON.stringify(st));
});
await page.reload(); await page.waitForTimeout(2500);
const d = await page.evaluate(() => {
  const gtop = document.querySelector('.gtop');
  const btns = gtop ? [...gtop.querySelectorAll('.gbtn')].map(b => b.textContent.trim()) : [];
  const vg = document.querySelector('.view-game');
  const cam = document.getElementById('camhost');
  const beenden = document.querySelector('.gtop .gbtn.danger');
  return {
    camhostDa: !!cam, camHoehe: cam ? Math.round(cam.getBoundingClientRect().height) : 0,
    gtopDa: !!gtop, buttons: btns,
    beendenSichtbar: beenden ? beenden.getBoundingClientRect().bottom <= innerHeight : false,
    scale: vg?.style.transform || '1',
    screenH: innerHeight
  };
});
console.log(JSON.stringify(d, null, 1));
await page.screenshot({ path: '/tmp/cam-mode.png' });
await browser.close();
