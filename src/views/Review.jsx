import { useMemo, useState } from 'preact/hooks';
import { useCourse } from '../components/context.js';
import { ChoiceStep, Footer } from '../components/Steps.jsx';
import { SpeakBox } from '../components/SpeakBox.jsx';
import { PlayButton } from '../components/PlayButton.jsx';
import { update, useStore } from '../lib/store.js';
import { dueCards, gradeCard, strength } from '../lib/srs.js';
import { awardXP, XP } from '../lib/gamify.js';
import { pickOptions, shuffle } from '../lib/lesson.js';
import { stopSpeaking } from '../lib/speech.js';
import { sfx } from '../lib/sfx.js';

const SESSION = 15;

function RecallStep({ step, done }) {
  const course = useCourse();
  const { phrase } = step;
  const [shown, setShown] = useState(false);
  const [result, setResult] = useState(null);
  const [self, setSelf] = useState(null);
  const verdict = result ? result.passed : self;
  return (
    <div class="step">
      <p class="eyebrow">🗣️ Say it in {course.lang.name}</p>
      <h2>“{phrase.n}”</h2>
      <SpeakBox expected={phrase.t} onResult={(r) => { setResult(r); setShown(true); }} />
      {shown ? (
        <p class="center reveal">
          <strong lang={course.lang.code}>{phrase.t}</strong> <PlayButton text={phrase.t} />
        </p>
      ) : (
        <div class="center"><button type="button" class="btn ghost" onClick={() => setShown(true)}>Show answer</button></div>
      )}
      {shown && !result && self === null && (
        <div class="row gap center">
          <button type="button" class="btn ghost" onClick={() => { setSelf(true); sfx('good'); }}>✅ I knew it</button>
          <button type="button" class="btn ghost" onClick={() => { setSelf(false); sfx('bad'); }}>❌ I didn't</button>
        </div>
      )}
      {verdict !== null && verdict !== undefined && (
        <Footer tone={verdict ? 'good' : 'bad'} message={verdict ? 'Remembered!' : "We'll show this again soon."} onClick={() => done({ correct: verdict })} />
      )}
    </div>
  );
}

export function Review() {
  const course = useCourse();
  const s = useStore();
  const lang = course.lang.code;
  const cards = s.cards[lang] || {};
  const [session, setSession] = useState(null);
  const [pos, setPos] = useState(0);
  const [right, setRight] = useState(0);
  const due = dueCards(cards);
  const total = Object.keys(cards).length;

  const pool = useMemo(() => [...course.phraseIndex.values()].map((x) => x.phrase), [course]);

  const start = (ids) => {
    const items = ids.slice(0, SESSION).map((id, i) => {
      const { phrase } = course.phraseIndex.get(id) || {};
      if (!phrase) return null;
      const mode = i % 3 === 2 ? 'listen' : 'recall';
      return mode === 'listen' ? { id, type: 'listen', phrase, options: pickOptions(phrase, pool, 'n') } : { id, type: 'recall', phrase };
    }).filter(Boolean);
    setSession(shuffle(items));
    setPos(0);
    setRight(0);
  };

  if (session && pos < session.length) {
    const item = session[pos];
    const onDone = ({ correct }) => {
      stopSpeaking();
      update((d, ev) => {
        d.cards[lang][item.id] = gradeCard(d.cards[lang][item.id], correct);
        d.reviews = (d.reviews || 0) + 1;
        if (correct) awardXP(d, XP.review, ev);
      });
      if (correct) setRight(right + 1);
      setPos(pos + 1);
    };
    const Comp = item.type === 'listen' ? ChoiceStep : RecallStep;
    return (
      <section class="lesson">
        <div class="lesson-top">
          <button type="button" class="btn-icon" onClick={() => setSession(null)} aria-label="End review">✕</button>
          <div class="progress"><span style={{ width: `${(pos / session.length) * 100}%` }} /></div>
          <span class="xp-chip">{pos + 1}/{session.length}</span>
        </div>
        <Comp key={item.id + pos} step={item} done={onDone} />
      </section>
    );
  }

  if (session) {
    return (
      <section class="card center summary">
        <div class="confetti" aria-hidden="true">🧠</div>
        <h1>Review done!</h1>
        <p class="lead">You remembered {right} of {session.length}.</p>
        <div class="row gap center">
          <button type="button" class="btn primary" onClick={() => setSession(null)}>Done</button>
        </div>
      </section>
    );
  }

  const weakest = Object.entries(cards).sort((a, b) => a[1].box - b[1].box).map(([id]) => id);
  const nextDue = Object.values(cards).map((c) => c.due).sort()[0];
  const boxes = [0, 0, 0];
  Object.values(cards).forEach((c) => boxes[strength(c) < 0.3 ? 0 : strength(c) < 0.7 ? 1 : 2]++);

  return (
    <section class="page">
      <h1>🔁 Review</h1>
      <p class="muted">Spaced repetition brings each phrase back just before you'd forget it. Saying it out loud makes it stick.</p>
      {total === 0 ? (
        <div class="card center">
          <p>Your review deck is empty. Complete a lesson and its phrases will appear here.</p>
          <a class="btn primary" href="#/">Go to lessons</a>
        </div>
      ) : (
        <>
          <div class="stat-grid">
            <div class="stat"><span class="stat-num">{due.length}</span><span>due now</span></div>
            <div class="stat"><span class="stat-num">{boxes[0]}</span><span>learning</span></div>
            <div class="stat"><span class="stat-num">{boxes[1]}</span><span>getting there</span></div>
            <div class="stat"><span class="stat-num">{boxes[2]}</span><span>strong</span></div>
          </div>
          <div class="card center">
            {due.length > 0 ? (
              <button type="button" class="btn primary big" onClick={() => start(shuffle(due))}>
                Start review ({Math.min(due.length, SESSION)})
              </button>
            ) : (
              <>
                <p>✨ All caught up! Next review: <strong>{nextDue}</strong></p>
                <button type="button" class="btn ghost" onClick={() => start(weakest)}>Practise weakest phrases anyway</button>
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}
