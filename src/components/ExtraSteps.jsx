// Step UIs for the deeper lesson kinds: culture notes, recall (checkpoints/tests/review), minimal pairs,
// sentence stress, substitution drills, natural-speed listening, branching role-plays and free speaking.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PlayButton } from './PlayButton.jsx';
import { RecordCompare, SpeakBox } from './SpeakBox.jsx';
import { Footer, useAutoPlay, useSpeak } from './Steps.jsx';
import { useCourse } from './context.js';
import { listenLong, recognitionErrorMessage, stopSpeaking, support } from '../lib/speech.js';
import { getState, update, useStore } from '../lib/store.js';
import { sfx } from '../lib/sfx.js';
import { stressParts } from '../lib/lesson.js';
import { checkFree, checkTyped, FREE_PASS } from '../lib/score.js';
import { Flag } from './Flag.jsx';

const bump = (key, n = 1) => update((d) => {
  d.speaking[key] = (d.speaking[key] || 0) + n;
});

export function CultureStep({ step, done }) {
  const { note } = step;
  return (
    <div class="step">
      <p class="eyebrow">🌍 Culture note</p>
      <h2>{note.title}</h2>
      {note.regions?.length > 0 && (
        <p class="regions">{note.regions.map((r) => <span key={r} class="region"><Flag code={r.toLowerCase()} /> {r}</span>)}</p>
      )}
      <p class="lead">{note.body}</p>
      <Footer label="Got it" onClick={() => done({})} />
    </div>
  );
}

/** English shown, learner says the target sentence from memory. Used in checkpoints, level tests and review. */
export function RecallStep({ step, done }) {
  const course = useCourse();
  const { phrase } = step;
  const [shown, setShown] = useState(false);
  const [result, setResult] = useState(null);
  const [self, setSelf] = useState(null);
  const verdict = result ? result.passed : self;
  const finish = () => done({ correct: !!verdict, passed: !!result?.passed, spoke: !!result, cardId: step.cardId });
  return (
    <div class="step">
      <p class="eyebrow">{step.exam ? '🚩 From memory — ' : '🗣️ '}Say it in {course.lang.name}</p>
      <h2>“{phrase.n}”</h2>
      <SpeakBox expected={phrase.t} onResult={(r) => { setResult(r); setShown(true); }} />
      {shown ? (
        <p class="center reveal">
          <strong lang={course.lang.code}>{phrase.t}</strong> <PlayButton text={phrase.t} />
        </p>
      ) : (
        <div class="center"><button type="button" class="btn ghost" onClick={() => setShown(true)}>{step.exam ? "I don't know — show me" : 'Show answer'}</button></div>
      )}
      {shown && !result && self === null && (
        <div class="row gap center">
          <button type="button" class="btn ghost" onClick={() => { setSelf(true); sfx('good'); }}>✅ I knew it</button>
          <button type="button" class="btn ghost" onClick={() => { setSelf(false); sfx('bad'); }}>❌ I didn't</button>
        </div>
      )}
      {verdict !== null && verdict !== undefined && (
        <Footer tone={verdict ? 'good' : 'bad'} message={verdict ? 'Remembered!' : "We'll show this again soon."} onClick={finish} />
      )}
    </div>
  );
}

/** Minimal pair: hear one word, pick which it was, then say it. */
export function PairStep({ step, done }) {
  const course = useCourse();
  const { pair, target } = step;
  const correct = pair[target];
  const options = useMemo(() => [pair.a, pair.b], [pair]);
  const [picked, setPicked] = useState(null);
  const [spoken, setSpoken] = useState(null);
  useAutoPlay(correct.t, [correct.t]);
  const pick = (o) => {
    if (picked) return;
    setPicked(o);
    const ok = o === correct;
    sfx(ok ? 'good' : 'bad');
    if (ok) bump('pairs');
  };
  const ok = picked === correct;
  return (
    <div class="step">
      <p class="eyebrow">👂 Minimal pair{pair.sound ? ` — ${pair.sound}` : ''}</p>
      <h2>Which word did you hear?</h2>
      <div class="center"><PlayButton text={correct.t} big /></div>
      <div class="options pair-options" role="list">
        {options.map((o) => (
          <button type="button" role="listitem" key={o.t} lang={course.lang.code} disabled={!!picked}
            class={`option ${picked ? (o === correct ? 'correct' : o === picked ? 'wrong' : 'dim') : ''}`} onClick={() => pick(o)}>
            <strong>{o.t}</strong> <span class="muted small">{o.n}</span>
          </button>
        ))}
      </div>
      {picked && (
        <>
          <div class="row gap center wrap pair-play">
            {options.map((o) => <span key={o.t} class="pair-chip" lang={course.lang.code}>{o.t} <PlayButton text={o.t} /></span>)}
          </div>
          <SpeakBox key={correct.t} expected={correct.t} onResult={setSpoken} label={`Now say “${correct.t}”`} />
          <Footer tone={ok ? 'good' : 'bad'} message={ok ? 'Sharp ears!' : `It was “${correct.t}”.`}
            onClick={() => done({ correct: ok, spoke: !!spoken, passed: !!spoken?.passed })} />
        </>
      )}
    </div>
  );
}

