import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BADGES } from '../src/lib/badges.js';
import { defaultState } from '../src/lib/store.js';
import { Flag } from '../src/components/Flag.jsx';

const read = (p) => JSON.parse(readFileSync(new URL(`../public/content/${p}`, import.meta.url), 'utf8'));

describe('French course', () => {
  it('is configured with French recognition, narrators and a mic phrase', () => {
    const fr = read('languages.json').find((l) => l.code === 'fr');
    expect(fr.speech).toBe('fr-FR');
    expect(fr.tts.narrators.map((n) => n.id)).toEqual(['female', 'male']);
    expect(fr.tts.narrators.every((n) => n.voice.startsWith('fr-FR-'))).toBe(true);
    expect(fr.micPhrase).toBeTruthy();
    expect(fr.voiceSample).toBeTruthy();
  });

  it('keeps German alongside French', () => {
    const codes = read('languages.json').map((l) => l.code);
    expect(codes).toContain('de');
    expect(codes).toContain('fr');
  });

  it('gives each live level a speaking test in its last unit', () => {
    const course = read('fr/course.json');
    for (const level of course.levels.filter((l) => !l.comingSoon)) {
      const last = read('fr/' + level.units.at(-1));
      expect(last.lessons.at(-1).id).toBe(`${level.id.toLowerCase()}-test`);
    }
  });

  it('has French level badges that only count French progress', () => {
    const frA1 = BADGES.find((b) => b.id === 'fr-a1');
    expect(frA1.lang).toBe('fr');
    const s = defaultState();
    const courses = { de: { levels: { A1: ['x'] }, tests: { A1: 'a1-test' } }, fr: { levels: { A1: ['y'] }, tests: { A1: 'a1-test' } } };
    s.tests = { de: { A1: '2024-05-01' } };
    expect(frA1.test(s, courses)).toBe(false);
    s.tests.fr = { A1: '2024-05-02' };
    expect(frA1.test(s, courses)).toBe(true);
    s.speakingBy = { fr: { sentences: 50 } };
    expect(BADGES.find((b) => b.id === 'fr-first-chats').test(s)).toBe(true);
  });

  it('draws flags for the francophone culture regions', () => {
    for (const code of ['fr', 'be', 'ch', 'ca', 'lu', 'sn', 'ci', 'ht']) expect(Flag({ code }).type).toBe('svg');
    expect([Flag({ code: 'ch' }).props.children].flat(2).filter(Boolean)).toHaveLength(2); // field + cross
  });
});
