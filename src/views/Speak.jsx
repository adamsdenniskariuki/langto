import { useEffect, useMemo, useState } from 'preact/hooks';
import { useCourse } from '../components/context.js';
import { DialogueStep } from '../components/Steps.jsx';
import { SpeakBox } from '../components/SpeakBox.jsx';
import { PlayButton } from '../components/PlayButton.jsx';
import { getState, update, useStore } from '../lib/store.js';
import { awardXP, XP } from '../lib/gamify.js';
import { shuffle } from '../lib/lesson.js';
import { say, stopSpeaking } from '../lib/speech.js';
import { voiceFor } from '../lib/tts-keys.js';
import { sfx } from '../lib/sfx.js';

function useLearned() {
  const course = useCourse();
  const s = useStore();
  const done = s.lessons[course.lang.code] || {};
  const key = course.order.filter((id) => done[id]?.done).join(',');
  return useMemo(() => {
    const ids = key ? key.split(',') : [];
    const fallback = !ids.length;
    const use = fallback ? course.order.slice(0, 1) : ids;
    const lessons = use.map((id) => course.lessonIndex.get(id).lesson);
    return { fallback, lessons, phrases: lessons.flatMap((l) => l.phrases) };
  }, [course, key]);
}

function Shadowing({ phrases }) {
  const course = useCourse();
  const list = useMemo(() => shuffle(phrases), [phrases]);
  const [i, setI] = useState(0);
  const [round, setRound] = useState(0);
  const p = list[i % list.length];
  useEffect(() => {
    let off = false;
    (async () => {
      const { settings } = getState();
      const opts = { course: course.lang, voiceURI: settings.voiceURI };
      await new Promise((r) => setTimeout(r, 300));
      if (off) return;
      await say(p.t, { ...opts, rate: Math.max(0.5, settings.rate * 0.7) });
      if (off) return;
      await new Promise((r) => setTimeout(r, 400));
      if (!off) await say(p.t, { ...opts, rate: settings.rate });
    })();
    return () => {
      off = true;
      stopSpeaking();
    };
  }, [i, round]);
  const onResult = (r) => {
    if (r.passed) update((d, ev) => awardXP(d, 1, ev));
  };
  return (
    <div class="step">
      <p class="muted">Listen twice (slow, then normal), then speak along with the same rhythm and melody. Shadowing trains your mouth and ear together.</p>
      <div class="phrase-card">
        <PlayButton text={p.t} big />
        <div>
          <p class="target" lang={course.lang.code}>{p.t}</p>
          <p class="native">{p.n}</p>
        </div>
      </div>
      <SpeakBox key={`${i}-${round}`} expected={p.t} onResult={onResult} />
      <div class="row gap center">
        <button type="button" class="btn ghost" onClick={() => setRound(round + 1)}>↻ Replay</button>
        <button type="button" class="btn primary" onClick={() => setI(i + 1)}>Next phrase →</button>
      </div>
    </div>
  );
}

const DRILL_SECONDS = 60;

