// Badge definitions. `test(state, courses)` where courses = { [lang]: { units: {unitId: [lessonIds]}, levels: {A1: [lessonIds]} } }.
import { lessonsDone } from './gamify.js';

const doneSet = (s, lang) => new Set(Object.entries(s.lessons?.[lang] || {}).filter(([, v]) => v.done).map(([k]) => k));

function anyUnitDone(s, courses) {
  return Object.entries(courses).some(([lang, c]) => {
    const done = doneSet(s, lang);
    return Object.values(c.units).some((ids) => ids.length && ids.every((id) => done.has(id)));
  });
}

function levelDone(s, courses, level) {
  return Object.entries(courses).some(([lang, c]) => {
    if (c.tests?.[level]) return !!s.tests?.[lang]?.[level];
    const ids = c.levels[level] || [];
    const done = doneSet(s, lang);
    return ids.length > 0 && ids.every((id) => done.has(id));
  });
}

const sp = (s, k) => s.speaking?.[k] || 0;

export const BADGES = [
  { id: 'first-lesson', icon: '🌱', name: 'First Steps', desc: 'Complete your first lesson.', test: (s) => lessonsDone(s) >= 1 },
  { id: 'five-lessons', icon: '📚', name: 'On a Roll', desc: 'Complete 5 lessons.', test: (s) => lessonsDone(s) >= 5 },
  { id: 'unit-master', icon: '🏁', name: 'Unit Master', desc: 'Finish every lesson in a unit.', test: (s, c) => anyUnitDone(s, c) },
  { id: 'checkpoint', icon: '🚩', name: 'Checkpoint Champ', desc: 'Pass a unit speaking checkpoint.', test: (s) => (s.checkpoints || 0) >= 1 },
  { id: 'checkpoint-10', icon: '🗺️', name: 'Trailblazer', desc: 'Pass 10 speaking checkpoints.', test: (s) => (s.checkpoints || 0) >= 10 },
  { id: 'free-talker', icon: '💭', name: 'Free Talker', desc: 'Complete a free speaking task.', test: (s) => sp(s, 'free') >= 1 },
  { id: 'free-25', icon: '🎤', name: 'Open Mic', desc: 'Complete 25 free speaking tasks.', test: (s) => sp(s, 'free') >= 25 },
  { id: 'sound-explorer', icon: '👄', name: 'Sound Explorer', desc: 'Finish a pronunciation lesson.', test: (s) => (s.pronLessons || 0) >= 1 },
  { id: 'clear-speaker', icon: '🔔', name: 'Clear Speaker', desc: 'Tell apart 50 minimal pairs.', test: (s) => sp(s, 'pairs') >= 50 },
  { id: 'sound-master', icon: '🎼', name: 'Sound Master', desc: 'Finish 10 pronunciation lessons.', test: (s) => (s.pronLessons || 0) >= 10 },
  { id: 'good-listener', icon: '🎧', name: 'Good Listener', desc: 'Answer 25 listening questions out loud.', test: (s) => sp(s, 'questions') >= 25 },
  { id: 'scene-stealer', icon: '🎬', name: 'Scene Stealer', desc: 'Finish 10 branching role-plays.', test: (s) => sp(s, 'branches') >= 10 },
  { id: 'pattern-pro', icon: '🧩', name: 'Pattern Pro', desc: 'Nail 50 grammar substitution drills.', test: (s) => sp(s, 'drills') >= 50 },
  { id: 'a1', level: 'A1', icon: '🎓', name: 'A1 Graduate', desc: 'Pass the A1 speaking test.', test: (s, c) => levelDone(s, c, 'A1') },
  { id: 'a2', level: 'A2', icon: '🧭', name: 'A2 Graduate', desc: 'Pass the A2 speaking test.', test: (s, c) => levelDone(s, c, 'A2') },
  { id: 'small-talker', level: 'A2', icon: '☕', name: 'Small Talker', desc: 'Say 250 sentences correctly.', test: (s) => s.speaking.sentences >= 250 },
  { id: 'b1', level: 'B1', icon: '🏅', name: 'B1 Graduate', desc: 'Pass the B1 speaking test — independent speaker!', test: (s, c) => levelDone(s, c, 'B1') },
  { id: 'storyteller', level: 'B1', icon: '📖', name: 'Storyteller', desc: 'Speak for 3 hours in total.', test: (s) => s.speaking.seconds >= 3 * 3600 },
  { id: 'b2', level: 'B2', icon: '🏆', name: 'B2 Graduate', desc: 'Pass the B2 speaking test.', test: (s, c) => levelDone(s, c, 'B2') },
  { id: 'negotiator', level: 'B2', icon: '🤝', name: 'Negotiator', desc: 'Complete 50 dialogues.', test: (s) => s.speaking.dialogues >= 50 },
  { id: 'c1', level: 'C1', icon: '👑', name: 'C1 Graduate', desc: 'Pass the C1 speaking test — proficient speaker!', test: (s, c) => levelDone(s, c, 'C1') },
  { id: 'silver-tongue', level: 'C1', icon: '🥈', name: 'Silver Tongue', desc: 'Score 95%+ on 100 sentences.', test: (s) => s.speaking.aces >= 100 },
  { id: 'c2', level: 'C2', icon: '💫', name: 'C2 Mastery', desc: 'Pass the C2 speaking test.', test: (s, c) => levelDone(s, c, 'C2') },
  { id: 'native-flow', level: 'C2', icon: '🌍', name: 'Native Flow', desc: 'Say 2,500 sentences correctly and speak for 10 hours.', test: (s) => s.speaking.sentences >= 2500 && s.speaking.seconds >= 10 * 3600 },
  { id: 'first-words', icon: '🗣️', name: 'First Words', desc: 'Say your first sentence out loud.', test: (s) => s.speaking.sentences >= 1 },
  { id: 'chatterbox', icon: '💬', name: 'Chatterbox', desc: 'Say 100 sentences correctly.', test: (s) => s.speaking.sentences >= 100 },
  { id: 'big-mouth', icon: '📣', name: 'Fearless Speaker', desc: 'Say 500 sentences correctly.', test: (s) => s.speaking.sentences >= 500 },
  { id: 'ten-minutes', icon: '⏱️', name: 'Ten Minutes Talking', desc: 'Speak for 10 minutes in total.', test: (s) => s.speaking.seconds >= 600 },
  { id: 'hour', icon: '🎙️', name: 'Radio Voice', desc: 'Speak for 60 minutes in total.', test: (s) => s.speaking.seconds >= 3600 },
  { id: 'role-play', icon: '🎭', name: 'Role Player', desc: 'Complete your first dialogue.', test: (s) => s.speaking.dialogues >= 1 },
  { id: 'dialogue-pro', icon: '🎬', name: 'Conversation Pro', desc: 'Complete 15 dialogues.', test: (s) => s.speaking.dialogues >= 15 },
  { id: 'quick', icon: '⚡', name: 'Quick Thinker', desc: 'Answer 25 timed speaking prompts.', test: (s) => s.speaking.prompts >= 25 },
  { id: 'ace', icon: '🎯', name: 'Pronunciation Ace', desc: 'Score 95%+ on 10 sentences.', test: (s) => s.speaking.aces >= 10 },
  { id: 'perfect', icon: '💎', name: 'Flawless', desc: 'Finish a lesson without a mistake.', test: (s) => (s.perfectLessons || 0) >= 1 },
  { id: 'reviewer', icon: '🔁', name: 'Memory Builder', desc: 'Review 50 cards.', test: (s) => (s.reviews || 0) >= 50 },
  { id: 'streak-3', icon: '🔥', name: 'Warming Up', desc: 'Reach a 3-day streak.', test: (s) => s.streak.best >= 3 },
  { id: 'streak-7', icon: '🔥', name: 'One Week Strong', desc: 'Reach a 7-day streak.', test: (s) => s.streak.best >= 7 },
  { id: 'streak-30', icon: '🌋', name: 'Unstoppable', desc: 'Reach a 30-day streak.', test: (s) => s.streak.best >= 30 },
  { id: 'goal-7', icon: '🥅', name: 'Goal Getter', desc: 'Hit your daily goal 7 times.', test: (s) => (s.goalsMet || 0) >= 7 },
  { id: 'xp-500', icon: '⭐', name: 'Rising Star', desc: 'Earn 500 XP.', test: (s) => s.xp >= 500 },
  { id: 'xp-2000', icon: '🌟', name: 'Superstar', desc: 'Earn 2,000 XP.', test: (s) => s.xp >= 2000 },
  { id: 'early-bird', icon: '🐦', name: 'Early Bird', desc: 'Practise before 7 am.', test: (s) => !!s.meta.earlyBird },
  { id: 'night-owl', icon: '🦉', name: 'Night Owl', desc: 'Practise after 10 pm.', test: (s) => !!s.meta.nightOwl },
  { id: 'backup', icon: '💾', name: 'Safe Keeper', desc: 'Export a backup of your progress.', test: (s) => (s.exports || 0) >= 1 },
];

export function newlyEarned(s, courses) {
  return BADGES.filter((b) => !s.badges[b.id] && b.test(s, courses));
}
