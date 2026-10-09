// Gamification rules: XP, levels, streaks (with freezes), speaking metrics, lesson completion.
// All functions mutate a state draft and push UI events into `events`.
import { dateKey, daysBetween } from './date.js';
import { newCard } from './srs.js';

export const MAX_FREEZES = 2;
export const XP = { step: 2, build: 3, speakPass: 2, prompt: 3, promptFast: 2, dialogue: 10, lesson: 10, perfect: 5, review: 2 };

export function xpForLevel(n) {
  return 25 * n * (n - 1);
}

export function levelFromXP(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const floor = xpForLevel(level);
  return { level, current: xp - floor, needed: xpForLevel(level + 1) - floor };
}

export function touchStreak(s, today = dateKey(), events = []) {
  const st = s.streak;
  if (st.last === today) return;
  if (!st.last) {
    st.count = 1;
  } else {
    const gap = daysBetween(st.last, today);
    if (gap < 0) return; // clock went backwards; ignore
    if (gap === 1) {
      st.count += 1;
    } else if (gap > 1) {
      const missed = gap - 1;
      if (st.freezes >= missed) {
        st.freezes -= missed;
        st.count += 1;
        events.push({ type: 'freeze-used', n: missed });
      } else {
        st.count = 1;
      }
    }
  }
  st.last = today;
  st.best = Math.max(st.best || 0, st.count);
  if (st.count % 7 === 0 && st.freezes < MAX_FREEZES) {
    st.freezes += 1;
    events.push({ type: 'freeze-earned' });
  }
}

// Streak as it should be displayed right now (without mutating).
export function currentStreak(s, today = dateKey()) {
  const st = s.streak;
  if (!st.last) return { count: 0, doneToday: false, atRisk: false };
  const gap = daysBetween(st.last, today);
  if (gap <= 0) return { count: st.count, doneToday: true, atRisk: false };
  if (gap === 1) return { count: st.count, doneToday: false, atRisk: true };
  if (st.freezes >= gap - 1) return { count: st.count, doneToday: false, atRisk: true, frozen: true };
  return { count: 0, doneToday: false, atRisk: false, lost: st.count };
}

export function awardXP(s, amount, events = [], today = dateKey(), now = new Date()) {
  if (!amount || amount <= 0) return;
  const before = s.xpLog[today] || 0;
  const levelBefore = levelFromXP(s.xp).level;
  s.xp += amount;
  s.xpLog[today] = before + amount;
  if (before < s.settings.dailyGoal && s.xpLog[today] >= s.settings.dailyGoal) {
    s.goalsMet = (s.goalsMet || 0) + 1;
    events.push({ type: 'goal' });
  }
  const levelAfter = levelFromXP(s.xp).level;
  if (levelAfter > levelBefore) events.push({ type: 'level', level: levelAfter });
  touchStreak(s, today, events);
  const h = now.getHours();
  if (h < 7) s.meta.earlyBird = true;
  if (h >= 22) s.meta.nightOwl = true;
}

export function recordSpeech(s, { seconds = 0, passed = false, score = 0 } = {}) {
  const sp = s.speaking;
  sp.seconds += Math.max(0, Math.min(seconds, 60));
  sp.attempts += 1;
  if (passed) sp.sentences += 1;
  if (score >= 0.95) sp.aces += 1;
}

export function completeLesson(s, lang, lessonId, { accuracy = 1, cardIds = [] } = {}, events = [], today = dateKey()) {
  s.lessons[lang] ||= {};
  s.cards[lang] ||= {};
  const prev = s.lessons[lang][lessonId];
  s.lessons[lang][lessonId] = {
    done: true,
    best: Math.max(prev?.best || 0, accuracy),
    times: (prev?.times || 0) + 1,
    at: today,
  };
  for (const id of cardIds) {
    if (!s.cards[lang][id]) s.cards[lang][id] = newCard(today);
  }
  let xp = XP.lesson;
  if (accuracy >= 1) {
    s.perfectLessons = (s.perfectLessons || 0) + 1;
    xp += XP.perfect;
  }
  awardXP(s, xp, events, today);
  return xp;
}

export function lessonsDone(s) {
  return Object.values(s.lessons || {}).reduce((n, l) => n + Object.values(l).filter((x) => x.done).length, 0);
}
