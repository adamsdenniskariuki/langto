import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildSteps, GRADED, pickOptions } from '../src/lib/lesson.js';

const unit = JSON.parse(readFileSync(new URL('../public/content/de/a1/u01-hallo.json', import.meta.url), 'utf8'));

// Deterministic PRNG so tests are stable.
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

describe('buildSteps', () => {
  const lesson = unit.lessons[0];
  const steps = buildSteps(lesson, unit, seeded(7));

  it('starts with the tip and teaches every phrase', () => {
    expect(steps[0].type).toBe('tip');
    const learned = steps.filter((s) => s.type === 'learn').map((s) => s.phrase.t);
    expect(learned).toEqual(lesson.phrases.map((p) => p.t));
  });
  it('includes graded quizzes, the dialogue and the speaking prompts', () => {
    expect(steps.some((s) => GRADED.has(s.type))).toBe(true);
    expect(steps.filter((s) => s.type === 'dialogue')).toHaveLength(lesson.dialogue ? 1 : 0);
    expect(steps.filter((s) => s.type === 'prompt')).toHaveLength((lesson.prompts || []).length);
  });
  it('quiz options contain the answer exactly once', () => {
    for (const s of steps.filter((x) => x.type === 'listen' || x.type === 'read')) {
      const answer = s.type === 'listen' ? s.phrase.n : s.phrase.t;
      expect(s.options.filter((o) => o === answer)).toHaveLength(1);
      expect(s.options.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('pickOptions', () => {
  it('returns up to 4 unique options including the correct one', () => {
    const pool = unit.lessons.flatMap((l) => l.phrases);
    const opts = pickOptions(pool[0], pool, 'n', seeded(3));
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain(pool[0].n);
  });
});
