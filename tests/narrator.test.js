import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const K = 'de-DE-KatjaNeural';
const C = 'de-DE-ConradNeural';
const lang = { code: 'de', speech: 'de-DE', tts: { default: K, partner: C, narrators: [{ id: 'female', label: 'Female', voice: K }, { id: 'male', label: 'Male', voice: C }] } };

function serve(files, narration = {}) {
  const fetched = [];
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    fetched.push(url);
    if (url.endsWith('manifest.json')) return { ok: true, json: async () => ({ files }) };
    if (url.endsWith('narration.json')) return { ok: true, json: async () => narration };
    return { ok: true, blob: async () => new Blob() };
  }));
  return fetched;
}

let speech;
beforeEach(async () => {
  vi.resetModules();
  speech = await import('../src/lib/speech.js');
});
afterEach(() => vi.unstubAllGlobals());

describe('narrator audio selection', () => {
  it('plays the chosen narrator, falls back to the other one, then to device TTS', async () => {
    serve({ [`${K}|Hallo!`]: 'k1.mp3', [`${C}|Hallo!`]: 'c1.mp3', [`${K}|Danke.`]: 'k2.mp3' });
    expect(await speech.audioUrlFor(lang, 'Hallo!', { narrator: 'male' })).toMatch(/c1\.mp3$/);
    expect(await speech.audioUrlFor(lang, 'Hallo!', { narrator: 'female' })).toMatch(/k1\.mp3$/);
    expect(await speech.audioUrlFor(lang, 'Danke.', { narrator: 'male' })).toMatch(/k2\.mp3$/);
    expect(await speech.audioUrlFor(lang, 'Fehlt.', { narrator: 'male' })).toBeNull();
  });

  it('keeps character voices regardless of the narrator', async () => {
    serve({ [`${K}|Hallo!`]: 'k1.mp3', [`${C}|Hallo!`]: 'c1.mp3' });
    expect(await speech.audioUrlFor(lang, 'Hallo!', { narrator: 'male', character: true })).toMatch(/k1\.mp3$/);
  });

  it('offline download skips other narrators’ narration but keeps character clips', async () => {
    const fetched = serve(
      { [`${K}|Hallo!`]: 'k1.mp3', [`${C}|Hallo!`]: 'c1.mp3', [`${C}|Tag!`]: 'c2.mp3' },
      { [K]: ['k1.mp3'], [C]: ['c1.mp3'] }
    );
    const n = await speech.prefetchAudio('de', () => {}, C);
    expect(n).toBe(2);
    expect(fetched.filter((u) => u.endsWith('.mp3')).sort()).toEqual(['/audio/de/c1.mp3', '/audio/de/c2.mp3']);
  });
});

describe('narrator setting', () => {
  it('defaults to the course voice for old saves and survives import', async () => {
    const { migrate } = await import('../src/lib/store.js');
    const old = migrate({ version: 1, settings: { rate: 1.1 } });
    expect(old.settings.narrator).toBe('');
    expect(old.settings.rate).toBe(1.1);
    expect(migrate({ settings: { narrator: 'male' } }).settings.narrator).toBe('male');
  });
});
