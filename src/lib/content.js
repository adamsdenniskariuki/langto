// Loads course content (JSON under /content) and builds lookup indexes.
import { setCourseInfo } from './store.js';

const base = import.meta.env?.BASE_URL ?? '/';
const cache = new Map();

function getJSON(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(base + path).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`);
        return r.json();
      })
    );
  }
  return cache.get(path);
}

export function loadLanguages() {
  return getJSON('content/languages.json');
}

export const cardId = (lessonId, i) => `${lessonId}#${i}`;

const courses = new Map();

export function loadCourse(code) {
  if (!courses.has(code)) {
    courses.set(code, buildCourse(code).catch((e) => {
      courses.delete(code);
      throw e;
    }));
  }
  return courses.get(code);
}

async function buildCourse(code) {
  const langs = await loadLanguages();
  const lang = langs.find((l) => l.code === code) || langs[0];
  const course = await getJSON(lang.course);
  const dir = lang.course.replace(/[^/]+$/, '');
  const lessonIndex = new Map();
  const phraseIndex = new Map();
  const order = [];
  const info = { units: {}, levels: {} };
  const levels = [];
  for (const level of course.levels) {
    const units = await Promise.all((level.units || []).map((u) => getJSON(dir + u)));
    info.levels[level.id] = [];
    for (const unit of units) {
      info.units[unit.id] = unit.lessons.map((l) => l.id);
      unit.lessons.forEach((lesson, li) => {
        lessonIndex.set(lesson.id, { lesson, unit, level, index: li });
        order.push(lesson.id);
        info.levels[level.id].push(lesson.id);
        lesson.phrases.forEach((p, i) => phraseIndex.set(cardId(lesson.id, i), { phrase: p, lesson, unit }));
      });
    }
    levels.push({ ...level, units });
  }
  setCourseInfo(lang.code, info);
  return { lang, course, levels, lessonIndex, phraseIndex, order };
}

// Lessons unlock sequentially; the first lesson of a level is also unlocked when the learner chose to start
// at that level (`starts` = { [levelId]: true }), so advanced learners can skip ahead.
export function isUnlocked(course, done, lessonId, starts = {}) {
  const i = course.order.indexOf(lessonId);
  if (i <= 0 || !!done?.[lessonId]?.done || !!done?.[course.order[i - 1]]?.done) return true;
  const entry = course.lessonIndex.get(lessonId);
  return !!(entry && starts?.[entry.level.id] && firstOfLevel(course, entry.level.id) === lessonId);
}

const firstOfLevel = (course, levelId) => course.order.find((id) => course.lessonIndex.get(id)?.level.id === levelId);

// The lesson to continue with: the unlocked, unfinished lesson in the highest level the learner has reached.
export function nextLessonId(course, done, starts = {}) {
  const open = course.order.filter((id) => !done?.[id]?.done && isUnlocked(course, done, id, starts));
  return open[open.length - 1] || null;
}
