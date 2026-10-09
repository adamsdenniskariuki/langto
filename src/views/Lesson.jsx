import { useEffect, useRef, useState } from 'preact/hooks';
import { useCourse } from '../components/context.js';
import { BuildStep, ChoiceStep, DialogueStep, LearnStep, PromptStep, TipStep } from '../components/Steps.jsx';
import { BranchStep, CultureStep, DrillStep, FreeStep, PairStep, QuestionStep, RecallStep, StoryStep, StressStep } from '../components/ExtraSteps.jsx';
import { buildSteps, EXAM_PASS, GRADED, isExam, kindOf, KINDS, NO_RETRY } from '../lib/lesson.js';
import { awardXP, completeLesson, recordMiss, XP } from '../lib/gamify.js';
import { update, useStore } from '../lib/store.js';
import { cardId, isUnlocked, levelReached, nextLessonId } from '../lib/content.js';
import { stopSpeaking } from '../lib/speech.js';
import { sfx } from '../lib/sfx.js';
import { navigate } from '../router.js';

const COMPONENTS = {
  tip: TipStep, learn: LearnStep, listen: ChoiceStep, read: ChoiceStep, build: BuildStep, dialogue: DialogueStep, prompt: PromptStep,
  culture: CultureStep, recall: RecallStep, pair: PairStep, stress: StressStep, drill: DrillStep, story: StoryStep, question: QuestionStep,
  branch: BranchStep, free: FreeStep,
};

export function xpFor(step, r) {
  switch (step.type) {
    case 'learn':
    case 'stress':
      return r.passed ? XP.speakPass : 0;
    case 'listen':
    case 'read':
      return r.correct && !step.retry ? XP.step : 0;
    case 'pair':
      return (r.correct && !step.retry ? XP.pair : 0) + (r.passed ? XP.speakPass : 0);
    case 'build':
      return (r.correct && !step.retry ? XP.build : 0) + (r.passed ? XP.speakPass : 0);
    case 'dialogue':
      return XP.dialogue;
    case 'prompt':
      return r.passed ? XP.prompt + (r.fast ? XP.promptFast : 0) : 0;
    case 'drill':
      return r.passed ? XP.drill : 0;
    case 'question':
      return r.passed ? XP.question : 0;
    case 'recall':
      return r.correct ? XP.recall : 0;
    case 'branch':
      return r.branch ? XP.branch + (r.good ? XP.branchGood : 0) : 0;
    case 'free':
      return r.free ? XP.free + Math.min(4, r.hits || 0) * XP.freeTarget : 0;
    default:
      return 0;
  }
}

export function LessonView({ lessonId }) {
  const [attempt, setAttempt] = useState(0);
  return <LessonRun key={attempt} lessonId={lessonId} retry={() => setAttempt((a) => a + 1)} />;
}

