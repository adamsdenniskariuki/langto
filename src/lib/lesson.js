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

/**
 * @param lesson lesson JSON
 * @param unit   unit JSON (for distractors)
 */
export function buildSteps(lesson, unit, rand = Math.random) {
  const pool = [...lesson.phrases, ...unit.lessons.filter((l) => l !== lesson).flatMap((l) => l.phrases)];
  const indexed = lesson.phrases.map((phrase, i) => ({ phrase, i }));
  const steps = [];
  if (lesson.tip) steps.push({ type: 'tip', tip: lesson.tip });

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
  if (lesson.dialogue) steps.push({ type: 'dialogue', dialogue: lesson.dialogue });
  for (const prompt of lesson.prompts || []) steps.push({ type: 'prompt', prompt });
  return steps;
}

// Steps that are graded (count towards accuracy).
export const GRADED = new Set(['listen', 'read', 'build']);
