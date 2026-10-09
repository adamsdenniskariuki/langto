import { describe, expect, it } from 'vitest';
import { buildSteps, examItems, isExam, kindOf, pickChoice, stressParts } from '../src/lib/lesson.js';
import { checkFree, FREE_PASS } from '../src/lib/score.js';
import { completeLesson, mostMissed, recordHit, recordMiss } from '../src/lib/gamify.js';
import { collectLines } from '../src/lib/tts-keys.js';
import { defaultState, migrate } from '../src/lib/store.js';
import { BADGES } from '../src/lib/badges.js';
import { xpFor } from '../src/views/Lesson.jsx';

const seq = () => {
  let i = 0;
  return () => ((i++ * 0.37) % 1);
};
const P = (t) => ({ t, n: `en: ${t}` });
const core = (id, ts) => ({ id, title: id, goal: 'g', phrases: ts.map(P) });

const unit = {
  id: 'u1',
  lessons: [
    core('u1-l1', ['Hallo', 'Guten Morgen', 'Tschüss', 'Danke schön']),
    core('u1-l2', ['Ich heiße Anna', 'Wie heißt du?', 'Freut mich', 'Bitte sehr']),
    {
      id: 'u1-l3', kind: 'grammar', title: 'g', goal: 'g', tip: { title: 'T', body: 'B' },
      phrases: [P('Ich habe einen Hund'), P('Ich habe eine Katze'), P('Ich habe ein Auto'), P('Ich habe Zeit')],
      drills: [{ title: 'Swap', base: P('Ich habe einen Hund'), items: [{ cue: 'Katze', ...P('Ich habe eine Katze') }, { cue: 'Auto', ...P('Ich habe ein Auto') }] }],
    },
    {
      id: 'u1-l4', kind: 'listening', title: 'l', goal: 'g',
      story: { title: 'S', voice: 'de-DE-AmalaNeural', lines: [{ name: 'A', ...P('Hallo Tom!') }, { name: 'B', voice: 'de-DE-ConradNeural', ...P('Hallo Anna!') }], questions: [{ q: 'Wer ist Tom?', n: 'Who?', t: ['Ein Freund'] }] },
    },
    {
      id: 'u1-l5', kind: 'roleplay', title: 'r', goal: 'g',
      branch: { title: 'B', name: 'Baker', start: 'a', nodes: { a: { ...P('Was darf es sein?'), choices: [{ ...P('Ein Brot, bitte'), next: 'b' }] }, b: { ...P('Gern!'), end: 'good' } } },
    },
    { id: 'u1-l6', kind: 'speaking', title: 's', goal: 'g', culture: { title: 'du/Sie', body: 'x', regions: ['DE', 'AT'] }, free: [{ n: 'Talk', seconds: 30, targets: [{ label: 'greeting', any: ['hallo', 'guten*'] }], model: 'Hallo, ich heiße Tom.' }] },
    { id: 'u1-cp', kind: 'checkpoint', title: 'cp', goal: 'g' },
  ],
};

