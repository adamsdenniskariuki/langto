// Loads course content (JSON under /content) and builds lookup indexes.
import { setCourseInfo } from './store.js';
import { kindOf } from './lesson.js';

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
  const info = { units: {}, levels: {}, tests: {} };
  const levels = [];
  const addPhrases = (lesson, unit) => (lesson.phrases || []).forEach((p, i) => phraseIndex.set(cardId(lesson.id, i), { phrase: p, lesson, unit }));
  for (const level of course.levels) {
    const units = await Promise.all((level.units || []).map((u) => getJSON(dir + u)));
    info.levels[level.id] = [];
    const full = { ...level, units };
    for (const unit of units) {
      info.units[unit.id] = unit.lessons.map((l) => l.id);
      unit.lessons.forEach((lesson, li) => {
        lessonIndex.set(lesson.id, { lesson, unit, level: full, index: li });
        order.push(lesson.id);
        info.levels[level.id].push(lesson.id);
        if (lesson.kind === 'test') info.tests[level.id] = lesson.id;
        addPhrases(lesson, unit);
      });
    }
    levels.push(full);
  }
  // Side tracks (e.g. pronunciation): units carry a `level`; they open once the learner reaches that level.
  const tracks = [];
  for (const track of course.tracks || []) {
    const units = await Promise.all((track.units || []).map((u) => getJSON(dir + u)));
    const full = { ...track, units };
    for (const unit of units) {
      info.units[unit.id] = unit.lessons.map((l) => l.id);
      unit.lessons.forEach((lesson, li) => {
        lessonIndex.set(lesson.id, { lesson, unit, level: levels.find((l) => l.id === unit.level) || levels[0], track: full, index: li });
        addPhrases(lesson, unit);
      });
    }
    tracks.push(full);
  }
  setCourseInfo(lang.code, info);
  return { lang, course, levels, tracks, lessonIndex, phraseIndex, order };
}

/** Has the learner reached this CEFR level (first level, chose to start there, or opened any of its lessons)? */
export function levelReached(course, done, levelId, starts = {}) {
  const lvl = course.levels.find((l) => l.id === levelId);
  if (!lvl || lvl === course.levels[0] || starts?.[levelId]) return true;
  const ids = lvl.units.flatMap((u) => u.lessons.map((l) => l.id));
  return ids.length > 0 && isUnlocked(course, done, ids[0], starts);
}

// Lessons unlock sequentially; the first lesson of a level is also unlocked when the learner chose to start
// at that level (`starts` = { [levelId]: true }), so advanced learners can skip ahead.
export function isUnlocked(course, done, lessonId, starts = {}) {
  const entry = course.lessonIndex.get(lessonId);
  if (entry?.track) {
    if (done?.[lessonId]?.done) return true;
    if (!levelReached(course, done, entry.unit.level, starts)) return false;
    return entry.index === 0 || !!done?.[entry.unit.lessons[entry.index - 1].id]?.done;
  }
  const i = course.order.indexOf(lessonId);
  if (i <= 0 || !!done?.[lessonId]?.done || !!done?.[course.order[i - 1]]?.done) return true;
  if (!entry) return false;
  if (firstOfLevel(course, entry.level.id) !== lessonId) return false;
  if (starts?.[entry.level.id]) return true;
  // Finishing the core lessons of the previous level also opens the next one, so learners who finished a level
  // before extra lessons (grammar, listening, checkpoints…) were added keep their access.
  const levels = course.levels || [];
  const prev = levels[levels.findIndex((l) => l.id === entry.level.id) - 1];
  const core = prev ? prev.units.flatMap((u) => u.lessons).filter((l) => kindOf(l) === 'lesson') : [];
  return core.length > 0 && core.every((l) => done?.[l.id]?.done);
}

const firstOfLevel = (course, levelId) => course.order.find((id) => course.lessonIndex.get(id)?.level.id === levelId);

// The lesson to continue with: the unlocked, unfinished lesson in the highest level the learner has reached.
export function nextLessonId(course, done, starts = {}) {
  const open = course.order.filter((id) => !done?.[id]?.done && isUnlocked(course, done, id, starts));
  return open[open.length - 1] || null;
}
