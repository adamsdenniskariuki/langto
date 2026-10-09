import { describe, expect, it } from 'vitest';
import { audioKey, collectLines, ttsText, voiceFor } from '../src/lib/tts-keys.js';

const lang = { code: 'de', voiceSample: 'Hallo!', tts: { default: 'de-DE-KatjaNeural', partner: 'de-DE-ConradNeural' } };

describe('tts-keys', () => {
  it('normalises text', () => {
    expect(ttsText('  Ich heiße …')).toBe('Ich heiße');
    expect(ttsText('Guten   Morgen...')).toBe('Guten Morgen');
  });

  it('picks voices by role and override', () => {
    expect(voiceFor(lang)).toBe('de-DE-KatjaNeural');
    expect(voiceFor(lang, { role: 'partner' })).toBe('de-DE-ConradNeural');
    expect(voiceFor(lang, { voice: 'de-DE-AmalaNeural', role: 'partner' })).toBe('de-DE-AmalaNeural');
    expect(voiceFor({ code: 'xx' })).toBe('');
  });

  it('collects unique lines with the voice the app will request', () => {
    const units = [
      {
        lessons: [
          {
            phrases: [{ t: 'Hallo!' }, { t: 'Danke.' }],
            dialogue: {
              voice: 'de-DE-AmalaNeural',
              lines: [
                { who: 'A', t: 'Hallo!' },
                { who: 'you', t: 'Danke.' },
                { who: 'A', t: 'Tschüss!', voice: 'de-DE-KillianNeural' },
              ],
            },
            prompts: [{ t: ['Ich heiße Anna…'] }],
          },
        ],
      },
    ];
    const keys = collectLines(lang, units).map((l) => audioKey(l.voice, l.text));
    expect(keys.sort()).toEqual(
      [
        'de-DE-KatjaNeural|Hallo!',
        'de-DE-KatjaNeural|Danke.',
        'de-DE-AmalaNeural|Hallo!',
        'de-DE-KillianNeural|Tschüss!',
        'de-DE-KatjaNeural|Ich heiße Anna',
      ].sort()
    );
  });
});
