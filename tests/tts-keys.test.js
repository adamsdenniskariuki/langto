import { describe, expect, it } from 'vitest';
import { audioKey, collectLines, narrators, narratorVoice, ttsText, voiceCandidates, voiceFor } from '../src/lib/tts-keys.js';

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

  describe('narrator voices', () => {
    const K = 'de-DE-KatjaNeural';
    const C = 'de-DE-ConradNeural';
    const two = { ...lang, tts: { ...lang.tts, narrators: [{ id: 'female', label: 'Female', voice: K }, { id: 'male', label: 'Male', voice: C }] } };

    it('defaults to the course voice and follows the chosen narrator for narrated lines only', () => {
      expect(narrators(lang)).toEqual([{ id: 'default', label: 'Default', voice: K }]);
      expect(narratorVoice(two, '')).toBe(K);
      expect(narratorVoice(two, 'unknown')).toBe(K);
      expect(voiceFor(two, { narrator: 'male' })).toBe(C);
      expect(voiceFor(two, { narrator: 'male', character: true })).toBe(K);
      expect(voiceFor(two, { narrator: 'male', role: 'partner' })).toBe(C);
      expect(voiceFor(two, { narrator: 'female', voice: 'de-DE-AmalaNeural' })).toBe('de-DE-AmalaNeural');
    });

    it('falls back to the other narrator, but never re-voices characters', () => {
      expect(voiceCandidates(two, { narrator: 'male' })).toEqual([C, K]);
      expect(voiceCandidates(two, {})).toEqual([K, C]);
      expect(voiceCandidates(two, { character: true, narrator: 'male' })).toEqual([K]);
    });

    it('collects narrated lines in every narrator voice and keeps characters single-voiced', () => {
      const units = [{ lessons: [{
        phrases: [{ t: 'Hallo!' }],
        dialogue: { lines: [{ who: 'you', t: 'Hallo!' }, { who: 'A', t: 'Tag!' }] },
        story: { lines: [{ t: 'Es war einmal.' }], questions: [{ q: 'Wer?' }] },
      }] }];
      const lines = collectLines(two, units);
      const by = Object.fromEntries(lines.map((l) => [audioKey(l.voice, l.text), l.narrated]));
      expect(by).toEqual({
        [`${K}|Hallo!`]: false, // also spoken by the learner's dialogue character
        [`${C}|Hallo!`]: true,
        [`${C}|Tag!`]: false,
        [`${K}|Es war einmal.`]: false,
        [`${K}|Wer?`]: true,
        [`${C}|Wer?`]: true,
      });
      expect(lines.some((l) => l.voice === C && l.text === 'Es war einmal.')).toBe(false);
    });
  });
});