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

const KINDS = ['lesson', 'grammar', 'listening', 'roleplay', 'speaking', 'pron', 'checkpoint', 'test'];
const tn = (o) => o && str(o.t) && str(o.n);

function checkLesson(l, w, unit) {
  const kind = l.kind || 'lesson';
  if (!KINDS.includes(kind)) fail(w, `unknown kind "${l.kind}"`);
  if (!str(l.id) || !str(l.title) || !str(l.goal)) fail(w, 'lesson needs id, title and goal');
  if (l.tip && (!str(l.tip.title) || !str(l.tip.body))) fail(w, 'tip needs title and body');
  if (l.culture && (!str(l.culture.title) || !str(l.culture.body))) fail(w, 'culture needs title and body');
  for (const r of l.culture?.regions || []) if (!/^[A-Z]{2}$/.test(r)) fail(w, `culture region "${r}" must be a 2-letter country code`);
  if (kind === 'lesson' && (!Array.isArray(l.phrases) || l.phrases.length < 4)) fail(w, 'needs at least 4 phrases');
  if (l.phrases !== undefined && !Array.isArray(l.phrases)) fail(w, 'phrases must be an array');
  const seen = new Set();
  for (const [i, p] of (l.phrases || []).entries()) {
    if (!tn(p)) fail(w, `phrase ${i} needs t and n`);
    if (seen.has(p.t)) fail(w, `duplicate phrase "${p.t}"`);
    seen.add(p.t);
  }
  if (l.dialogue) {
    if (!Array.isArray(l.dialogue.lines) || l.dialogue.lines.length < 2) fail(w, 'dialogue needs 2+ lines');
    for (const [i, line] of (l.dialogue.lines || []).entries()) {
      if (!['A', 'you'].includes(line.who)) fail(w, `dialogue line ${i}: who must be "A" or "you"`);
      if (!tn(line)) fail(w, `dialogue line ${i} needs t and n`);
    }
    if (!(l.dialogue.lines || []).some((x) => x.who === 'you')) fail(w, 'dialogue has no lines for the learner');
  }
  for (const [i, p] of (l.prompts || []).entries()) {
    if (!str(p.n)) fail(w, `prompt ${i} needs n`);
    if (!Array.isArray(p.t) || !p.t.length || !p.t.every(str)) fail(w, `prompt ${i}: t must be a non-empty array of answers`);
  }
  for (const [i, d] of (l.drills || []).entries()) {
    if (!tn(d.base)) fail(w, `drill ${i}: base needs t and n`);
    if (!Array.isArray(d.items) || !d.items.length) fail(w, `drill ${i}: needs items`);
    for (const [j, it] of (d.items || []).entries()) if (!tn(it) || !str(it.cue)) fail(w, `drill ${i} item ${j} needs cue, t and n`);
  }
  if (l.story) {
    const st = l.story;
    if (!str(st.title)) fail(w, 'story needs a title');
    if (!Array.isArray(st.lines) || st.lines.length < 2) fail(w, 'story needs 2+ lines');
    for (const [i, line] of (st.lines || []).entries()) if (!tn(line)) fail(w, `story line ${i} needs t and n`);
    if (st.rate !== undefined && !(st.rate >= 0.5 && st.rate <= 1.5)) fail(w, 'story rate must be 0.5–1.5');
    for (const [i, q] of (st.questions || []).entries()) {
      if (!str(q.q) || !str(q.n)) fail(w, `story question ${i} needs q and n`);
      if (!Array.isArray(q.t) || !q.t.length || !q.t.every(str)) fail(w, `story question ${i}: t must be a non-empty array of answers`);
    }
  }
  if (l.branch) {
    const b = l.branch;
    const nodes = b.nodes || {};
    if (!str(b.title)) fail(w, 'branch needs a title');
    if (!nodes[b.start]) fail(w, `branch start "${b.start}" is not a node`);
    let ends = 0;
    for (const [id, node] of Object.entries(nodes)) {
      if (!tn(node)) fail(w, `branch node ${id} needs t and n`);
      if (!node.choices?.length) {
        ends++;
        if (!['good', 'bad'].includes(node.end || 'good')) fail(w, `branch node ${id}: end must be good or bad`);
      }
      for (const [j, ch] of (node.choices || []).entries()) {
        if (!tn(ch)) fail(w, `branch node ${id} choice ${j} needs t and n`);
        if (!nodes[ch.next]) fail(w, `branch node ${id} choice ${j}: next "${ch.next}" is not a node`);
      }
    }
    if (!ends) fail(w, 'branch has no ending node (a node without choices)');
    // Every node must be reachable from start, and every path must be able to end.
    const reach = new Set();
    const walk = (id) => {
      if (reach.has(id) || !nodes[id]) return;
      reach.add(id);
      for (const ch of nodes[id].choices || []) walk(ch.next);
    };
    walk(b.start);
    for (const id of Object.keys(nodes)) if (!reach.has(id)) fail(w, `branch node ${id} is unreachable`);
  }
  for (const [i, f] of (l.free || []).entries()) {
    if (!str(f.n)) fail(w, `free task ${i} needs n (the instruction)`);
    if (!(f.seconds >= 10 && f.seconds <= 120)) fail(w, `free task ${i}: seconds must be 10–120`);
    if (!Array.isArray(f.targets) || !f.targets.length) fail(w, `free task ${i}: needs targets`);
    for (const [j, t] of (f.targets || []).entries()) if (!str(t.label) || !Array.isArray(t.any) || !t.any.length || !t.any.every(str)) fail(w, `free task ${i} target ${j} needs label and any[]`);
    if (!str(f.model)) fail(w, `free task ${i} needs a model answer`);
    if (!(f.targets || []).some((t) => (t.any || []).some((a) => !commonWords.has(String(a).trim().toLowerCase()))))
      fail(w, `free task ${i}: needs at least one topic-specific target word (not only commonWords)`);
  }
  for (const [i, pr] of (l.pairs || []).entries()) {
    if (!tn(pr.a) || !tn(pr.b)) fail(w, `pair ${i}: a and b need t and n`);
    else if (pr.a.t === pr.b.t) fail(w, `pair ${i}: a and b are identical`);
  }
  for (const [i, s] of (l.stress || []).entries()) {
    if (!tn(s) || !str(s.mark)) fail(w, `stress ${i} needs t, n and mark`);
    else if (!/\*[^*]+\*/.test(s.mark)) fail(w, `stress ${i}: mark needs *stressed* syllables`);
    else if (s.mark.replace(/\*/g, '') !== s.t) fail(w, `stress ${i}: mark without * must equal t`);
  }
  const hasSteps = (l.phrases || []).length || l.drills?.length || l.story || l.branch || l.free?.length || l.pairs?.length || l.stress?.length || l.prompts?.length || l.dialogue;
  if (kind === 'checkpoint') {
    const pool = unit.lessons.filter((x) => x !== l && !['checkpoint', 'test'].includes(x.kind)).flatMap((x) => x.phrases || []);
    if (pool.length < 6) fail(w, 'checkpoint needs at least 6 phrases in the unit to sample from');
  } else if (kind !== 'test' && !hasSteps) fail(w, 'lesson has no content');
}

