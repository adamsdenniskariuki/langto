import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const domErr = (name) => Object.assign(new Error(name), { name });

function fakeNav({ gum, perm, ua = '' } = {}) {
  const stop = vi.fn();
  const getUserMedia = vi.fn(gum || (async () => ({ getTracks: () => [{ stop }] })));
  const listeners = [];
  const status = perm && { state: perm, addEventListener: (_, f) => listeners.push(f), removeEventListener: vi.fn() };
  const permissions = perm === undefined ? undefined : { query: vi.fn(async ({ name }) => { if (name !== 'microphone' || perm === 'throws') throw new TypeError('bad name'); return status; }) };
  vi.stubGlobal('navigator', { userAgent: ua, mediaDevices: { getUserMedia }, permissions });
  return { getUserMedia, stop, status, fire: (s) => { status.state = s; listeners.forEach((f) => f()); } };
}

let mic;
beforeEach(async () => {
  vi.resetModules();
  mic = await import('../src/lib/mic.js');
});
afterEach(() => vi.unstubAllGlobals());

describe('ensureMicPermission', () => {
  it('asks via getUserMedia, stops the tracks and caches the grant', async () => {
    const n = fakeNav();
    await expect(mic.ensureMicPermission()).resolves.toBe(true);
    expect(n.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(n.stop).toHaveBeenCalledTimes(1);
    await mic.ensureMicPermission();
    expect(n.getUserMedia).toHaveBeenCalledTimes(1);
    mic.forgetMicPermission();
    await mic.ensureMicPermission();
    expect(n.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('shares one prompt between concurrent calls', async () => {
    const n = fakeNav();
    await Promise.all([mic.ensureMicPermission(), mic.ensureMicPermission()]);
    expect(n.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['NotAllowedError', 'not-allowed'],
    ['NotFoundError', 'no-mic'],
    ['NotReadableError', 'mic-busy'],
    ['SecurityError', 'insecure'],
  ])('maps %s to %s with a friendly message', async (name, code) => {
    fakeNav({ gum: async () => { throw domErr(name); } });
    await expect(mic.ensureMicPermission()).rejects.toThrow(code);
    expect(mic.micErrorMessage(code)).not.toMatch(/something went wrong/i);
    expect(mic.micErrorMessage(domErr(name))).toBe(mic.micErrorMessage(code));
  });

  it('does not cache a failure', async () => {
    let fail = true;
    const n = fakeNav({ gum: async () => { if (fail) throw domErr('NotAllowedError'); return { getTracks: () => [] }; } });
    await expect(mic.ensureMicPermission()).rejects.toThrow('not-allowed');
    fail = false;
    await expect(mic.ensureMicPermission()).resolves.toBe(true);
    expect(n.getUserMedia).toHaveBeenCalledTimes(2);
  });
});

describe('micPermissionState', () => {
  it('reads the Permissions API', async () => {
    fakeNav({ perm: 'denied' });
    expect(await mic.micPermissionState()).toBe('denied');
  });
  it('falls back to the cached grant when the API is missing or rejects the name', async () => {
    fakeNav({ perm: 'throws' });
    expect(await mic.micPermissionState()).toBe('unknown');
    await mic.ensureMicPermission();
    expect(await mic.micPermissionState()).toBe('granted');
  });
  it('notifies changes and drops the cache when revoked', async () => {
    const n = fakeNav({ perm: 'granted' });
    await mic.ensureMicPermission();
    const seen = [];
    mic.watchMicPermission((s) => seen.push(s));
    await new Promise((r) => setTimeout(r));
    n.fire('denied');
    expect(seen).toEqual(['denied']);
    await mic.ensureMicPermission();
    expect(n.getUserMedia).toHaveBeenCalledTimes(2);
  });
  it('labels every state', () => {
    for (const s of ['granted', 'denied', 'prompt', 'unknown']) expect(mic.MIC_STATE_LABEL[s]).toBeTruthy();
  });
});

describe('unblockSteps', () => {
  const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
  it('gives browser-specific instructions', () => {
    expect(mic.unblockSteps({ ua: chrome, standalone: false })[0]).toMatch(/lock icon.*Site settings.*Microphone.*Allow/);
    expect(mic.unblockSteps({ ua: chrome + ' Edg/129.0', standalone: false })[0]).toMatch(/Permissions for this site/);
    expect(mic.unblockSteps({ ua: 'Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0', standalone: false })[0]).toMatch(/Blocked/);
    expect(mic.unblockSteps({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', standalone: false })[0]).toMatch(/aA/);
  });
  it('covers installed (standalone) apps', () => {
    expect(mic.unblockSteps({ ua: 'Mozilla/5.0 (Linux; Android 14) Chrome/129.0 Mobile Safari/537.36', standalone: true })[0]).toMatch(/App info/);
    expect(mic.unblockSteps({ ua: chrome, standalone: true })[0]).toMatch(/app window/);
    expect(mic.unblockSteps({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148', standalone: true })[0]).toMatch(/Settings app/);
  });
});

describe('listen asks for the mic first', () => {
  class FakeRec {
    start() { this.onstart?.(); this.onresult?.({ results: [[{ transcript: 'hallo' }]] }); this.onend?.(); }
    stop() {}
  }
  it('requests permission before starting recognition', async () => {
    const n = fakeNav();
    vi.stubGlobal('window', { SpeechRecognition: FakeRec, speechSynthesis: null });
    const speech = await import('../src/lib/speech.js');
    const r = await speech.listen().promise;
    expect(r.transcripts).toEqual(['hallo']);
    expect(n.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it('reports a blocked mic without starting recognition', async () => {
    fakeNav({ gum: async () => { throw domErr('NotAllowedError'); } });
    const start = vi.fn();
    vi.stubGlobal('window', { SpeechRecognition: class { start = start; stop() {} }, speechSynthesis: null });
    const speech = await import('../src/lib/speech.js');
    await expect(speech.listenLong().promise).rejects.toThrow('not-allowed');
    expect(start).not.toHaveBeenCalled();
    expect(speech.recognitionErrorMessage('not-allowed')).toMatch(/lock icon/);
  });
});
