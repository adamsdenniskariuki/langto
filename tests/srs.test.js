import { describe, expect, it } from 'vitest';
import { dueCards, gradeCard, INTERVALS, newCard, strength } from '../src/lib/srs.js';
import { addDays } from '../src/lib/date.js';

const T = '2024-03-10';

describe('srs', () => {
  it('new cards are due tomorrow', () => {
    expect(newCard(T).due).toBe(addDays(T, 1));
  });
  it('correct answers push the card to longer intervals', () => {
    let c = newCard(T);
    c = gradeCard(c, true, T);
    expect(c.box).toBe(2);
    expect(c.due).toBe(addDays(T, INTERVALS[2]));
    for (let i = 0; i < 20; i++) c = gradeCard(c, true, T);
    expect(c.box).toBe(INTERVALS.length - 1);
    expect(strength(c)).toBe(1);
  });
  it('a lapse resets the card and keeps it due today', () => {
    let c = gradeCard(gradeCard(newCard(T), true, T), true, T);
    c = gradeCard(c, false, T);
    expect(c.box).toBe(1);
    expect(c.lapses).toBe(1);
    expect(c.due).toBe(T);
  });
  it('dueCards lists only due cards, weakest first', () => {
    const cards = {
      a: { box: 3, due: '2024-03-01' },
      b: { box: 1, due: '2024-03-09' },
      c: { box: 1, due: '2024-04-01' },
    };
    expect(dueCards(cards, T)).toEqual(['b', 'a']);
    expect(dueCards(undefined, T)).toEqual([]);
  });
});

describe('date helpers', () => {
  it('addDays crosses month and DST boundaries', () => {
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
    expect(addDays('2024-03-30', 2)).toBe('2024-04-01');
    expect(addDays('2024-10-26', 2)).toBe('2024-10-28');
  });
});