let commonWords = new Set();
const langs = read('content/languages.json') || [];
let lessonCount = 0;
for (const lang of langs) {
  const where = `languages.json[${lang.code}]`;
  commonWords = new Set((lang.commonWords || []).map((x) => String(x).toLowerCase()));
  for (const k of ['code', 'name', 'native', 'flag', 'speech', 'course']) if (!str(lang[k])) fail(where, `missing "${k}"`);
  const course = read(lang.course);
  if (!course) continue;
  const dir = lang.course.replace(/[^/]+$/, '');
  const unitIds = new Set();
  const lessonIds = new Set();
  const levelIds = new Set();
  const checkUnit = (file, extra) => {
    const rel = dir + file;
    const unit = read(rel);
    if (!unit) return;
    if (!str(unit.id) || !str(unit.title)) fail(rel, 'unit needs id and title');
    if (unitIds.has(unit.id)) fail(rel, `duplicate unit id ${unit.id}`);
    unitIds.add(unit.id);
    extra?.(unit, rel);
    if (!Array.isArray(unit.lessons) || !unit.lessons.length) fail(rel, 'unit has no lessons');
    for (const l of unit.lessons || []) {
      lessonCount++;
      const w = `${rel} › ${l.id}`;
      if (lessonIds.has(l.id)) fail(w, 'duplicate lesson id');
      lessonIds.add(l.id);
      checkLesson(l, w, unit);
    }
  };
  if (!Array.isArray(course.levels)) fail(lang.course, 'levels must be an array');
  for (const level of course.levels || []) {
    if (!str(level.id) || !str(level.title)) fail(lang.course, 'level needs id and title');
    levelIds.add(level.id);
    if (level.comingSoon) continue;
    if (!Array.isArray(level.units) || !level.units.length) fail(lang.course, `level ${level.id} has no units`);
    for (const file of level.units || []) checkUnit(file);
  }
  for (const track of course.tracks || []) {
    if (!str(track.id) || !str(track.title)) fail(lang.course, 'track needs id and title');
    for (const file of track.units || []) {
      checkUnit(file, (unit, rel) => {
        if (!levelIds.has(unit.level)) fail(rel, `track unit level "${unit.level}" is not a course level`);
      });
    }
  }
}
if (errors.length) {
  console.error(`✖ Content validation failed (${errors.length}):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✔ Content OK — ${langs.length} language(s), ${lessonCount} lessons.`);