describe('lesson kinds', () => {
  it('classifies kinds', () => {
    expect(kindOf({})).toBe('lesson');
    expect(kindOf({ kind: 'nope' })).toBe('lesson');
    expect(kindOf({ kind: 'pron' })).toBe('pron');
    expect(isExam({ kind: 'checkpoint' })).toBe(true);
    expect(isExam({ kind: 'test' })).toBe(true);
    expect(isExam({ kind: 'grammar' })).toBe(false);
  });

  it('builds a checkpoint of hidden-German recall items from the unit', () => {
    const steps = buildSteps(unit.lessons[6], unit, seq());
    const recall = steps.filter((s) => s.type === 'recall');
    expect(recall).toHaveLength(10);
    expect(recall.every((s) => s.exam && s.cardId && s.phrase.t)).toBe(true);
    expect(new Set(recall.map((s) => s.phrase.t)).size).toBe(10);
    expect(recall[0].cardId).toMatch(/^u1-l\d#\d$/);
  });

  it('builds a level test across all units plus prompts', () => {
    const u2 = { id: 'u2', lessons: [{ ...core('u2-l1', ['Eins', 'Zwei', 'Drei', 'Vier']), prompts: [{ n: 'Count', t: ['Eins'] }] }] };
    const test = { id: 'a1-test', kind: 'test', title: 't', goal: 'g' };
    const steps = buildSteps(test, u2, seq(), { units: [unit, { ...u2, lessons: [...u2.lessons, test] }] });
    expect(steps.filter((s) => s.type === 'recall')).toHaveLength(12);
    expect(steps.filter((s) => s.type === 'prompt')).toHaveLength(1);
  });

  it('examItems de-duplicates by text and skips exams', () => {
    const items = examItems([core('x', ['A', 'B']), core('y', ['A', 'C']), { kind: 'checkpoint', phrases: [P('Z')] }], 10, seq());
    expect(items.map((i) => i.phrase.t).sort()).toEqual(['A', 'B', 'C']);
  });

  it('adds drills, stories, questions, branches, free tasks and culture', () => {
    const types = (l) => buildSteps(l, unit, seq()).map((s) => s.type);
    expect(types(unit.lessons[2]).filter((t) => t === 'drill')).toHaveLength(2);
    expect(types(unit.lessons[3])).toEqual(['story', 'question']);
    expect(types(unit.lessons[4])).toEqual(['branch']);
    expect(types(unit.lessons[5])).toEqual(['culture', 'free']);
  });

  it('builds pronunciation steps', () => {
    const pron = { id: 'p1', kind: 'pron', title: 'ü', goal: 'g', pairs: [{ sound: 'ü/u', a: P('Mütter'), b: P('Mutter') }], stress: [{ ...P('Ich komme'), mark: 'Ich *kom*me' }] };
    const steps = buildSteps(pron, { lessons: [pron] }, seq());
    expect(steps.map((s) => s.type)).toEqual(['pair', 'stress']);
    expect(['a', 'b']).toContain(steps[0].target);
  });

  it('parses stress marks and picks branch choices', () => {
    expect(stressParts('Ich *kom*me')).toEqual([{ text: 'Ich ', stress: false }, { text: 'kom', stress: true }, { text: 'me', stress: false }]);
    expect(pickChoice([0.2, 0.8, 0.4])).toEqual({ index: 1, score: 0.8 });
    expect(pickChoice([0.2, 0.3]).index).toBe(-1);
  });
});

describe('free speaking check', () => {
  const task = { minWords: 10, targets: [{ label: 'weekend', any: ['wochenende'] }, { label: 'past', any: ['habe*', 'bin * gegangen'] }, { label: 'food', any: ['pizza', 'kuchen'] }] };
  it('finds target words and stems', () => {
    const r = checkFree('Am Wochenende habe ich Pizza gegessen', task);
    expect(r.hits).toEqual(['weekend', 'past', 'food']);
    expect(r.words).toBe(6);
    expect(r.score).toBeCloseTo(0.8 + 0.2 * 0.6);
    expect(r.score).toBeGreaterThanOrEqual(FREE_PASS);
  });
  it('does not match parts of words for non-stem targets', () => {
    expect(checkFree('Pizzeria', task).hits).toEqual([]);
    expect(checkFree('', task).score).toBe(0);
  });  it('requires at least one topic-specific hit when commonWords are given', () => {
    const lang = { code: 'de', commonWords: ['ich', 'habe', 'und', 'das'] };
    const t = { minWords: 4, targets: [{ label: 'me', any: ['ich'] }, { label: 'have', any: ['habe'] }, { label: 'dog', any: ['hund'] }] };
    const common = checkFree('ich habe das und das', t, lang);
    expect(common.specific).toBe(0);
    expect(common.score).toBeLessThan(FREE_PASS);
    const ok = checkFree('ich habe einen Hund und das', t, lang);
    expect(ok.specific).toBe(1);
    expect(ok.score).toBeGreaterThanOrEqual(FREE_PASS);
    expect(checkFree('ich habe das und das', t, 'de').score).toBeGreaterThanOrEqual(FREE_PASS);
  });
});

describe('misses and completion', () => {
  it('ranks most-missed cards and pays back on hits', () => {
    const s = defaultState();
    recordMiss(s, 'de', 'a#0');
    recordMiss(s, 'de', 'b#1');
    recordMiss(s, 'de', 'b#1');
    expect(mostMissed(s, 'de')).toEqual(['b#1', 'a#0']);
    recordHit(s, 'de', 'a#0');
    expect(mostMissed(s, 'de')).toEqual(['b#1']);
  });

  it('counts checkpoints once, records tests and pron lessons', () => {
    const s = defaultState();
    const xp1 = completeLesson(s, 'de', 'u1-cp', { kind: 'checkpoint' }, [], '2024-05-01');
    completeLesson(s, 'de', 'u1-cp', { kind: 'checkpoint' }, [], '2024-05-02');
    expect(s.checkpoints).toBe(1);
    expect(xp1).toBeGreaterThan(completeLesson(defaultState(), 'de', 'x', {}, [], '2024-05-01'));
    completeLesson(s, 'de', 'a1-test', { kind: 'test', level: 'A1' }, [], '2024-05-03');
    expect(s.tests.de.A1).toBe('2024-05-03');
    completeLesson(s, 'de', 'p1', { kind: 'pron' }, [], '2024-05-03');
    completeLesson(s, 'de', 'p1', { kind: 'pron' }, [], '2024-05-04');
    expect(s.pronLessons).toBe(1);
  });

  it('level badges follow the speaking test when a level has one', () => {
    const a1 = BADGES.find((b) => b.id === 'a1');
    const s = defaultState();
    s.lessons.de = { 'u1-l1': { done: true } };
    const courses = { de: { levels: { A1: ['u1-l1'] }, tests: { A1: 'a1-test' } } };
    expect(a1.test(s, courses)).toBe(false);
    s.tests = { de: { A1: '2024-05-01' } };
    expect(a1.test(s, courses)).toBe(true);
    expect(a1.test(defaultState(), { de: { levels: { A1: ['u1-l1'] } } })).toBe(false);
    expect(a1.test(s, { de: { levels: { A1: ['u1-l1'] } } })).toBe(true);
  });

  it('old saves gain the new fields without losing progress', () => {
    const old = { format: 1, xp: 120, lessons: { de: { 'u01-l1': { done: true, best: 1 } } }, speaking: { sentences: 9 } };
    const s = migrate(old);
    expect(s.xp).toBe(120);
    expect(s.lessons.de['u01-l1'].done).toBe(true);
    expect(s.speaking.sentences).toBe(9);
    expect(s.speaking.free).toBe(0);
    expect(s.misses).toEqual({});
    expect(s.tests).toEqual({});
    expect(s.checkpoints).toBe(0);
  });
});

describe('xp for new step types', () => {
  it('rewards each activity', () => {
    expect(xpFor({ type: 'drill' }, { passed: true })).toBeGreaterThan(0);
    expect(xpFor({ type: 'question' }, { passed: true })).toBeGreaterThan(0);
    expect(xpFor({ type: 'branch' }, { branch: true, good: true })).toBeGreaterThan(xpFor({ type: 'branch' }, { branch: true }));
    expect(xpFor({ type: 'free' }, { free: true, hits: 2 })).toBeGreaterThan(xpFor({ type: 'free' }, { free: true }));
    expect(xpFor({ type: 'pair' }, { correct: true })).toBeGreaterThan(0);
    expect(xpFor({ type: 'recall' }, { correct: false })).toBe(0);
  });
});

describe('audio lines for new content', () => {
  const lang = { code: 'de', tts: { default: 'de-DE-KatjaNeural', partner: 'de-DE-ConradNeural' } };
  it('collects drills, stories, questions, branches, free models, pairs and stress', () => {
    const pron = { lessons: [{ pairs: [{ a: P('Mütter'), b: P('Mutter') }], stress: [{ ...P('Ich komme'), mark: 'Ich *kom*me' }] }] };
    const lines = collectLines(lang, [unit, pron]);
    const has = (text, voice = 'de-DE-KatjaNeural') => lines.some((l) => l.text === text && l.voice === voice);
    expect(has('Ich habe ein Auto')).toBe(true);
    expect(has('Hallo Tom!', 'de-DE-AmalaNeural')).toBe(true);
    expect(has('Hallo Anna!', 'de-DE-ConradNeural')).toBe(true);
    expect(has('Wer ist Tom?')).toBe(true);
    expect(has('Ein Freund')).toBe(true);
    expect(has('Was darf es sein?', 'de-DE-ConradNeural')).toBe(true);
    expect(has('Hallo, ich heiße Tom.')).toBe(true);
    expect(has('Mütter') && has('Mutter') && has('Ich komme')).toBe(true);
  });
});
