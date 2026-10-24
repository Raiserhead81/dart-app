import { describe, it, expect } from 'vitest';
import { tapZuVideoPixel, setEngineCal, segVonPixel } from '../src/camera-engine.js';

describe('Tap-Kette: Finger -> Video -> Feld (zoom- und contain-sicher)', () => {
  // Beispiel: Video 1080x1920 im Element 360x640 (contain), Board kalibriert Mitte/540,960 R=300
  const videoW = 1080, videoH = 1920, ow = 360, oh = 640;

  it('Tap auf die Videomitte (zoom 1) -> Videopixel Mitte', () => {
    const erg = tapZuVideoPixel(180, 320, 0, 0, 360, 640, ow, oh, videoW, videoH, 1);
    expect(Math.abs(erg.x - 540)).toBeLessThan(2);
    expect(Math.abs(erg.y - 960)).toBeLessThan(2);
  });

  it('Tap aufs BULL (zoom 1) -> BULL gezaehlt', () => {
    setEngineCal({ cx: 540, cy: 960, r: 300 });
    const p = tapZuVideoPixel(180, 320, 0, 0, 360, 640, ow, oh, videoW, videoH, 1);
    const seg = segVonPixel(p.x, p.y);
    expect(seg?.label).toBe('BULL');
  });

  it('Tap auf T20-Punkt (zoom 1): direkt ueberm Bull in Triple-Hoehe -> T20', () => {
    setEngineCal({ cx: 540, cy: 960, r: 300 });
    // Video-Punkt (540, 960-0.58*300=786) -> Anzeige: contain sc=min(360/1080,640/1920)=0.333; x=540*.333+0=180; y=786*.333=262
    const p = tapZuVideoPixel(180, 262, 0, 0, 360, 640, ow, oh, videoW, videoH, 1);
    const seg = segVonPixel(p.x, p.y);
    expect(seg?.label).toBe('T20');
  });

  it('Zoom 2x: Tap auf denselben SCREEN-Punkt wie beim T20-Test trifft T20 trotz vergroesserter Darstellung', () => {
    setEngineCal({ cx: 540, cy: 960, r: 300 });
    // Bei zoom 2 waere das Video doppelt so gross dargestellt; rect entspricht der SKALIERTEN Box
    // (rectW=720, rectH=1280). Der T20-Anzeige-Punkt verschiebt sich entsprechend:
    const p = tapZuVideoPixel(360, 524, 0, 0, 720, 1280, ow, oh, videoW, videoH, 2);
    const seg = segVonPixel(p.x, p.y);
    expect(seg?.label).toBe('T20');
  });

  it('D6: rechts im Doppelring (zoom 1)', () => {
    setEngineCal({ cx: 540, cy: 960, r: 300 });
    // Video-Punkt (540+0.96*300=828, 960) -> Anzeige x=828*.333=276, y=320
    const p = tapZuVideoPixel(276, 320, 0, 0, 360, 640, ow, oh, videoW, videoH, 1);
    const seg = segVonPixel(p.x, p.y);
    expect(seg?.label).toBe('D6');
  });
});
