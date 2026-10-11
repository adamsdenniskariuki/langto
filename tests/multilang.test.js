import { describe, expect, it } from 'vitest';
import { defaultState, migrate, trackSpeakingBy } from '../src/lib/store.js';
import { BADGES } from '../src/lib/badges.js';
import { esNumber, normalize, scoreSpeech } from '../src/lib/score.js';

describe('multi-language plumbing', () => {
  it('credits speaking to the active course', () => {
    const prev = defaultState();
    const d = structuredClone(prev);
    d.settings.lang = 'es';
    d.speaking.sentences += 3;
    d.speaking.seconds += 12;
    trackSpeakingBy(prev, d);
    expect(d.speakingBy.es).toEqual({ sentences: 3, seconds: 12 });
    const d2 = structuredClone(d);
    d2.settings.lang = 'de';
    d2.speaking.sentences += 1;
    trackSpeakingBy(d, d2);
    expect(d2.speakingBy).toEqual({ es: { sentences: 3, seconds: 12 }, de: { sentences: 1 } });
  });

  it('old saves attribute past speaking to their course; German progress is untouched', () => {
    const s = migrate({ xp: 50, lessons: { de: { 'u01-l1': { done: true } } }, speaking: { sentences: 9 }, settings: { lang: 'de' } });
    expect(s.speakingBy.de.sentences).toBe(9);
    expect(s.lessons.de['u01-l1'].done).toBe(true);
    expect(migrate({ speakingBy: { es: { free: 2 } } }).speakingBy).toEqual({ es: { free: 2 } });
  });

  it('course badges only count their own course', () => {
    const esA1 = BADGES.find((b) => b.id === 'es-a1');
    expect(esA1.lang).toBe('es');
    const s = defaultState();
    s.tests = { de: { A1: '2024-05-01' } };
    const courses = { de: { levels: { A1: ['x'] }, tests: { A1: 'a1-test' } }, es: { levels: { A1: ['y'] }, tests: { A1: 'a1-test' } } };
    expect(BADGES.find((b) => b.id === 'a1').test(s, courses)).toBe(true);
    expect(esA1.test(s, courses)).toBe(false);
    s.tests.es = { A1: '2024-05-02' };
    expect(esA1.test(s, courses)).toBe(true);
    const chat = BADGES.find((b) => b.id === 'es-first-chats');
    s.speaking.sentences = 500;
    expect(chat.test(s)).toBe(false);
    s.speakingBy = { es: { sentences: 50 } };
    expect(chat.test(s)).toBe(true);
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

describe('Spanish scoring', () => {
  it('spells out numbers and times', () => {
    expect(esNumber(21)).toBe('veintiuno');
    expect(esNumber(45)).toBe('cuarenta y cinco');
    expect(esNumber(100)).toBe('cien');
    expect(esNumber(115)).toBe('ciento quince');
    expect(esNumber(500)).toBe('quinientos');
    expect(normalize('Son las 3:30.', 'es')).toBe('son las tres y media');
    expect(normalize('Son las 2:45', 'es')).toBe('son las tres menos cuarto');
    expect(normalize('A las 9:00', 'es')).toBe('a las nueve');
  });
  it('ignores acute accents and inverted punctuation but keeps ñ', () => {
    expect(normalize('¿Dónde está el baño?', 'es')).toBe('donde esta el baño');
    expect(normalize('El 20 %', 'es')).toBe('el veinte por ciento');
    expect(scoreSpeech('¿Cómo estás?', ['como estas'], 'es').score).toBe(1);
    expect(normalize('año', 'es')).not.toBe(normalize('ano', 'es'));
  });
});
