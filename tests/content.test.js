import { describe, expect, it } from 'vitest';
import { isUnlocked, levelReached, nextLessonId } from '../src/lib/content.js';

// kinds: plain lessons unless listed
function makeCourse(extra = {}) {
  const spec = { A1: ['a1', 'a2', 'a3', ...(extra.A1 || [])], A2: ['b1', 'b2'], B1: ['c1', 'c2'] };
  const kinds = { a4: 'grammar', a5: 'checkpoint' };
  const lessonIndex = new Map();
  const order = [];
  const levels = [];
  for (const [id, ids] of Object.entries(spec)) {
    const unit = { id: `${id}-u`, lessons: ids.map((l) => ({ id: l, kind: kinds[l] })) };
    const level = { id, units: [unit] };
    levels.push(level);
    unit.lessons.forEach((lesson, index) => {
      lessonIndex.set(lesson.id, { lesson, unit, level, index });
      order.push(lesson.id);
    });
  }
  const track = { id: 'pron' };
  const pu = [
    { id: 'p1', level: 'A1', lessons: [{ id: 'p1-l1', kind: 'pron' }, { id: 'p1-l2', kind: 'pron' }] },
    { id: 'p2', level: 'A2', lessons: [{ id: 'p2-l1', kind: 'pron' }] },
  ];
  for (const unit of pu) unit.lessons.forEach((lesson, index) => lessonIndex.set(lesson.id, { lesson, unit, level: levels.find((l) => l.id === unit.level), track, index }));
  return { order, lessonIndex, levels };
}
const D = (...ids) => Object.fromEntries(ids.map((i) => [i, { done: true }]));

describe('level unlocking', () => {
  const c = makeCourse();

  it('unlocks sequentially by default', () => {
    expect(isUnlocked(c, {}, 'a1')).toBe(true);
    expect(isUnlocked(c, {}, 'a2')).toBe(false);
    expect(isUnlocked(c, D('a1', 'a2', 'a3'), 'b1')).toBe(true);
    expect(nextLessonId(c, {})).toBe('a1');
    expect(nextLessonId(c, D('a1', 'a2', 'a3'))).toBe('b1');
    expect(nextLessonId(c, D(...c.order))).toBe(null);
  });

  it('lets learners start at a later level', () => {
    const starts = { B1: true };
    expect(isUnlocked(c, {}, 'c1', starts)).toBe(true);
    expect(isUnlocked(c, {}, 'c2', starts)).toBe(false);
    expect(isUnlocked(c, {}, 'b1', starts)).toBe(false);
    expect(nextLessonId(c, {}, starts)).toBe('c1');
    expect(nextLessonId(c, D('c1'), starts)).toBe('c2');
    // earlier levels stay available
    expect(isUnlocked(c, D('c1'), 'a1', starts)).toBe(true);
  });

  it('keeps the next level open for learners who finished a level before new lessons were added', () => {
    const c2 = makeCourse({ A1: ['a4', 'a5'] });
    const legacy = D('a1', 'a2', 'a3');
    expect(isUnlocked(c2, legacy, 'a4')).toBe(true); // new lesson right after the old ones
    expect(isUnlocked(c2, legacy, 'a5')).toBe(false);
    expect(isUnlocked(c2, legacy, 'b1')).toBe(true); // A2 stays open
    expect(isUnlocked(c2, D('a1', 'a2'), 'b1')).toBe(false);
    expect(nextLessonId(c2, legacy)).toBe('b1');
  });
});

describe('pronunciation track', () => {
  const c = makeCourse();
  it('opens A1 sounds straight away and later sounds when the level is reached', () => {
    expect(isUnlocked(c, {}, 'p1-l1')).toBe(true);
    expect(isUnlocked(c, {}, 'p1-l2')).toBe(false);
    expect(isUnlocked(c, D('p1-l1'), 'p1-l2')).toBe(true);
    expect(levelReached(c, {}, 'A2')).toBe(false);
    expect(isUnlocked(c, {}, 'p2-l1')).toBe(false);
    expect(isUnlocked(c, D('a1', 'a2', 'a3'), 'p2-l1')).toBe(true);
    expect(isUnlocked(c, {}, 'p2-l1', { A2: true })).toBe(true);
  });
  it('is not part of the main path', () => {
    expect(c.order).not.toContain('p1-l1');
    expect(nextLessonId(c, D('a1', 'a2', 'a3', 'b1', 'b2', 'c1', 'c2'))).toBe(null);
  });
});
