// Validates lesson content JSON so broken content never ships. Run: npm run validate
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const read = (rel) => {
  const p = join(root, rel);
  if (!existsSync(p)) {
    fail(rel, 'file not found');
    return null;
  }
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    fail(rel, `invalid JSON (${e.message})`);
    return null;
  }
};
const str = (v) => typeof v === 'string' && v.trim().length > 0;

const langs = read('content/languages.json') || [];
let lessonCount = 0;
for (const lang of langs) {
  const where = `languages.json[${lang.code}]`;
  for (const k of ['code', 'name', 'native', 'flag', 'speech', 'course']) if (!str(lang[k])) fail(where, `missing "${k}"`);
  const course = read(lang.course);
  if (!course) continue;
  const dir = lang.course.replace(/[^/]+$/, '');
  const unitIds = new Set();
  const lessonIds = new Set();
  if (!Array.isArray(course.levels)) fail(lang.course, 'levels must be an array');
  for (const level of course.levels || []) {
    if (!str(level.id) || !str(level.title)) fail(lang.course, 'level needs id and title');
    if (level.comingSoon) continue;
    if (!Array.isArray(level.units) || !level.units.length) fail(lang.course, `level ${level.id} has no units`);
    for (const file of level.units || []) {
      const rel = dir + file;
      const unit = read(rel);
      if (!unit) continue;
      if (!str(unit.id) || !str(unit.title)) fail(rel, 'unit needs id and title');
      if (unitIds.has(unit.id)) fail(rel, `duplicate unit id ${unit.id}`);
      unitIds.add(unit.id);
      if (!Array.isArray(unit.lessons) || !unit.lessons.length) fail(rel, 'unit has no lessons');
      for (const l of unit.lessons || []) {
        lessonCount++;
        const w = `${rel} › ${l.id}`;
        if (!str(l.id) || !str(l.title) || !str(l.goal)) fail(w, 'lesson needs id, title and goal');
        if (lessonIds.has(l.id)) fail(w, 'duplicate lesson id');
        lessonIds.add(l.id);
        if (l.tip && (!str(l.tip.title) || !str(l.tip.body))) fail(w, 'tip needs title and body');
        if (!Array.isArray(l.phrases) || l.phrases.length < 4) fail(w, 'needs at least 4 phrases');
        const seen = new Set();
        for (const [i, p] of (l.phrases || []).entries()) {
          if (!str(p.t) || !str(p.n)) fail(w, `phrase ${i} needs t and n`);
          if (seen.has(p.t)) fail(w, `duplicate phrase "${p.t}"`);
          seen.add(p.t);
        }
        if (l.dialogue) {
          if (!Array.isArray(l.dialogue.lines) || l.dialogue.lines.length < 2) fail(w, 'dialogue needs 2+ lines');
          for (const [i, line] of (l.dialogue.lines || []).entries()) {
            if (!['A', 'you'].includes(line.who)) fail(w, `dialogue line ${i}: who must be "A" or "you"`);
            if (!str(line.t) || !str(line.n)) fail(w, `dialogue line ${i} needs t and n`);
          }
          if (!(l.dialogue.lines || []).some((x) => x.who === 'you')) fail(w, 'dialogue has no lines for the learner');
        }
        for (const [i, p] of (l.prompts || []).entries()) {
          if (!str(p.n)) fail(w, `prompt ${i} needs n`);
          if (!Array.isArray(p.t) || !p.t.length || !p.t.every(str)) fail(w, `prompt ${i}: t must be a non-empty array of answers`);
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`✖ Content validation failed (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✔ Content OK — ${langs.length} language(s), ${lessonCount} lessons.`);
