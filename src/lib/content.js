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

// First not-yet-completed lesson in order; lessons unlock sequentially.
export function nextLessonId(course, done) {
  return course.order.find((id) => !done?.[id]?.done) || null;
}

export function isUnlocked(course, done, lessonId) {
  const i = course.order.indexOf(lessonId);
  return i <= 0 || !!done?.[course.order[i - 1]]?.done || !!done?.[lessonId]?.done;
}
