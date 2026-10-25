// LICHT-REPRO: False Negative des Qualitaets-Gates bei viel Licht messen
// Node-only: malt Board als RGBA-Array, ruft analyseBoardInFrame direkt.
import { analyseBoardInFrame } from '../src/camera-engine.js';

const W = 1280, H = 720;
const SEK = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const RINGE = { bull: 0.037, bull25: 0.094, tripleIn: 0.527, tripleOut: 0.63, doubleIn: 0.92, doubleOut: 1.0 };
const F = { creme: [222, 204, 158], schwarz: [30, 28, 27], rot: [168, 28, 32], gruen: [24, 98, 44], rand: [15, 14, 13] };

function maleBoard(bg, blend) {
  const D = new Uint8ClampedArray(W * H * 4);
  const cx = 640, cy = 360, R = 330;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let px = [0, 1, 2].map(k => bg[k]);
      const dx = x - cx, dy = y - cy, rr = Math.sqrt(dx * dx + dy * dy) / R;
      const ang = (Math.atan2(-dy, dx) * 180 / Math.PI + 360 + 9) % 360; // oben=0
      if (rr <= 1.0) {
        const sekIdx = Math.floor(ang / 18) % 20;
        const gerade = SEK[sekIdx] % 2 === 0; // 20er oben, gerade Sektoren dunkel
        if (rr <= RINGE.bull) px = F.rot;
        else if (rr <= RINGE.bull25) px = F.gruen;
        else if (rr <= RINGE.tripleIn) px = gerade ? F.schwarz : F.creme;
        else if (rr <= RINGE.tripleOut) px = gerade ? F.rot : F.gruen;
        else if (rr <= RINGE.doubleIn) px = gerade ? F.schwarz : F.creme;
        else if (rr <= RINGE.doubleOut) px = gerade ? F.rot : F.gruen;
        else px = F.rand; // Spider-Ring/Rand
      } else if (rr <= 1.045) px = F.rand;
      // Ueberbelichtung: Richtung Weiss mischen
      px = px.map(c => c * (1 - blend) + 255 * blend);
      const i = (y * W + x) * 4;
      D[i] = px[0]; D[i + 1] = px[1]; D[i + 2] = px[2]; D[i + 3] = 255;
    }
  }
  return { data: D, width: W, height: H };
}

const scenen = [
  ['A dunkler Raum (Baseline)', [40, 38, 36], 0],
  ['B helle Wand, Board normal', [180, 177, 172], 0],
  ['C Ueberbelichtet 30%', [40, 38, 36], 0.30],
  ['D Ueberbelichtet 50%', [40, 38, 36], 0.50],
  ['E viel Licht: hell + 30% blend', [180, 177, 172], 0.30],
];
for (const [name, bg, blend] of scenen) {
  const erg = analyseBoardInFrame(maleBoard(bg, blend));
  console.log(name.padEnd(30), erg ? `q=${String(erg.qualitaet).padStart(3)} ring=${erg.ringAnteil} alt=${erg.alternanz} rand=${erg.randDunkel} bal=${erg.balance}` : 'NULL');
}