function RapidFire({ phrases }) {
  const course = useCourse();
  const [phase, setPhase] = useState('ready');
  const [left, setLeft] = useState(DRILL_SECONDS);
  const [list, setList] = useState([]);
  const [i, setI] = useState(0);
  const [hits, setHits] = useState(0);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (phase !== 'run') return;
    if (left <= 0) {
      stopSpeaking();
      setPhase('end');
      update((d, ev) => {
        d.speaking.prompts += hits;
        awardXP(d, hits * XP.review, ev);
      });
      sfx('done');
      return;
    }
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, left]);

  const start = () => {
    setList(shuffle([...phrases, ...phrases]));
    setI(0);
    setHits(0);
    setLeft(DRILL_SECONDS);
    setReveal(false);
    setPhase('run');
  };
  const next = () => {
    setReveal(false);
    setI(i + 1);
  };

  if (phase === 'ready')
    return (
      <div class="card center">
        <h2>⚡ 60-second rapid fire</h2>
        <p class="muted">You'll see English sentences. Say each one in {course.lang.name} as fast as you can. Every correct answer scores.</p>
        <button type="button" class="btn primary big" onClick={start}>Start</button>
      </div>
    );
  if (phase === 'end')
    return (
      <div class="card center summary">
        <div class="confetti" aria-hidden="true">⚡</div>
        <h2>{hits} correct in 60 seconds!</h2>
        <p class="muted">+{hits * XP.review} XP</p>
        <button type="button" class="btn primary" onClick={start}>Play again</button>
      </div>
    );
  const p = list[i % list.length];
  return (
    <div class="step">
      <div class="row between">
        <strong>✅ {hits}</strong>
        <strong class={left <= 10 ? 'error' : ''}>⏱ {left}s</strong>
      </div>
      <div class="timer"><span style={{ width: `${(left / DRILL_SECONDS) * 100}%` }} class={left <= 10 ? 'low' : ''} /></div>
      <h2 class="center">“{p.n}”</h2>
      {reveal && <p class="center reveal"><strong lang={course.lang.code}>{p.t}</strong></p>}
      <SpeakBox
        key={i}
        expected={p.t}
        onResult={(r) => {
          if (r.passed) {
            setHits((h) => h + 1);
            setTimeout(next, 600);
          } else setReveal(true);
        }}
      />
      <div class="row gap center">
        <button type="button" class="btn ghost" onClick={() => setReveal(true)}>Hint</button>
        <button type="button" class="btn ghost" onClick={next}>Skip →</button>
      </div>
    </div>
  );
}

// Keep each line's original voice so the pre-generated audio still matches.
function swapRoles(dialogue, lang) {
  const partner = dialogue.lines.find((l) => l.who !== 'you')?.name || 'Partner';
  return {
    ...dialogue,
    title: `${dialogue.title} (roles swapped)`,
    lines: dialogue.lines.map((l) =>
      l.who === 'you'
        ? { ...l, who: 'A', name: 'Partner', voice: voiceFor(lang, { voice: l.voice }) }
        : { ...l, who: 'you', name: partner, voice: voiceFor(lang, { voice: l.voice || dialogue.voice, role: 'partner' }) }
    ),
  };
}

function Dialogues({ lessons }) {
  const course = useCourse();
  const [active, setActive] = useState(null);
  const [swap, setSwap] = useState(false);
  const list = lessons.filter((l) => l.dialogue);
  if (active) {
    const d = swap ? swapRoles(active.dialogue, course.lang) : active.dialogue;
    return (
      <div>
        <button type="button" class="btn ghost small" onClick={() => setActive(null)}>← All dialogues</button>
        <DialogueStep
          key={active.id + swap}
          step={{ dialogue: d }}
          done={() => {
            update((s, ev) => awardXP(s, XP.dialogue, ev));
            setActive(null);
          }}
        />
      </div>
    );
  }
  return (
    <div>
      <label class="toggle">
        <input type="checkbox" checked={swap} onChange={(e) => setSwap(e.currentTarget.checked)} /> Swap roles (speak the other part)
      </label>
      <ul class="list">
        {list.map((l) => (
          <li key={l.id}>
            <button type="button" class="list-btn" onClick={() => setActive(l)}>
              🎭 <strong>{l.dialogue.title}</strong> <span class="muted small">— {l.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const TABS = [
  { id: 'shadow', label: '🪞 Shadowing' },
  { id: 'rapid', label: '⚡ Rapid fire' },
  { id: 'dialogues', label: '🎭 Dialogues' },
];

export function Speak({ tab: initial }) {
  const s = useStore();
  const { fallback, lessons, phrases } = useLearned();
  const [tab, setTab] = useState(TABS.some((t) => t.id === initial) ? initial : 'shadow');
  const sp = s.speaking;
  return (
    <section class="page">
      <h1>🎙️ Speaking gym</h1>
      <p class="muted">
        {Math.round(sp.seconds / 60)} min spoken · {sp.sentences} sentences said · {sp.dialogues} dialogues
      </p>
      {fallback && <p class="card small">👋 Complete lessons to unlock more material. For now you're practising the first lesson.</p>}
      <div class="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} class={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'shadow' && <Shadowing phrases={phrases} />}
        {tab === 'rapid' && <RapidFire phrases={phrases} />}
        {tab === 'dialogues' && <Dialogues lessons={lessons} />}
      </div>
    </section>
  );
}
