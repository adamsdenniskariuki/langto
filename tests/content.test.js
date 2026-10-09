import { describe, expect, it } from 'vitest';
import { isUnlocked, nextLessonId } from '../src/lib/content.js';

function makeCourse() {
  const levels = { A1: ['a1', 'a2', 'a3'], A2: ['b1', 'b2'], B1: ['c1', 'c2'] };
  const lessonIndex = new Map();
  const order = [];
  for (const [id, ids] of Object.entries(levels)) for (const l of ids) {
    lessonIndex.set(l, { lesson: { id: l }, level: { id } });
    order.push(l);
  }
  return { order, lessonIndex };
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
});
