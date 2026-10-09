import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PlayButton } from './PlayButton.jsx';
import { SpeakBox } from './SpeakBox.jsx';
import { useCourse } from './context.js';
import { say as sayText, stopSpeaking } from '../lib/speech.js';
import { getState, update, useStore } from '../lib/store.js';
import { sfx } from '../lib/sfx.js';
import { words } from '../lib/lesson.js';
import { checkTyped } from '../lib/score.js';

function useSpeak() {
  const course = useCourse();
  return (text, opts = {}) => {
    const { settings } = getState();
    return sayText(text, { course: course.lang, rate: settings.rate, voiceURI: settings.voiceURI, ...opts });
  };
}

function useAutoPlay(text, deps = []) {
  const say = useSpeak();
  useEffect(() => {
    if (getState().settings.autoPlay && text) {
      const t = setTimeout(() => say(text), 250);
      return () => {
        clearTimeout(t);
        stopSpeaking();
      };
    }
  }, deps);
}

export function Footer({ tone = '', message, detail, label = 'Continue', onClick, disabled, secondary }) {
  const ref = useRef(null);
  useEffect(() => {
    if (tone && !disabled) ref.current?.focus();
  }, [tone, disabled]);
  return (
    <div class={`step-footer ${tone}`}>
      <div class="footer-msg" aria-live="polite">
        {message && <strong>{message}</strong>}
        {detail && <div class="small">{detail}</div>}
      </div>
      <div class="row gap">
        {secondary}
        <button ref={ref} type="button" class="btn primary" onClick={onClick} disabled={disabled}>
          {label}
        </button>
      </div>
    </div>
  );
}

export function TipStep({ step, done }) {
  return (
    <div class="step">
      <p class="eyebrow">💡 Tip</p>
      <h2>{step.tip.title}</h2>
      <p class="lead">{step.tip.body}</p>
      <Footer label="Let's go" onClick={() => done({})} />
    </div>
  );
}

export function LearnStep({ step, done }) {
  const s = useStore();
  const { phrase } = step;
  const [attempt, setAttempt] = useState(null);
  useAutoPlay(phrase.t, [phrase.t]);
  return (
    <div class="step">
      <p class="eyebrow">🆕 New phrase — listen, then say it</p>
      <div class="phrase-card">
        <PlayButton text={phrase.t} big />
        <div>
          <p class="target" lang={useCourse().lang.code}>{phrase.t}</p>
          {s.settings.showTranslations && <p class="native">{phrase.n}</p>}
          {phrase.note && <p class="note">ℹ️ {phrase.note}</p>}
        </div>
      </div>
      <SpeakBox key={phrase.t} expected={phrase.t} onResult={setAttempt} />
      <Footer
        tone={attempt ? (attempt.passed ? 'good' : 'close') : ''}
        message={attempt ? (attempt.passed ? 'Nice pronunciation!' : 'Keep practising — you can try again or move on.') : ''}
        label={attempt ? 'Continue' : 'Skip speaking'}
        onClick={() => done({ spoke: !!attempt, passed: !!attempt?.passed })}
      />
    </div>
  );
}

export function ChoiceStep({ step, done }) {
  const course = useCourse();
  const say = useSpeak();
  const { phrase, options, type } = step;
  const correct = type === 'listen' ? phrase.n : phrase.t;
  const [picked, setPicked] = useState(null);
  useAutoPlay(type === 'listen' ? phrase.t : null, [phrase.t, type]);
  const pick = (o) => {
    if (picked) return;
    setPicked(o);
    const ok = o === correct;
    sfx(ok ? 'good' : 'bad');
    if (type === 'read') say(phrase.t);
  };
  const ok = picked === correct;
  return (
    <div class="step">
      {type === 'listen' ? (
        <>
          <p class="eyebrow">👂 Listen</p>
          <h2>What does this mean?</h2>
          <div class="center"><PlayButton text={phrase.t} big /></div>
        </>
      ) : (
        <>
          <p class="eyebrow">📖 Translate</p>
          <h2>How do you say “{phrase.n}”?</h2>
        </>
      )}
      <div class="options" role="list">
        {options.map((o, i) => (
          <button
            type="button"
            role="listitem"
            key={o}
            lang={type === 'read' ? course.lang.code : undefined}
            class={`option ${picked ? (o === correct ? 'correct' : o === picked ? 'wrong' : 'dim') : ''}`}
            onClick={() => pick(o)}
            disabled={!!picked}
          >
            <kbd>{i + 1}</kbd> {o}
          </button>
        ))}
      </div>
      <KeyPicker count={options.length} onPick={(i) => pick(options[i])} active={!picked} />
      {picked && (
        <Footer
          tone={ok ? 'good' : 'bad'}
          message={ok ? 'Correct!' : 'Not quite.'}
          detail={
            <>
              <span lang={course.lang.code}>{phrase.t}</span> — {phrase.n}
            </>
          }
          onClick={() => done({ correct: ok })}
        />
      )}
    </div>
  );
}

