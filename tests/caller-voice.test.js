import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------- Stubs (ALLE Tests STUMM — kein echtes Audio, kein echtes TTS) ----------
class FakeAudio {
  constructor() {
    this.src = ''; this.preload = ''; this.volume = 1; this.playbackRate = 1;
    this.currentTime = 0; this.paused = true;
    this._l = {};
    FakeAudio.all.push(this);
  }
  addEventListener(t, fn) { (this._l[t] = this._l[t] || []).push(fn); }
  removeEventListener(t, fn) { this._l[t] = (this._l[t] || []).filter(f => f !== fn); }
  load() { FakeAudio.loads.push(this.__loadedUrl || this.src); }
  play() {
    FakeAudio.played.push(this.__loadedUrl || this.src);
    FakeAudio.active++; FakeAudio.maxActive = Math.max(FakeAudio.maxActive, FakeAudio.active);
    if (FakeAudio.failUrls) {
      FakeAudio.active--; this.paused = true;
      return Promise.reject(new Error('kein Audio-Backend'));
    }
    return Promise.resolve().then(() => {
      this.paused = true; FakeAudio.active--;
      for (const fn of (this._l['ended'] || []).slice()) fn();
    });
  }
  pause() { this.paused = true; }
  static reset() {
    FakeAudio.all = []; FakeAudio.played = []; FakeAudio.loads = [];
    FakeAudio.active = 0; FakeAudio.maxActive = 0; FakeAudio.failUrls = false;
  }
}
FakeAudio.reset();

const tts = {
  speak: vi.fn(u => { Promise.resolve().then(() => { if (u.onend) u.onend(); }); }),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [])
};

async function loadModule() {
  vi.resetModules();
  return await import('../public/js/caller-voice.js');
}

beforeEach(() => {
  FakeAudio.reset();
  tts.speak.mockClear(); tts.cancel.mockClear();
  globalThis.Audio = FakeAudio;
  globalThis.window = { speechSynthesis: tts };
  globalThis.speechSynthesis = tts;
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
});
afterEach(() => {
  delete globalThis.Audio; delete globalThis.window;
  delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance;
});

const BASE = '/caller/elevenlabs-brian/en/';

describe('Caller-Voice: Zahlen + Momente (KAY 02.12.)', () => {
  it('Dart-Zahl: sc-Clip, kein speechSynthesis', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian', lang: 'en', checkout: true, dartCalls: true });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([BASE + 'sc-60.mp3']);
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Dart-Zahl bull/outer/miss: sc-50, sc-25, sc-0', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian', dartCalls: true });
    m.callDart({ k: 'bull', n: 25, v: 50 });
    m.callDart({ k: 'outer', n: 25, v: 25 });
    m.callDart({ k: 'miss', n: 0, v: 0 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([BASE + 'sc-50.mp3', BASE + 'sc-25.mp3', BASE + 'sc-0.mp3']);
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Rest 481: KEIN rest-Clip mehr (kein Gebrabbel)', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['t20', 't20', 's20'], points: 66 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([]);
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Moment 180: ph-180-Clip', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['t20', 't20', 't20'], visit180: true, points: 180 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([BASE + 'ph-180.mp3']);
  });

  it('Moment Beleidigung: ph-low bei points<=9', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['s1', 'miss', 'miss'], points: 1 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([BASE + 'ph-low-1.mp3']);
  });

  it('Gay: ph-gay-Clip', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['s1', 's5', 's20'], points: 26 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([BASE + 'ph-gay.mp3']);
  });

  it('FEHLENDER Clip: Stille — kein Auto-Mix mit der Geraetstimme', async () => {
    FakeAudio.failUrls = true;
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    await m.callerIdle();
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Kein Set-uebergreifender Stimm-Mix: nur URLs des gewaehlten Sets', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    await m.callerIdle();
    expect(FakeAudio.played.length).toBeGreaterThan(0);
    for (const url of FakeAudio.played) expect(url.startsWith('/caller/elevenlabs-brian/')).toBe(true);
  });

  it('Explizites Set "device": Web-Speech laeuft, aber kein Audio-Element', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'device' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([]);
    expect(tts.speak).toHaveBeenCalledTimes(1);
    expect(tts.speak.mock.calls[0][0].text).toBe('sixty');
  });

  it('Manifest enthaelt "Geraetstimme" als eigenes Set', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ sets: [{ id: 'elevenlabs-brian', label: 'Brian', full: true }] }) }));
    const m = await loadModule();
    const mf = await m.loadCallerManifest();
    expect(mf.sets.map(s => s.id)).toContain('device');
    expect(mf.sets[mf.sets.length - 1].label).toBe('Gerätstimme');
    delete globalThis.fetch;
  });
});

