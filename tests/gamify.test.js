import { describe, expect, it } from 'vitest';
import { awardXP, completeLesson, currentStreak, levelFromXP, MAX_FREEZES, recordSpeech, touchStreak, xpForLevel } from '../src/lib/gamify.js';
import { addDays } from '../src/lib/date.js';
import { defaultState, exportData, migrate, parseImport } from '../src/lib/store.js';
import { BADGES, newlyEarned } from '../src/lib/badges.js';

const D = '2024-05-01';
const fresh = () => defaultState();

describe('levels', () => {
  it('uses a growing XP curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(50);
    expect(levelFromXP(0).level).toBe(1);
    expect(levelFromXP(49).level).toBe(1);
    expect(levelFromXP(50)).toEqual({ level: 2, current: 0, needed: 100 });
  });
});

describe('streaks', () => {
  it('counts consecutive days and resets after a gap', () => {
    const s = fresh();
    touchStreak(s, D);
    touchStreak(s, D);
    touchStreak(s, addDays(D, 1));
    expect(s.streak.count).toBe(2);
    touchStreak(s, addDays(D, 4));
    expect(s.streak.count).toBe(1);
    expect(s.streak.best).toBe(2);
  });
  it('earns a freeze every 7 days (max 2) and spends it on a missed day', () => {
    const s = fresh();
    const events = [];
    for (let i = 0; i < 7; i++) touchStreak(s, addDays(D, i), events);
    expect(s.streak.count).toBe(7);
    expect(s.streak.freezes).toBe(1);
    expect(events.some((e) => e.type === 'freeze-earned')).toBe(true);
    // Miss day 8, come back on day 9.
    expect(currentStreak(s, addDays(D, 8)).count).toBe(7);
    touchStreak(s, addDays(D, 8), events);
    expect(s.streak.count).toBe(8);
    expect(s.streak.freezes).toBe(0);
    expect(events.some((e) => e.type === 'freeze-used')).toBe(true);
  });
  it('never holds more than MAX_FREEZES', () => {
    const s = fresh();
    for (let i = 0; i < 40; i++) touchStreak(s, addDays(D, i));
    expect(s.streak.freezes).toBe(MAX_FREEZES);
  });
  it('currentStreak shows 0 once the streak is lost', () => {
    const s = fresh();
    touchStreak(s, D);
    expect(currentStreak(s, D)).toMatchObject({ count: 1, doneToday: true });
    expect(currentStreak(s, addDays(D, 1))).toMatchObject({ count: 1, atRisk: true });
    expect(currentStreak(s, addDays(D, 3)).count).toBe(0);
  });
});

describe('XP & lessons', () => {
  it('logs XP per day and fires goal/level events once', () => {
    const s = fresh();
    const ev = [];
    awardXP(s, 15, ev, D, new Date(`${D}T12:00`));
    awardXP(s, 10, ev, D, new Date(`${D}T12:00`));
    awardXP(s, 30, ev, D, new Date(`${D}T12:00`));
    expect(s.xp).toBe(55);
    expect(s.xpLog[D]).toBe(55);
    expect(ev.filter((e) => e.type === 'goal')).toHaveLength(1);
    expect(ev.filter((e) => e.type === 'level')).toEqual([{ type: 'level', level: 2 }]);
  });
  it('completing a lesson records it, creates review cards and gives a perfect bonus', () => {
    const s = fresh();
    const xp = completeLesson(s, 'de', 'l1', { accuracy: 1, cardIds: ['l1#0', 'l1#1'] }, [], D);
    expect(xp).toBe(15);
    expect(s.lessons.de.l1).toMatchObject({ done: true, times: 1, best: 1 });
    expect(Object.keys(s.cards.de)).toEqual(['l1#0', 'l1#1']);
    expect(s.perfectLessons).toBe(1);
  });
  it('caps a single speech attempt at 60 seconds', () => {
    const s = fresh();
    recordSpeech(s, { seconds: 500, passed: true, score: 1 });
    expect(s.speaking.seconds).toBe(60);
    expect(s.speaking.sentences).toBe(1);
  });
});

describe('badges', () => {
  it('awards First Steps after one lesson and never twice', () => {
    const s = fresh();
    expect(newlyEarned(s, {})).toEqual([]);
    completeLesson(s, 'de', 'l1', {}, [], D);
    const got = newlyEarned(s, {}).map((b) => b.id);
    expect(got).toContain('first-lesson');
    s.badges['first-lesson'] = D;
    expect(newlyEarned(s, {}).map((b) => b.id)).not.toContain('first-lesson');
  });
  it('has unique ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});

describe('export / import', () => {
  it('round-trips progress', () => {
    const json = exportData();
    const back = parseImport(json);
    expect(back.settings).toBeTruthy();
    expect(typeof back.xp).toBe('number');
  });
  it('rejects files that are not Langto backups', () => {
    expect(() => parseImport('nope')).toThrow(/JSON/);
    expect(() => parseImport('{"app":"other"}')).toThrow(/Langto/);
    expect(() => parseImport(JSON.stringify({ app: 'langto', format: 99, data: {} }))).toThrow(/newer/);
  });
  it('migrate fills in fields missing from older backups', () => {
    const s = migrate({ xp: 12, lessons: {} });
    expect(s.xp).toBe(12);
    expect(s.streak).toMatchObject({ count: 0, freezes: 0 });
    expect(s.settings.theme).toBe('system');
  });
});