function LessonRun({ lessonId, retry }) {
  const course = useCourse();
  const s = useStore();
  const entry = course.lessonIndex.get(lessonId);
  const [queue, setQueue] = useState(() => (entry ? buildSteps(entry.lesson, entry.unit, Math.random, entry.level) : []));
  const [pos, setPos] = useState(0);
  const [tally, setTally] = useState({ graded: 0, correct: 0, xp: 0, spoke: 0, passed: 0 });
  const [summary, setSummary] = useState(null);
  const lang = course.lang.code;
  const done = s.lessons[lang] || {};

  if (!entry) {
    return (
      <section class="card">
        <h1>Lesson not found</h1>
        <a class="btn primary" href="#/">Back to the path</a>
      </section>
    );
  }
  const kind = kindOf(entry.lesson);
  const exam = isExam(entry.lesson);
  if (!isUnlocked(course, done, lessonId, s.levelStarts?.[lang])) {
    return (
      <section class="card center">
        <h1>🔒 Locked</h1>
        <p>{entry.track && !levelReached(course, done, entry.unit.level, s.levelStarts?.[lang]) ? `This sound unlocks when you reach ${entry.unit.level}.` : 'Finish the previous lessons first'} — “{entry.lesson.title}”.</p>
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
      else {
        const missId = r.cardId || step.cardId || (step.i !== undefined ? cardId(lessonId, step.i) : null);
        if (missId) update((d) => recordMiss(d, lang, missId));
        if (!NO_RETRY.has(step.type)) q = [...queue, { ...step, retry: true }];
      }
    }
    setTally(t);
    if (pos + 1 >= q.length) {
      const accuracy = t.graded ? t.correct / t.graded : 1;
      if (exam && accuracy < EXAM_PASS) {
        sfx('bad');
        setSummary({ ...t, accuracy, failed: true });
        return;
      }
      const cardIds = (entry.lesson.phrases || []).map((_, i) => cardId(lessonId, i));
      let bonus = 0;
      update((d, ev) => {
        bonus = completeLesson(d, lang, lessonId, { accuracy, cardIds, kind, level: entry.level?.id }, ev);
      });
      sfx('done');
      setSummary({ ...t, xp: t.xp + bonus, accuracy });
    } else {
      setQueue(q);
      setPos(pos + 1);
    }
  };

  const [leaving, setLeaving] = useState(false);
  const quit = () => setLeaving(true);
  const leave = () => {
    stopSpeaking();
    navigate('#/');
  };

  if (summary) {
    const doneNow = s.lessons[lang] || {};
    let next;
    if (entry.track) {
      const sib = entry.unit.lessons[entry.index + 1];
      next = sib && !doneNow[sib.id]?.done ? sib.id : null;
    } else {
      const after = course.order[course.order.indexOf(lessonId) + 1];
      next = after && !doneNow[after]?.done ? after : nextLessonId(course, doneNow, s.levelStarts?.[lang]);
    }
    const nextEntry = next && course.lessonIndex.get(next);
    if (summary.failed) {
      return (
        <section class="card summary center">
          <div class="confetti" aria-hidden="true">💪</div>
          <h1>Almost there!</h1>
          <p class="lead">{entry.lesson.title}</p>
          <div class="stat-grid">
            <div class="stat"><span class="stat-num">{Math.round(summary.accuracy * 100)}%</span><span>remembered</span></div>
            <div class="stat"><span class="stat-num">{Math.round(EXAM_PASS * 100)}%</span><span>needed</span></div>
            <div class="stat"><span class="stat-num">+{summary.xp}</span><span>XP</span></div>
          </div>
          <p class="muted small">The ones you missed are waiting in Review → Most missed. Practise them, then try again.</p>
          <div class="row gap center wrap">
            <button type="button" class="btn primary" onClick={retry}>🔁 Try again</button>
            <a class="btn ghost" href="#/review">Practise most missed</a>
            <a class="btn ghost" href="#/">Home</a>
          </div>
        </section>
      );
    }
    const title = kind === 'test' ? `${entry.level.id} speaking test passed!` : kind === 'checkpoint' ? 'Checkpoint passed!' : 'Lesson complete!';
    return (
      <section class="card summary center">
        <div class="confetti" aria-hidden="true">{kind === 'test' ? '🏆' : kind === 'checkpoint' ? '🚩' : '🎉'}</div>
        <h1>{title}</h1>
        <p class="lead">{entry.lesson.title}</p>
        <div class="stat-grid">
          <div class="stat"><span class="stat-num">+{summary.xp}</span><span>XP</span></div>
          <div class="stat"><span class="stat-num">{Math.round(summary.accuracy * 100)}%</span><span>accuracy</span></div>
          <div class="stat"><span class="stat-num">{summary.passed}</span><span>sentences spoken</span></div>
        </div>
        {(entry.lesson.phrases || []).length > 0 && <p class="muted small">The phrases from this lesson are now in your review deck 🔁</p>}
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
    <section class="lesson" aria-label={`${KINDS[kind].label}: ${entry.lesson.title}`}>
      <div class="lesson-top">
        <button type="button" class="btn-icon" onClick={quit} aria-label="Leave lesson">✕</button>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax={queue.length} aria-valuenow={pos}>
          <span style={{ width: `${(pos / queue.length) * 100}%` }} />
        </div>
        <span class="xp-chip" title="XP earned in this lesson">⭐ {tally.xp}</span>
      </div>
      {step.retry && <p class="retry-note">🔁 Let's try this one again</p>}
      <Comp key={pos} step={step} done={onDone} />
      {leaving && <LeaveDialog xp={tally.xp} onStay={() => setLeaving(false)} onLeave={leave} />}
    </section>
  );
}

export function leaveMessage(xp) {
  const keep = xp > 0 ? `You'll keep the ${xp} XP you've earned, but the lesson` : 'The lesson';
  return `${keep} won't count as complete — you'll start it from the beginning next time.`;
}

function LeaveDialog({ xp, onStay, onLeave }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (d?.showModal && !d.open) d.showModal();
    return () => d?.open && d.close();
  }, []);
  return (
    <dialog ref={ref} class="confirm-dialog card" aria-labelledby="leave-title" aria-describedby="leave-desc" onCancel={(e) => { e.preventDefault(); onStay(); }}>
      <h2 id="leave-title">Leave this lesson?</h2>
      <p id="leave-desc">{leaveMessage(xp)}</p>
      <div class="row gap wrap end">
        <button type="button" class="btn ghost" onClick={onLeave}>Leave</button>
        <button type="button" class="btn primary" onClick={onStay} autofocus>Keep going</button>
      </div>
    </dialog>
  );
}