describe('Caller-Voice: strikt serielle Play-Engine', () => {
  it('Reihenfolge + Gaps: 3 Dart-Zahlen je 220ms Luft', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    const t0 = Date.now();
    const stamps = [];
    const origPlay = FakeAudio.prototype.play;
    FakeAudio.prototype.play = function () { stamps.push(Date.now() - t0); return origPlay.call(this); };
    m.callDart({ k: 'triple', n: 20, v: 60 });
    m.callDart({ k: 'triple', n: 19, v: 57 });
    m.callDart({ k: 'single', n: 20, v: 20 });
    await m.callerIdle();
    FakeAudio.prototype.play = origPlay;
    expect(FakeAudio.played).toEqual([BASE + 'sc-60.mp3', BASE + 'sc-57.mp3', BASE + 'sc-20.mp3']);
    expect(stamps[1] - stamps[0]).toBeGreaterThanOrEqual(200); // 220ms Gap
    expect(stamps[2] - stamps[1]).toBeGreaterThanOrEqual(200);
  });

  it('Niemals parallel: max. 1 aktives Audio-Element je Zeitpunkt', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    m.callDart({ k: 'triple', n: 19, v: 57 });
    await m.callerIdle();
    expect(FakeAudio.maxActive).toBe(1);
    expect(FakeAudio.played).toEqual([BASE + 'sc-60.mp3', BASE + 'sc-57.mp3']);
  });

  it('Element-Pool wird wiederverwendet, kein Element wird pausiert waehrend es spielt', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.warmAudioPool(4);
    m.callDart({ k: 'triple', n: 20, v: 60 });
    m.callDart({ k: 'triple', n: 19, v: 57 });
    m.callDart({ k: 'single', n: 20, v: 20 });
    await m.callerIdle();
    expect(FakeAudio.all.length).toBeLessThanOrEqual(4);
    expect(FakeAudio.played.length).toBe(3);
  });

  it('clearQueue stoppt sofort und blockiert callerIdle nicht', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    m.callDart({ k: 'triple', n: 19, v: 57 });
    m.clearQueue();
    await m.callerIdle();
    expect(FakeAudio.played.length).toBeLessThanOrEqual(1);
  });

  it('MURMEL-FIX: flushPending laesst den laufenden Clip KOMPLETT enden, fluechtige verfallen', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    m.callDart({ k: 'triple', n: 19, v: 57 }); // wartet
    m.flushPending(); // verwirft Wartenden, Laufender endet komplett
    await m.callerIdle();
    const plays = m.callerDebugLog().filter(e => e.ev === 'play').map(e => e.url);
    expect(plays).toEqual(['sc-60.mp3']);
  });

  it('PRIO: Moment (ph-180) ueberlebt, fluechtige Dart-Zahlen verfallen', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['t20', 't20', 't20'], visit180: true, points: 180 });
    m.callDart({ k: 'triple', n: 19, v: 57 });
    m.flushPending();
    await m.callerIdle();
    const plays = m.callerDebugLog().filter(e => e.ev === 'play').map(e => e.url);
    expect(plays).toContain('ph-180.mp3');
    expect(plays).not.toContain('sc-57.mp3');
  });

  it('PRIO: neues Moment ersetzt wartende alte Ansagen (nicht 2x stapeln)', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['t20', 't20', 't20'], visit180: true, points: 180 });
    m.callVisitEnd({ labels: ['s20', 'miss', 'miss'], bust: true, points: 20 });
    await m.callerIdle();
    const plays = m.callerDebugLog().filter(e => e.ev === 'play').map(e => e.url);
    // ph-180 lief schon, ph-bust ersetzt WARTENDE — kein Doppel-Stapeln:
    expect(plays).toEqual(['ph-180.mp3', 'ph-bust.mp3']);
  });

  it('callerBusyMs: >0 solange etwas wartet/spielt, 0 wenn idle', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd({ labels: ['t20', 't20', 't20'], visit180: true, points: 180 });
    expect(m.callerBusyMs()).toBeGreaterThan(0);
    await m.callerIdle();
    expect(m.callerBusyMs()).toBe(0);
  });
});