function KeyPicker({ count, onPick, active }) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= count && !e.target.closest?.('input,textarea')) onPick(n - 1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [active, count, onPick]);
  return null;
}

export function BuildStep({ step, done }) {
  const course = useCourse();
  const say = useSpeak();
  const { phrase, tiles } = step;
  const target = useMemo(() => words(phrase.t), [phrase.t]);
  const [chosen, setChosen] = useState([]);
  const [checked, setChecked] = useState(null);
  const [spoken, setSpoken] = useState(null);
  const sentence = chosen.map((i) => tiles[i]).join(' ');
  const check = () => {
    const ok = sentence.toLowerCase() === target.join(' ').toLowerCase();
    setChecked(ok);
    sfx(ok ? 'good' : 'bad');
    say(phrase.t);
  };
  return (
    <div class="step">
      <p class="eyebrow">🧩 Build the sentence</p>
      <h2>“{phrase.n}”</h2>
      <div class={`answer-line ${checked === true ? 'good' : checked === false ? 'bad' : ''}`} lang={course.lang.code} aria-label="Your sentence">
        {chosen.length === 0 && <span class="muted">Tap the words in order…</span>}
        {chosen.map((ti, k) => (
          <button type="button" key={k} class="tile" disabled={checked !== null} onClick={() => setChosen(chosen.filter((_, j) => j !== k))}>
            {tiles[ti]}
          </button>
        ))}
      </div>
      <div class="tiles" lang={course.lang.code}>
        {tiles.map((t, i) => (
          <button type="button" key={i} class="tile" disabled={chosen.includes(i) || checked !== null} onClick={() => setChosen([...chosen, i])}>
            {t}
          </button>
        ))}
      </div>
      {checked === true && (
        <div class="say-it">
          <p class="muted small center">Bonus: now say it out loud!</p>
          <SpeakBox expected={phrase.t} onResult={setSpoken} />
        </div>
      )}
      {checked === null ? (
        <Footer label="Check" onClick={check} disabled={chosen.length === 0} secondary={chosen.length > 0 && <button type="button" class="btn ghost" onClick={() => setChosen([])}>Clear</button>} />
      ) : (
        <Footer
          tone={checked ? 'good' : 'bad'}
          message={checked ? (spoken?.passed ? 'Built and spoken — brilliant!' : 'Correct!') : 'Not quite. The answer is:'}
          detail={<span lang={course.lang.code}>{phrase.t}</span>}
          onClick={() => done({ correct: checked, spoke: !!spoken, passed: !!spoken?.passed })}
        />
      )}
    </div>
  );
}