/** Sentence stress & intonation: see the stressed syllables, listen, shadow. */
export function StressStep({ step, done }) {
  const course = useCourse();
  const { line } = step;
  const [attempt, setAttempt] = useState(null);
  useAutoPlay(line.t, [line.t]);
  return (
    <div class="step">
      <p class="eyebrow">🎵 Stress & melody — listen, then shadow</p>
      <div class="phrase-card">
        <PlayButton text={line.t} big />
        <div>
          <p class="target stress-line" lang={course.lang.code}>
            {stressParts(line.mark || line.t).map((p, i) => (p.stress ? <strong key={i} class="stress">{p.text}</strong> : <span key={i}>{p.text}</span>))}
          </p>
          <p class="native">{line.n}</p>
          {line.note && <p class="note">ℹ️ {line.note}</p>}
        </div>
      </div>
      <SpeakBox key={line.t} expected={line.t} onResult={setAttempt} label="Copy the rhythm — tap and say it" />
      <Footer tone={attempt ? (attempt.passed ? 'good' : 'close') : ''} label={attempt ? 'Continue' : 'Skip speaking'}
        onClick={() => done({ spoke: !!attempt, passed: !!attempt?.passed })} />
    </div>
  );
}

/** Substitution drill: base sentence + cue → learner says the transformed sentence. */
export function DrillStep({ step, done }) {
  const course = useCourse();
  const say = useSpeak();
  const { base, item } = step;
  const [result, setResult] = useState(null);
  const [shown, setShown] = useState(false);
  const [self, setSelf] = useState(null);
  const passed = result ? result.passed : self;
  const onResult = (r) => {
    setResult(r);
    setShown(true);
    if (r.passed) bump('drills');
    say(item.t);
  };
  return (
    <div class="step">
      <p class="eyebrow">🧩 {step.title || 'Swap it in'}</p>
      <div class="drill-base" lang={course.lang.code}>
        <span>{base.t}</span> <PlayButton text={base.t} slow={false} />
        <p class="native small">{base.n}</p>
      </div>
      <p class="drill-cue">Now with: <strong lang={course.lang.code}>{item.cue}</strong></p>
      <SpeakBox key={item.t} expected={item.t} onResult={onResult} label="Say the new sentence" />
      {shown ? (
        <p class="center reveal"><strong lang={course.lang.code}>{item.t}</strong> <PlayButton text={item.t} /><br /><span class="muted small">{item.n}</span></p>
      ) : (
        <div class="center"><button type="button" class="btn ghost" onClick={() => { setShown(true); say(item.t); }}>Show answer</button></div>
      )}
      {shown && !result && self === null && (
        <div class="row gap center">
          <button type="button" class="btn ghost" onClick={() => { setSelf(true); bump('drills'); }}>✅ I had it</button>
          <button type="button" class="btn ghost" onClick={() => setSelf(false)}>🔁 Not yet</button>
        </div>
      )}
      <Footer tone={passed === true ? 'good' : passed === false ? 'close' : ''} label={passed === null || passed === undefined ? 'Skip' : 'Continue'}
        message={passed ? 'Pattern mastered!' : ''} onClick={() => done({ passed: !!passed, spoke: !!result })} />
    </div>
  );
}

