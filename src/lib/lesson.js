// Turns a lesson's content (phrases, dialogue, prompts) into an ordered sequence of exercise steps.

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const stripPunct = (t) => t.replace(/[.,!?;:¿¡…"„“]/g, '').trim();
export const words = (t) => stripPunct(t).split(/\s+/).filter(Boolean);

export function pickOptions(correct, pool, key, rand = Math.random) {
  const seen = new Set([correct[key]]);
  const others = [];
  for (const p of shuffle(pool, rand)) {
    if (!seen.has(p[key])) {
      seen.add(p[key]);
      others.push(p[key]);
    }
    if (others.length === 3) break;
  }
  return shuffle([correct[key], ...others], rand);
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  if (out.length > 1 && out[out.length - 1].length === 1) out[out.length - 2].push(...out.pop());
  return out;
}

// Lesson kinds (optional `kind` field). Plain lessons are 'lesson'.
export const KINDS = {
  lesson: { icon: '', label: 'Lesson' },
  grammar: { icon: '🧩', label: 'Grammar' },
  listening: { icon: '🎧', label: 'Listening' },
  roleplay: { icon: '🎭', label: 'Role-play' },
  speaking: { icon: '🗣️', label: 'Free speaking' },
  pron: { icon: '👄', label: 'Pronunciation' },
  checkpoint: { icon: '🚩', label: 'Checkpoint' },
  test: { icon: '🏆', label: 'Level test' },
};
export const kindOf = (lesson) => (KINDS[lesson?.kind] ? lesson.kind : 'lesson');
export const isExam = (lesson) => ['checkpoint', 'test'].includes(kindOf(lesson));
// Share of recall items a checkpoint / level test needs to pass.
export const EXAM_PASS = 0.7;

const phrasesOf = (l) => l?.phrases || [];

/**
 * Recall items for a checkpoint (`sources` = the unit's other lessons) or level test (all lessons of the level).
 * Each item: { phrase, cardId } — English shown, learner says the German from memory.
 */
export function examItems(sources, count, rand = Math.random) {
  const all = [];
  for (const l of sources) {
    if (isExam(l)) continue;
    phrasesOf(l).forEach((phrase, i) => all.push({ phrase, cardId: `${l.id}#${i}` }));
  }
  const seen = new Set();
  const unique = all.filter((x) => !seen.has(x.phrase.t) && seen.add(x.phrase.t));
  return shuffle(unique, rand).slice(0, count);
}

/**
 * @param lesson lesson JSON
 * @param unit   unit JSON (for distractors)
 * @param level  optional { units } — used by level tests to sample across the level
 */
export function buildSteps(lesson, unit, rand = Math.random, level = null) {
  const kind = kindOf(lesson);
  if (kind === 'checkpoint' || kind === 'test') {
    const sources = kind === 'test' && level ? level.units.flatMap((u) => u.lessons) : unit.lessons;
    const n = kind === 'test' ? 12 : 10;
    const steps = [];
    if (lesson.tip) steps.push({ type: 'tip', tip: lesson.tip });
    steps.push({ type: 'tip', tip: { title: kind === 'test' ? 'Level speaking test' : 'Speaking checkpoint', body: `You'll see ${n} sentences in English only. Say each one in the language you're learning — from memory. Get ${Math.round(EXAM_PASS * 100)}% to pass.` } });
    for (const it of examItems(sources, n, rand)) steps.push({ type: 'recall', exam: true, ...it });
    if (kind === 'test') {
      const prompts = shuffle(sources.filter((l) => !isExam(l)).flatMap((l) => l.prompts || []), rand).slice(0, 3);
      for (const prompt of prompts) steps.push({ type: 'prompt', prompt });
    }
    return steps;
  }

  const own = phrasesOf(lesson);
  const pool = [...own, ...unit.lessons.filter((l) => l !== lesson).flatMap(phrasesOf)];
  const indexed = own.map((phrase, i) => ({ phrase, i }));
  const steps = [];
  if (lesson.tip) steps.push({ type: 'tip', tip: lesson.tip });
  if (lesson.culture) steps.push({ type: 'culture', note: lesson.culture });

  let flip = 0;
  for (const group of chunk(indexed, 3)) {
    for (const { phrase, i } of group) steps.push({ type: 'learn', phrase, i });
    const quiz = [];
    for (const { phrase, i } of group) {
      quiz.push(
        flip++ % 2 === 0
          ? { type: 'listen', phrase, i, options: pickOptions(phrase, pool, 'n', rand) }
          : { type: 'read', phrase, i, options: pickOptions(phrase, pool, 't', rand) }
      );
      const w = words(phrase.t);
      if (w.length >= 3) {
        const extra = shuffle(pool.flatMap((p) => words(p.t)).filter((x) => !w.includes(x)), rand).slice(0, 2);
        quiz.push({ type: 'build', phrase, i, tiles: shuffle([...w, ...extra], rand) });
      }
    }
    steps.push(...shuffle(quiz, rand));
  }
  // Pronunciation: minimal pairs ("which did you hear?") then sentence stress shadowing.
  for (const pair of lesson.pairs || []) {
    const pickA = rand() < 0.5;
    steps.push({ type: 'pair', pair, target: pickA ? 'a' : 'b' });
  }
  for (const line of lesson.stress || []) steps.push({ type: 'stress', line });
  // Grammar in context: substitution drills.
  for (const drill of lesson.drills || []) {
    for (const item of drill.items || []) steps.push({ type: 'drill', base: drill.base, item, title: drill.title });
  }
  if (lesson.dialogue) steps.push({ type: 'dialogue', dialogue: lesson.dialogue });
  if (lesson.story) {
    steps.push({ type: 'story', story: lesson.story });
    for (const q of lesson.story.questions || []) steps.push({ type: 'question', question: q, story: lesson.story });
  }
  if (lesson.branch) steps.push({ type: 'branch', branch: lesson.branch });
  for (const task of lesson.free || []) steps.push({ type: 'free', task });
  for (const prompt of lesson.prompts || []) steps.push({ type: 'prompt', prompt });
  return steps;
}

// Steps that are graded (count towards accuracy). Recall steps in exams are graded but never retried.
export const GRADED = new Set(['listen', 'read', 'build', 'pair', 'recall']);
export const NO_RETRY = new Set(['recall']);

/** Highlight stress: "Ich *kom*me aus *Ber*lin" → [{text, stress}]. */
export function stressParts(mark) {
  return String(mark || '').split(/(\*[^*]+\*)/).filter(Boolean).map((p) => (p.startsWith('*') && p.endsWith('*') ? { text: p.slice(1, -1), stress: true } : { text: p, stress: false }));
}

/** Choose the branch option that best matches what was heard. Returns { index, score } (index -1 if nothing close). */
export function pickChoice(scores, min = 0.5) {
  let best = { index: -1, score: 0 };
  scores.forEach((s, i) => {
    if (s > best.score) best = { index: i, score: s };
  });
  return best.score >= min ? best : { index: -1, score: best.score };
}