export function DialogueStep({ step, done }) {
  const course = useCourse();
  const s = useStore();
  const say = useSpeak();
  const { dialogue } = step;
  const [idx, setIdx] = useState(0);
  const [hideText, setHideText] = useState(false);
  const [lineResult, setLineResult] = useState(null);
  const [score, setScore] = useState({ said: 0, passed: 0 });
  const endRef = useRef(null);
  const line = dialogue.lines[idx];
  const finished = idx >= dialogue.lines.length;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
    if (!line || line.who === 'you') return;
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 350));
      if (cancelled) return;
      await say(line.t, { role: 'partner', voice: line.voice || dialogue.voice });
      if (!cancelled) setIdx((i) => i + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [idx]);

  const nextYourLine = () => {
    setScore((x) => ({ said: x.said + 1, passed: x.passed + (lineResult?.passed ? 1 : 0) }));
    setLineResult(null);
    setIdx(idx + 1);
  };

  return (
    <div class="step">
      <p class="eyebrow">🎭 Role-play</p>
      <h2>{dialogue.title}</h2>
      <label class="toggle small">
        <input type="checkbox" checked={hideText} onChange={(e) => setHideText(e.currentTarget.checked)} /> Challenge: hide my German lines
      </label>
      <div class="chat" aria-live="polite">
        {dialogue.lines.slice(0, Math.min(idx + 1, dialogue.lines.length)).map((l, i) => {
          const mine = l.who === 'you';
          const current = i === idx;
          return (
            <div key={i} class={`bubble ${mine ? 'me' : 'them'} ${current ? 'current' : ''}`}>
              <span class="who">{mine ? 'You' : l.name || 'Partner'}</span>
              {mine && current && hideText ? (
                <p class="target muted">Say: “{l.n}”</p>
              ) : (
                <p class="target" lang={course.lang.code}>
                  {l.t} <PlayButton text={l.t} slow={false} role={mine ? undefined : 'partner'} voice={l.voice || (mine ? undefined : dialogue.voice)} />
                </p>
              )}
              {(s.settings.showTranslations || (mine && current)) && !(mine && current && hideText) && <p class="native small">{l.n}</p>}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {!finished && line.who === 'you' && (
        <>
          <SpeakBox key={idx} expected={line.t} onResult={setLineResult} label="Your turn — tap and speak" />
          <Footer tone={lineResult ? (lineResult.passed ? 'good' : 'close') : ''} label={lineResult ? 'Next line' : 'Skip line'} onClick={nextYourLine} />
        </>
      )}
      {!finished && line.who !== 'you' && <p class="muted center">…</p>}
      {finished && (
        <Footer
          tone="good"
          message="Dialogue complete! 🎉"
          detail={`You said ${score.passed} of ${dialogue.lines.filter((l) => l.who === 'you').length} lines clearly.`}
          onClick={() => {
            update((d) => {
              d.speaking.dialogues += 1;
            });
            done({ dialogue: true, passedLines: score.passed });
          }}
        />
      )}
    </div>
  );
}

const PROMPT_SECONDS = 12;

export function PromptStep({ step, done }) {
  const course = useCourse();
  const { prompt } = step;
  const answers = prompt.t;
  const display = answers[0].replace(/(\u2026|\.\.\.)\s*$/, '…');
  const [left, setLeft] = useState(PROMPT_SECONDS);
  const [result, setResult] = useState(null);
  const [fast, setFast] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  useEffect(() => {
    if (result?.passed || left <= 0) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [left, result]);
  const onResult = (r) => {
    setResult(r);
    if (r.passed && left > 0) setFast(true);
  };
  const submitTyped = (e) => {
    e.preventDefault();
    const ok = checkTyped(answers, typed, course.lang.code);
    sfx(ok ? 'good' : 'bad');
    setResult({ passed: ok, typed: true });
    setReveal(true);
  };
  const pct = (left / PROMPT_SECONDS) * 100;
  return (
    <div class="step">
      <p class="eyebrow">⚡ Speak up — answer in German</p>
      <h2>{prompt.n}</h2>
      <div class="timer" aria-label={`${left} seconds left`}>
        <span style={{ width: `${pct}%` }} class={left <= 3 ? 'low' : ''} />
      </div>
      <p class="muted small center">{left > 0 && !result?.passed ? `${left}s — answer before the bar runs out for a bonus` : result?.passed ? (fast ? '⚡ Fast answer bonus!' : 'Nice!') : 'Time! You can still answer.'}</p>
      {!typing ? <SpeakBox expected={answers} modelText={display.replace('…', '')} onResult={onResult} /> : (
        <form class="type-answer" onSubmit={submitTyped}>
          <input type="text" lang={course.lang.code} value={typed} onInput={(e) => setTyped(e.currentTarget.value)} placeholder="Type your answer" autoFocus aria-label="Your answer" />
          <button class="btn primary" type="submit">Check</button>
        </form>
      )}
      {(reveal || result || left <= 0) && (
        <p class="center reveal">
          Model answer: <strong lang={course.lang.code}>{display}</strong> <PlayButton text={display.replace('…', '')} slow={false} />
          {answers.length > 1 && <span class="muted small"><br />Also accepted: {answers.slice(1).join(' · ')}</span>}
        </p>
      )}
      <Footer
        tone={result ? (result.passed ? 'good' : 'close') : ''}
        label={result ? 'Continue' : 'Skip'}
        secondary={
          !result && (
            <>
              {!typing && <button type="button" class="btn ghost" onClick={() => setTyping(true)}>⌨️ Type instead</button>}
              {!reveal && <button type="button" class="btn ghost" onClick={() => setReveal(true)}>Show answer</button>}
            </>
          )
        }
        onClick={() => {
          if (result && !result.typed) update((d) => (d.speaking.prompts += 1));
          done({ passed: !!result?.passed, fast, spoke: !!result && !result.typed });
        }}
      />
    </div>
  );
}