/** Natural-speed listening: plays every line in sequence (rate 1.0, multiple voices); transcript is optional. */
export function StoryStep({ step, done }) {
  const course = useCourse();
  const s = useStore();
  const say = useSpeak();
  const { story } = step;
  const [idx, setIdx] = useState(-1);
  const [plays, setPlays] = useState(0);
  const [transcript, setTranscript] = useState(false);
  const run = useRef(0);
  const play = async () => {
    const token = ++run.current;
    for (let i = 0; i < story.lines.length; i++) {
      if (token !== run.current) return;
      setIdx(i);
      const l = story.lines[i];
      await say(l.t, { rate: story.rate || 1, voice: l.voice || story.voice, role: l.voice || story.voice ? undefined : l.role });
      await new Promise((r) => setTimeout(r, 250));
    }
    if (token === run.current) {
      setIdx(-1);
      setPlays((p) => p + 1);
    }
  };
  const stop = () => {
    run.current++;
    stopSpeaking();
    setIdx(-1);
  };
  useEffect(() => {
    if (getState().settings.autoPlay) {
      const t = setTimeout(play, 400);
      return () => {
        clearTimeout(t);
        run.current++;
        stopSpeaking();
      };
    }
    return () => {
      run.current++;
      stopSpeaking();
    };
  }, []);
  const playing = idx >= 0;
  return (
    <div class="step">
      <p class="eyebrow">🎧 Listen at natural speed</p>
      <h2>{story.title}</h2>
      {story.intro && <p class="muted">{story.intro}</p>}
      <div class="row gap center">
        <button type="button" class="btn primary" onClick={playing ? stop : play}>{playing ? '⏹ Stop' : plays ? '🔁 Listen again' : '▶ Play'}</button>
        <label class="toggle small"><input type="checkbox" checked={transcript} onChange={(e) => setTranscript(e.currentTarget.checked)} /> Show transcript</label>
      </div>
      <ol class="story-lines" aria-live="off">
        {story.lines.map((l, i) => (
          <li key={i} class={i === idx ? 'current' : ''}>
            {l.name && <span class="who">{l.name}</span>}
            {transcript ? (
              <>
                <p class="target" lang={course.lang.code}>{l.t} <PlayButton text={l.t} slow voice={l.voice || story.voice} role={l.voice || story.voice ? undefined : l.role} /></p>
                {s.settings.showTranslations && <p class="native small">{l.n}</p>}
              </>
            ) : (
              <p class="muted small">{i === idx ? '🔊 …' : '· · ·'}</p>
            )}
          </li>
        ))}
      </ol>
      <p class="muted small center">Try listening once or twice before you open the transcript. Questions come next — answer them out loud.</p>
      <Footer label={plays ? 'To the questions' : 'Skip to questions'} onClick={() => { stop(); done({}); }} />
    </div>
  );
}

/** Comprehension question, answered out loud (typed fallback). */
export function QuestionStep({ step, done }) {
  const course = useCourse();
  const { question } = step;
  const answers = question.t;
  const display = answers[0].replace(/(\u2026|\.\.\.)\s*$/, '…');
  const [result, setResult] = useState(null);
  const [reveal, setReveal] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState('');
  const [showN, setShowN] = useState(false);
  useAutoPlay(question.q, [question.q]);
  const submitTyped = (e) => {
    e.preventDefault();
    const ok = checkTyped(answers, typed, course.lang.code);
    sfx(ok ? 'good' : 'bad');
    setResult({ passed: ok, typed: true });
    setReveal(true);
  };
  return (
    <div class="step">
      <p class="eyebrow">❓ Answer out loud</p>
      <div class="phrase-card">
        <PlayButton text={question.q} big />
        <div>
          <p class="target" lang={course.lang.code}>{question.q}</p>
          {showN ? <p class="native">{question.n}</p> : <button type="button" class="btn ghost small" onClick={() => setShowN(true)}>Translate question</button>}
        </div>
      </div>
      {!typing ? <SpeakBox expected={answers} modelText={display.replace('…', '')} onResult={(r) => { setResult(r); setReveal(true); }} label="Tap and answer in a short sentence" /> : (
        <form class="type-answer" onSubmit={submitTyped}>
          <input type="text" lang={course.lang.code} value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder="Type your answer" autoFocus aria-label="Your answer" />
          <button class="btn primary" type="submit">Check</button>
        </form>
      )}
      {reveal && (
        <p class="center reveal">
          Possible answer: <strong lang={course.lang.code}>{display}</strong> <PlayButton text={display.replace('…', '')} slow={false} />
          {answers.length > 1 && <span class="muted small"><br />Also accepted: {answers.slice(1).join(' · ')}</span>}
        </p>
      )}
      <Footer
        tone={result ? (result.passed ? 'good' : 'close') : ''}
        label={result ? 'Continue' : 'Skip'}
        secondary={!result && (
          <>
            {!typing && <button type="button" class="btn ghost" onClick={() => setTyping(true)}>⌨️ Type instead</button>}
            {!reveal && <button type="button" class="btn ghost" onClick={() => setReveal(true)}>Show answer</button>}
          </>
        )}
        onClick={() => {
          if (result && !result.typed) bump('questions');
          done({ passed: !!result?.passed, spoke: !!result && !result.typed });
        }}
      />
    </div>
  );
}

