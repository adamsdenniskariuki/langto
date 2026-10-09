import { useEffect, useRef, useState } from 'preact/hooks';
import { listen, recognitionErrorMessage, say, startRecording, stopSpeaking, support } from '../lib/speech.js';
import { PASS, scoreSpeech, verdict } from '../lib/score.js';
import { recordSpeech } from '../lib/gamify.js';
import { getState, update } from '../lib/store.js';
import { sfx } from '../lib/sfx.js';
import { useCourse } from './context.js';

const BLOCKING = new Set(['not-allowed', 'service-not-allowed', 'unsupported', 'audio-capture']);

/** Record yourself, then compare against the model voice. */
export function RecordCompare({ text }) {
  const course = useCourse();
  const [rec, setRec] = useState(null);
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  if (!support.record) return null;
  const toggle = async () => {
    setErr('');
    if (rec) {
      const r = await rec.stop();
      setRec(null);
      setUrl(r.url);
      update((d) => {
        d.speaking.seconds += Math.min(r.seconds, 60);
      });
    } else {
      try {
        stopSpeaking();
        setRec(await startRecording());
      } catch {
        setErr('Microphone access was blocked.');
      }
    }
  };
  const { settings } = getState();
  return (
    <div class="record-compare">
      <button type="button" class={`btn ghost small ${rec ? 'recording' : ''}`} onClick={toggle}>
        {rec ? '⏹ Stop recording' : '⏺ Record myself'}
      </button>
      {url && (
        <div class="compare-row">
          <span class="muted small">You:</span>
          <audio src={url} controls preload="auto" />
          <button type="button" class="btn ghost small" onClick={() => say(text, { course: course.lang, rate: settings.rate, voiceURI: settings.voiceURI })}>
            🔊 Model
          </button>
        </div>
      )}
      {err && <p class="error small">{err}</p>}
    </div>
  );
}

/**
 * Speaking exercise: recognises speech, scores it against `expected` and reports via onResult.
 * Falls back to record-and-compare + self-assessment when recognition is unavailable.
 */
export function SpeakBox({ expected, modelText, onResult, label = 'Tap the mic and say it' }) {
  const course = useCourse();
  const answers = Array.isArray(expected) ? expected : [expected];
  const model = modelText || answers[0];
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState(!support.stt);
  const [selfRated, setSelfRated] = useState(null);
  const ref = useRef(null);

  useEffect(() => () => ref.current?.stop(), []);

  const start = async () => {
    if (phase === 'listening') {
      ref.current?.stop();
      return;
    }
    stopSpeaking();
    setError('');
    setPhase('listening');
    const l = listen({ lang: course.lang.speech });
    ref.current = l;
    try {
      const { transcripts, seconds } = await l.promise;
      const r = scoreSpeech(answers, transcripts, course.lang.code);
      const passed = r.score >= PASS;
      update((d) => recordSpeech(d, { seconds, passed, score: r.score }));
      sfx(passed ? 'good' : 'bad');
      setResult({ ...r, passed });
      setPhase('result');
      onResult?.({ passed, score: r.score, answer: r.answer });
    } catch (e) {
      setPhase('idle');
      setError(recognitionErrorMessage(e.message));
      if (BLOCKING.has(e.message)) setManual(true);
    }
  };

  const rate = (passed) => {
    setSelfRated(passed);
    const words = model.split(/\s+/).length;
    update((d) => recordSpeech(d, { seconds: words * 0.6, passed, score: passed ? 0.8 : 0.4 }));
    sfx(passed ? 'good' : 'bad');
    onResult?.({ passed, score: passed ? 0.8 : 0.4, manual: true });
  };

  const v = result && verdict(result.score);

  return (
    <div class="speakbox">
      {!manual && (
        <>
          <button type="button" class={`mic ${phase === 'listening' ? 'listening' : ''}`} onClick={start} aria-label={phase === 'listening' ? 'Stop listening' : 'Speak'}>
            <span aria-hidden="true">🎙️</span>
          </button>
          <p class="muted small center">{phase === 'listening' ? 'Listening… speak now' : result ? 'Tap to try again' : label}</p>
        </>
      )}
      {error && <p class="error small center" role="alert">{error}</p>}
      {result && (
        <div class={`speech-result tone-${v.tone}`} aria-live="polite">
          <div class="score-row">
            <span class="score-emoji" aria-hidden="true">{v.emoji}</span>
            <strong>{v.label}</strong>
            <span class="score-pct">{Math.round(result.score * 100)}%</span>
          </div>
          <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(result.score * 100)}>
            <span style={{ width: `${Math.round(result.score * 100)}%` }} />
          </div>
          <p class="words">
            {result.words.map((w, i) => (
              <span key={i} class={w.ok ? 'word ok' : 'word miss'}>
                {w.w}{' '}
              </span>
            ))}
          </p>
          <p class="muted small">I heard: “{result.heard}”</p>
        </div>
      )}
      {manual && (
        <div class="manual">
          <p class="muted small">
            {support.stt
              ? 'Say it out loud, then rate yourself honestly.'
              : 'Automatic pronunciation checks need Chrome, Edge or Safari. Say it out loud, record yourself to compare, then rate yourself.'}
          </p>
          <div class="row gap center">
            <button type="button" class={`btn ${selfRated === true ? 'primary' : 'ghost'}`} onClick={() => rate(true)}>
              ✅ I said it well
            </button>
            <button type="button" class={`btn ${selfRated === false ? 'primary' : 'ghost'}`} onClick={() => rate(false)}>
              🔁 Needs practice
            </button>
          </div>
        </div>
      )}
      <RecordCompare text={model} />
    </div>
  );
}
