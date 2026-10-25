import { describe, it, expect } from 'vitest';
import { lerneAusKorrektur, segVonPixel, baueHomographie, setEngineCal, normierraumZuBild } from '../src/camera-engine.js';

// Referenz-Kalibrierung (Bild 320x240): Board mittig, r=90, WAHRE Rotation 0
function basisCal() {
  return { cx: 160, cy: 120, r: 90, rx: 90, ry: 90, theta: 0, rot: 0 };
}
// Echter Trefferpunkt im BILD: Scheibenwinkel ang (Grad ab 12 Uhr cw), rel. Radius rr
function bildPunkt(calWahr, ang, rr) {
  const a = ang * Math.PI / 180;
  return { x: calWahr.cx + Math.sin(a) * rr * calWahr.rx, y: calWahr.cy - Math.cos(a) * rr * calWahr.ry };
}

describe('lerneAusKorrektur', () => {
  it('lernt Rotation: App glaubt rot=10 Grad, echt 0, Pfeil bei -6 Grad', () => {
    const wahr = basisCal();
    const falsch = { ...basisCal(), rot: 10 };
    const p = bildPunkt(wahr, -6, 0.578); // realer T20-Pfeil (Sektor 20: -9..+9)
    const erg = lerneAusKorrektur(p.x, p.y, 'triple', 20, falsch);
    expect(erg).toBeTruthy();
    expect(Math.abs(erg.rot)).toBeLessThan(10); // Richtung 0
    // Nach dem Lernen zaehlt derselbe echte Pixel wieder T20
    setEngineCal(erg);
    expect(segVonPixel(p.x, p.y, erg).label).toBe('T20');
  });

  it('lernt Radius: 15 % zu grosse Kalibrierung schrumpft Richtung Wahrheit', () => {
    const wahr = basisCal();
    const falsch = { ...basisCal(), rx: 103.5, ry: 103.5, r: 103.5 };
    const p = bildPunkt(wahr, 0, 0.28); // realer S20-Pfeil
    const erg = lerneAusKorrektur(p.x, p.y, 'single', 20, falsch);
    expect(erg).toBeTruthy();
    expect(erg.rx).toBeLessThan(103.5); // schrumpft
    expect(erg.rx).toBeGreaterThan(89); // aber nicht uebers Ziel
  });

  it('Fehltipp-Schutz: Pfeil weit ausserhalb -> kein Lernen', () => {
    const cal = basisCal();
    const p = { x: cal.cx + 150, y: cal.cy }; // r=1.67
    expect(lerneAusKorrektur(p.x, p.y, 'single', 20, cal)).toBeNull();
  });

  it('Fehltipp-Schutz: 2 Sektoren daneben getippt -> kein Rot-Lernen', () => {
    const cal = basisCal();
    const p = bildPunkt(cal, 39, 0.56);     // sitzt real nahe Sektor 3-Mitte (36)
    const erg = lerneAusKorrektur(p.x, p.y, 'triple', 20, cal); // Kay meint T20
    expect(erg).toBeTruthy();              // Radiuslernen ok (0.56 -> 0.578)
    expect(erg.rot).toBe(0);               // Rotation NICHT verbiegen
  });

  it('bull/25: kein Rot-Lernen, aber Radius lernen', () => {
    const wahr = basisCal();
    const falsch = { ...basisCal(), rx: 103.5, ry: 103.5, r: 103.5 };
    const p = bildPunkt(wahr, 0, 0.019); // echter Bull-Pfeil
    const erg = lerneAusKorrektur(p.x, p.y, 'bull', 50, falsch);
    expect(erg).toBeTruthy();
    expect(erg.rx).toBeLessThan(103.5);
    expect(erg.rot).toBe(0);
  });

  it('Homographie konsistent: h wird bei Radius-Lernen mitgebaut, Feld bleibt T20', () => {
    const h90 = baueHomographie(160, 120, 90, 70, 0.1, 158, 116);
    const h81 = baueHomographie(160, 120, 81, 63, 0.1, 158.2, 116.2);
    const calWahr = { cx: 160, cy: 120, r: 90, rx: 90, ry: 70, theta: 0.1, rot: 0, h: h90 };
    const calKlein = { cx: 160, cy: 120, r: 81, rx: 81, ry: 63, theta: 0.1, rot: 0, h: h81 };
    // Echter T20-Pfeil im Bild (unter WAHRER Kalibrierung r=0.578):
    const bp = normierraumZuBild(0, -0.578, calWahr); // v-negativ = 12 Uhr
    // App mit zu kleiner Kalibrierung sieht ihn zu weit aussen, Kay sagt T20.
    // Drei Korrekturen wie im echten Spiel (Dämpfung 35 %/50 % pro Schritt):
    let calL = calKlein;
    for (let i = 0; i < 3; i++) {
      const e = lerneAusKorrektur(bp.x, bp.y, 'triple', 20, calL);
      if (!e) break;
      calL = e;
    }
    expect(calL.rx).toBeGreaterThan(81);   // waechst Richtung 90
    expect(calL.h).toBeTruthy();           // Homographie neu gebaut
    const s = segVonPixel(bp.x, bp.y, calL);
    expect(s && s.label).toBe('T20');      // konvergiert: Punkt zaehlt T20
  });
});
