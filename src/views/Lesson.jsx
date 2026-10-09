import { useState } from 'preact/hooks';
import { useCourse } from '../components/context.js';
import { BuildStep, ChoiceStep, DialogueStep, LearnStep, PromptStep, TipStep } from '../components/Steps.jsx';
import { buildSteps, GRADED } from '../lib/lesson.js';
import { awardXP, completeLesson, XP } from '../lib/gamify.js';
import { update, useStore } from '../lib/store.js';
import { cardId, isUnlocked, nextLessonId } from '../lib/content.js';
import { stopSpeaking } from '../lib/speech.js';
import { sfx } from '../lib/sfx.js';
import { navigate } from '../router.js';

const COMPONENTS = { tip: TipStep, learn: LearnStep, listen: ChoiceStep, read: ChoiceStep, build: BuildStep, dialogue: DialogueStep, prompt: PromptStep };

export function xpFor(step, r) {
  switch (step.type) {
    case 'learn':
      return r.passed ? XP.speakPass : 0;
    case 'listen':
    case 'read':
      return r.correct && !step.retry ? XP.step : 0;
    case 'build':
      return (r.correct && !step.retry ? XP.build : 0) + (r.passed ? XP.speakPass : 0);
    case 'dialogue':
      return XP.dialogue;
    case 'prompt':
      return r.passed ? XP.prompt + (r.fast ? XP.promptFast : 0) : 0;
    default:
      return 0;
  }
}

export function LessonView({ lessonId }) {
  const course = useCourse();
  const s = useStore();
  const entry = course.lessonIndex.get(lessonId);
  const [queue, setQueue] = useState(() => (entry ? buildSteps(entry.lesson, entry.unit) : []));
  const [pos, setPos] = useState(0);
  const [tally, setTally] = useState({ graded: 0, correct: 0, xp: 0, spoke: 0, passed: 0 });
  const [summary, setSummary] = useState(null);
  const done = s.lessons[course.lang.code] || {};

  if (!entry) {
    return (
      <section class="card">
        <h1>Lesson not found</h1>
        <a class="btn primary" href="#/">Back to the path</a>
      </section>
    );
  }
  if (!isUnlocked(course, done, lessonId)) {
    return (
      <section class="card center">
        <h1>🔒 Locked</h1>
        <p>Finish the previous lessons first to unlock “{entry.lesson.title}”.</p>
        <a class="btn primary" href="#/">Back to the path</a>
      </section>
    );
  }

  const step = queue[pos];
  const onDone = (r) => {
    stopSpeaking();
    const xp = xpFor(step, r);
    if (xp) update((d, ev) => awardXP(d, xp, ev));
    const t = { ...tally, xp: tally.xp + xp };
    if (r.spoke) t.spoke += 1;
    if (r.passed) t.passed += 1;
    let q = queue;
    if (GRADED.has(step.type) && !step.retry) {
      t.graded += 1;
      if (r.correct) t.correct += 1;
      else q = [...queue, { ...step, retry: true }];
    }
    setTally(t);
    if (pos + 1 >= q.length) {
      const accuracy = t.graded ? t.correct / t.graded : 1;
      const cardIds = entry.lesson.phrases.map((_, i) => cardId(lessonId, i));
      let bonus = 0;
      update((d, ev) => {
        bonus = completeLesson(d, course.lang.code, lessonId, { accuracy, cardIds }, ev);
      });
      sfx('done');
      setSummary({ ...t, xp: t.xp + bonus, accuracy });
    } else {
      setQueue(q);
      setPos(pos + 1);
    }
  };

  const quit = () => {
    if (confirm('Leave this lesson? Your progress in this lesson will be lost (XP you earned stays).')) {
      stopSpeaking();
      navigate('#/');
    }
  };

  if (summary) {
    const next = nextLessonId(course, s.lessons[course.lang.code]);
    const nextEntry = next && course.lessonIndex.get(next);
    return (
      <section class="card summary center">
        <div class="confetti" aria-hidden="true">🎉</div>
        <h1>Lesson complete!</h1>
        <p class="lead">{entry.lesson.title}</p>
        <div class="stat-grid">
          <div class="stat"><span class="stat-num">+{summary.xp}</span><span>XP</span></div>
          <div class="stat"><span class="stat-num">{Math.round(summary.accuracy * 100)}%</span><span>accuracy</span></div>
          <div class="stat"><span class="stat-num">{summary.passed}</span><span>sentences spoken</span></div>
        </div>
        <p class="muted small">The phrases from this lesson are now in your review deck 🔁</p>
        <div class="row gap center wrap">
          {nextEntry ? (
            <a class="btn primary" href={`#/lesson/${next}`}>
              Next: {nextEntry.lesson.title} →
            </a>
          ) : (
            <a class="btn primary" href="#/">Back to the path</a>
          )}
          <a class="btn ghost" href="#/">Home</a>
        </div>
      </section>
    );
  }

  const Comp = COMPONENTS[step.type];
  return (
    <section class="lesson" aria-label={`Lesson: ${entry.lesson.title}`}>
      <div class="lesson-top">
        <button type="button" class="btn-icon" onClick={quit} aria-label="Leave lesson">✕</button>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax={queue.length} aria-valuenow={pos}>
          <span style={{ width: `${(pos / queue.length) * 100}%` }} />
        </div>
        <span class="xp-chip" title="XP earned in this lesson">⭐ {tally.xp}</span>
      </div>
      {step.retry && <p class="retry-note">🔁 Let's try this one again</p>}
      <Comp key={pos} step={step} done={onDone} />
    </section>
  );
}