/** Branching role-play: the learner's spoken choice decides how the other person replies. */
export function BranchStep({ step, done }) {
  const course = useCourse();
  const say = useSpeak();
  const { branch } = step;
  const [nodeId, setNodeId] = useState(branch.start);
  const [history, setHistory] = useState([]); // [{who, t, n}]
  const [heardMiss, setHeardMiss] = useState(false);
  const [spokenTurns, setSpokenTurns] = useState(0);
  const endRef = useRef(null);
  const node = branch.nodes[nodeId];
  const voice = branch.voice;

  useEffect(() => {
    if (!node) return;
    setHistory((h) => [...h, { who: 'them', t: node.t, n: node.n }]);
    let live = true;
    const t = setTimeout(() => live && say(node.t, { role: 'partner', voice }), 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [nodeId]);
  useEffect(() => endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' }), [history.length]);

  const choose = (choice, spoke) => {
    stopSpeaking();
    setHeardMiss(false);
    if (spoke) setSpokenTurns((n) => n + 1);
    setHistory((h) => [...h, { who: 'me', t: choice.t, n: choice.n }]);
    setNodeId(choice.next);
  };
  const onSpoken = (r) => {
    const idx = node.choices.findIndex((c) => c.t === r.answer);
    if (idx >= 0 && r.score >= 0.6) choose(node.choices[idx], true);
    else setHeardMiss(true);
  };

  const ended = !node || !node.choices?.length;
  const good = node?.end !== 'bad';
  return (
    <div class="step">
      <p class="eyebrow">🎭 Your choice — {branch.title}</p>
      {branch.scene && <p class="muted">{branch.scene}</p>}
      <div class="chat" aria-live="polite">
        {history.map((l, i) => (
          <div key={i} class={`bubble ${l.who === 'me' ? 'me' : 'them'}`}>
            <span class="who">{l.who === 'me' ? 'You' : branch.name || 'Partner'}</span>
            <p class="target" lang={course.lang.code}>{l.t} {l.who !== 'me' && <PlayButton text={l.t} slow={false} role="partner" voice={voice} />}</p>
            <p class="native small">{l.n}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {!ended && (
        <>
          <p class="muted small center">Say one of these — what you choose changes the conversation:</p>
          <ul class="choices">
            {node.choices.map((c) => (
              <li key={c.t}>
                <button type="button" class="option" lang={course.lang.code} onClick={() => choose(c, false)} title="Tap if you can't speak right now">
                  <strong>{c.t}</strong> <span class="muted small">{c.n}</span>
                </button>
              </li>
            ))}
          </ul>
          {support.stt ? (
            <SpeakBox key={nodeId} expected={node.choices.map((c) => c.t)} onResult={onSpoken} label="Tap the mic and say your choice" />
          ) : (
            <p class="muted small center">Say your choice out loud, then tap it.</p>
          )}
          {heardMiss && <p class="error small center" role="alert">I couldn't match that to an option — try again, or say it and tap it.</p>}
        </>
      )}
      {ended && (
        <Footer
          tone={good ? 'good' : 'close'}
          message={good ? 'Scene complete! 🎉' : 'That went sideways — try a different path next time!'}
          detail={node?.outcome || `You spoke ${spokenTurns} of your turns.`}
          onClick={() => {
            update((d) => {
              d.speaking.branches = (d.speaking.branches || 0) + 1;
              d.speaking.dialogues += 1;
            });
            done({ branch: true, good, spokenTurns });
          }}
        />
      )}
    </div>
  );
}

/** Free speaking: talk for N seconds; transcript is checked locally against target words/patterns. */
export function FreeStep({ step, done }) {
  const course = useCourse();
  const { task } = step;
  const seconds = task.seconds || 30;
  const [phase, setPhase] = useState('ready'); // ready | talking | result
  const [text, setText] = useState('');
  const [left, setLeft] = useState(seconds);
  const [check, setCheck] = useState(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(!support.stt);
  const [self, setSelf] = useState(null);
  const ref = useRef(null);

  useEffect(() => () => ref.current?.stop(), []);
  useEffect(() => {
    if (phase !== 'talking') return;
    if (left <= 0) {
      ref.current?.stop();
      return;
    }
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left]);

  const start = async () => {
    stopSpeaking();
    setError('');
    setText('');
    setLeft(seconds);
    setPhase('talking');
    if (manual) return;
    const l = listenLong({ lang: course.lang.speech, seconds, onText: setText });
    ref.current = l;
    try {
      const r = await l.promise;
      const c = checkFree(r.transcript, task, course.lang);
      setText(r.transcript);
      setCheck({ ...c, seconds: r.seconds });
      sfx(c.score >= FREE_PASS ? 'good' : 'bad');
      setPhase('result');
    } catch (e) {
      setError(recognitionErrorMessage(e.message));
      setManual(true);
      setPhase('ready');
    }
  };
  const stopManual = () => setPhase('result');

  const passed = check ? check.score >= FREE_PASS : self;
  const finish = () => {
    const talked = check ? check.seconds : seconds - Math.max(0, left);
    update((d) => {
      d.speaking.free = (d.speaking.free || 0) + 1;
      d.speaking.seconds += Math.max(0, Math.min(talked, seconds + 15));
      d.speaking.attempts += 1;
    });
    done({ free: true, passed: !!passed, hits: check ? check.hits.length : passed ? Math.ceil((task.targets || []).length / 2) : 0, spoke: true });
  };
  const praise = check
    ? check.score >= 0.85 ? 'Fantastic — you covered almost everything!' : check.score >= FREE_PASS ? 'Great job — you got your message across!' : check.words > 0 ? 'Good start! Try weaving in a few of the ideas below.' : "I didn't catch much — give it another go."
    : '';

  return (
    <div class="step">
      <p class="eyebrow">💭 Free speaking — {seconds} seconds</p>
      <h2>{task.n}</h2>
      {task.hint && <p class="muted">{task.hint}</p>}
      {task.targets?.length > 0 && (
        <ul class="targets">
          {task.targets.map((t) => {
            const hit = check?.hits.includes(t.label);
            return <li key={t.label} class={check ? (hit ? 'hit' : 'miss') : ''}>{check ? (hit ? '✅ ' : '◻️ ') : '• '}{t.label}</li>;
          })}
        </ul>
      )}
      {phase === 'ready' && (
        <div class="center">
          <button type="button" class="btn primary big" onClick={start}>🎙️ Start talking</button>
          {manual && <p class="muted small">{support.stt ? 'Speak out loud while the timer runs, then rate yourself.' : 'Automatic transcription needs Chrome, Edge or Safari. Speak out loud while the timer runs, then rate yourself.'}</p>}
        </div>
      )}
      {phase === 'talking' && (
        <div class="free-live">
          <div class="timer" aria-label={`${left} seconds left`}><span style={{ width: `${(left / seconds) * 100}%` }} class={left <= 5 ? 'low' : ''} /></div>
          <p class="muted small center">{left}s left — keep going, mistakes are fine!</p>
          {!manual && <p class="live-text" lang={course.lang.code} aria-live="off">{text || '…'}</p>}
          <div class="center">
            <button type="button" class="btn ghost" onClick={() => (manual ? stopManual() : ref.current?.stop())}>⏹ I'm done</button>
          </div>
          {manual && <RecordCompare text={task.model} />}
        </div>
      )}
      {phase === 'result' && (
        <div class="free-result" aria-live="polite">
          {check && (
            <>
              <p><strong>{praise}</strong></p>
              <p class="muted small">{check.words} words · {check.hits.length}/{(task.targets || []).length} ideas used</p>
              {text && <p class="live-text" lang={course.lang.code}>“{text}”</p>}
              {check.missed.length > 0 && <p class="small">Next time, try: {check.missed.join(' · ')}</p>}
            </>
          )}
          {!check && self === null && (
            <div class="row gap center">
              <button type="button" class="btn ghost" onClick={() => { setSelf(true); sfx('good'); }}>✅ I covered most points</button>
              <button type="button" class="btn ghost" onClick={() => { setSelf(false); sfx('bad'); }}>🔁 I need more practice</button>
            </div>
          )}
          {task.model && (
            <p class="reveal">Example answer: <span lang={course.lang.code}>{task.model}</span> <PlayButton text={task.model} slow={false} /></p>
          )}
          <div class="center"><button type="button" class="btn ghost small" onClick={() => { setCheck(null); setSelf(null); setPhase('ready'); }}>🔁 Try again</button></div>
        </div>
      )}
      <Footer
        tone={phase === 'result' && passed !== null && passed !== undefined ? (passed ? 'good' : 'close') : ''}
        label={phase === 'result' && (check || self !== null) ? 'Continue' : 'Skip'}
        onClick={phase === 'result' && (check || self !== null) ? finish : () => { ref.current?.stop(); done({}); }}
      />
    </div>
  );
}
