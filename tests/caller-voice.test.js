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

describe('Caller-Voice: Fallback-AUS (Kays Ton-Bug)', () => {
  it('Visit mit Rest > 170: rest-Clip wird gespielt, NULL speechSynthesis-Aufruf', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian', lang: 'en', checkout: true, dartCalls: true });
    m.callVisitEnd(361, { labels: ['t20'] });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([
      '/caller/elevenlabs-brian/en/seg-t20.mp3',
      '/caller/elevenlabs-brian/en/rest-361.mp3'
    ]);
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Rest 481 (Kays Beispiel): rest-481 angefragt, 0 TTS', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(481, { labels: ['t20', 't20', 's20', 's20', 's20', 'miss', 't20'] });
    await m.callerIdle();
    expect(FakeAudio.played[FakeAudio.played.length - 1]).toBe('/caller/elevenlabs-brian/en/rest-481.mp3');
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('FEHLENDER Clip (Fehlerfall): Stille — kein Auto-Mix mit der Gerätstimme', async () => {
    FakeAudio.failUrls = true;
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(361, { labels: ['t20'] });
    await m.callerIdle();
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Kein Set-übergreifender Stimm-Mix: nur URLs des gewählten Sets', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(40, { forMatch: true, labels: ['s20', 's20'] });
    await m.callerIdle();
    for (const url of FakeAudio.played) expect(url.startsWith('/caller/elevenlabs-brian/')).toBe(true);
    expect(FakeAudio.played[FakeAudio.played.length - 1]).toBe('/caller/elevenlabs-brian/en/dx-D20-match.mp3');
  });

  it('Explizites Set "device": Web-Speech läuft, aber kein Audio-Element', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'device' });
    m.callVisitEnd(361, { labels: ['t20'] });
    await m.callerIdle();
    expect(FakeAudio.played).toEqual([]);
    expect(tts.speak).toHaveBeenCalledTimes(2); // seg-t20 + rest-361
  });

  it('Manifest enthält "Gerätstimme" als eigenes Set', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ sets: [{ id: 'elevenlabs-brian', label: 'Brian', full: true }] }) }));
    const m = await loadModule();
    const mf = await m.loadCallerManifest();
    expect(mf.sets.map(s => s.id)).toContain('device');
    expect(mf.sets[mf.sets.length - 1].label).toBe('Gerätstimme');
    delete globalThis.fetch;
  });
});

describe('Caller-Voice: strikt serielle Play-Engine', () => {
  it('Reihenfolge + Gaps unverändert: Dart-Calls einzeln (220ms), Rest +400ms', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    const t0 = Date.now();
    const stamps = [];
    const origPlay = FakeAudio.prototype.play;
    FakeAudio.prototype.play = function () { stamps.push(Date.now() - t0); return origPlay.call(this); };
    m.callVisitEnd(361, { labels: ['t20', 't20', 's20'] });
    await m.callerIdle();
    FakeAudio.prototype.play = origPlay;
    expect(FakeAudio.played).toEqual([
      '/caller/elevenlabs-brian/en/seg-t20.mp3',
      '/caller/elevenlabs-brian/en/seg-t20.mp3',
      '/caller/elevenlabs-brian/en/seg-s20.mp3',
      '/caller/elevenlabs-brian/en/rest-361.mp3'
    ]);
    expect(stamps[1] - stamps[0]).toBeGreaterThanOrEqual(200); // GAP_DART 220
    expect(stamps[2] - stamps[1]).toBeGreaterThanOrEqual(200);
    expect(stamps[3] - stamps[2]).toBeGreaterThanOrEqual(380); // GAP_AFTER_DARTS 400
  });

  it('Niemals parallel: max. 1 aktives Audio-Element je Zeitpunkt', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(96, { labels: ['t20', 't15'] });
    m.callDart({ k: 'sum', v: 60 }); // zweite Queue-Quelle während der ersten
    await m.callerIdle();
    expect(FakeAudio.maxActive).toBe(1);
    expect(tts.speak).toHaveBeenCalledTimes(0);
  });

  it('Element-Pool wird wiederverwendet, kein Element wird pausiert während es spielt', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.warmAudioPool(4);
    m.callVisitEnd(361, { labels: ['t20', 't20', 's20'] });
    await m.callerIdle();
    expect(FakeAudio.all.length).toBeLessThanOrEqual(4); // Pool reicht, keine Neu-Erzeugung
    expect(FakeAudio.played.length).toBe(4);
  });

  it('clearQueue stoppt sofort und blockiert callerIdle nicht', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(361, { labels: ['t20', 't20', 's20'] });
    m.clearQueue();
    await m.callerIdle();
    expect(FakeAudio.played.length).toBeLessThanOrEqual(1);
  });

  it('MURMEL-FIX: flushPending lässt den laufenden Clip KOMPLETT enden, flüchtige Calls verfallen', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callDart({ k: 'triple', n: 20, v: 60 });
    // Kay wirft SOFORT den nächsten Dart (play.js ruft flushPending statt clearQueue)
    m.flushPending();
    m.callDart({ k: 'triple', n: 19, v: 57 });
    await m.callerIdle();
    // Erster Clip komplett (play + ended), wartender alter Call verworfen, neuer komplett
    const log = m.callerDebugLog();
    const plays = log.filter(e => e.ev === 'play').map(e => e.url);
    const ends = log.filter(e => e.ev === 'ended');
    expect(plays).toEqual(['seg-t20.mp3', 'seg-t19.mp3']);
    expect(ends.length).toBe(2);
    for (const e of ends) expect(e.ms).toBeGreaterThanOrEqual(0); // jeder play hat sein ended
  });

  it('PRIO: "You require <rest>" überlebt schnelle Würfe (Kays Kernfeature)', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(361, { labels: ['s20'] }); // Visit-Ende: seg + rest-361 (prio 1)
    m.flushPending(); // Dart 1 des nächsten Visits
    m.callDart({ k: 'triple', n: 19, v: 57 });
    await m.callerIdle();
    const plays = m.callerDebugLog().filter(e => e.ev === 'play').map(e => e.url);
    expect(plays).toEqual(['seg-s20.mp3', 'rest-361.mp3', 'seg-t19.mp3']);
    expect(plays).toContain('rest-361.mp3'); // DER Beweis: Rest-Satz wurde NICHT verschluckt
  });

  it('PRIO: neues Visit-Ende ersetzt wartende alte Ansagen (nicht 2x rest stapeln)', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(361, { labels: ['s20'] });
    m.callVisitEnd(321, { labels: ['s20'] }); // Kay wirft das ganze nächste Visit in Sekunden
    await m.callerIdle();
    const plays = m.callerDebugLog().filter(e => e.ev === 'play').map(e => e.url);
    // play1 = LAUFENDER Clip des ersten Visit-Ends (endet sauber, Murmel-Fix),
    // danach NUR die neue Sequenz: kein rest-361-Stapel, kein Doppel-Rest
    expect(plays).toEqual(['seg-s20.mp3', 'seg-s20.mp3', 'rest-321.mp3']);
  });

  it('callerBusyMs: >0 solange etwas wartet/spielt, 0 wenn idle', async () => {
    const m = await loadModule();
    m.configureCaller({ enabled: true, voiceSet: 'elevenlabs-brian' });
    m.callVisitEnd(361, { labels: ['t20', 't20', 's20'] });
    expect(m.callerBusyMs()).toBeGreaterThan(0);
    await m.callerIdle();
    expect(m.callerBusyMs()).toBe(0);
  });
});
