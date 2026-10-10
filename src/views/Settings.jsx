import { useEffect, useRef, useState } from 'preact/hooks';
import { useCourse } from '../components/context.js';
import { exportData, parseImport, replaceState, resetAll, toast, update, useStore } from '../lib/store.js';
import { FONTS, THEMES } from '../lib/appearance.js';
import { listen, prefetchAudio, recognitionErrorMessage, say, support, voicesFor } from '../lib/speech.js';
import { narrators, narratorVoice } from '../lib/tts-keys.js';
import { ensureMicPermission, MIC_STATE_LABEL, micErrorCode, micPermissionState, micSupported, unblockSteps, watchMicPermission } from '../lib/mic.js';
import { navigate } from '../router.js';

const GOALS = [
  { xp: 10, label: 'Casual', desc: '~5 min/day' },
  { xp: 20, label: 'Regular', desc: '~10 min/day' },
  { xp: 35, label: 'Serious', desc: '~15 min/day' },
  { xp: 50, label: 'Intense', desc: '~20+ min/day' },
];
export { GOALS };

const set = (key, value) => update((d) => (d.settings[key] = value));

export function MicTest() {
  const course = useCourse();
  const [state, setState] = useState('');
  const [perm, setPerm] = useState('unknown');
  useEffect(() => {
    let live = true;
    micPermissionState().then((s) => live && setPerm(s));
    const off = watchMicPermission((s) => live && setPerm(s));
    return () => {
      live = false;
      off();
    };
  }, []);
  const failed = (code) => {
    if (micErrorCode(code) === 'not-allowed') setPerm('denied');
    const msg = recognitionErrorMessage(code);
    setState(msg ? `⚠️ ${msg}` : '');
  };
  const allow = async () => {
    setState('');
    try {
      await ensureMicPermission();
      setPerm('granted');
      return true;
    } catch (e) {
      failed(e.message);
      return false;
    }
  };
  const onAllow = async () => {
    if (await allow()) setState(support.stt ? '✅ Microphone allowed.' : '✅ Microphone allowed — you can record yourself and compare with the model voice.');
  };
  const run = async () => {
    if (!(await allow())) return;
    setState(`🎙️ Listening… say “${course.lang.micPhrase || 'hello'}”`);
    try {
      const { transcripts } = await listen({ lang: course.lang.speech }).promise;
      setState(`✅ I heard: “${transcripts[0]}”`);
    } catch (e) {
      failed(e.message);
    }
  };
  const canMic = micSupported() || support.stt;
  return (
    <div class="mic-access">
      {!support.stt && (
        <p class="note" role="note">
          ⚠️ Automatic scoring needs Chrome, Edge or Safari. In this browser you can still speak, record yourself and compare with the model voice, then rate yourself.
        </p>
      )}
      {canMic ? (
        <>
          <p class="small">
            Microphone: <strong class={`mic-state ${perm}`}>{MIC_STATE_LABEL[perm] || MIC_STATE_LABEL.unknown}</strong>
          </p>
          <div class="row gap">
            {perm !== 'granted' && (
              <button type="button" class={`btn ${support.stt ? 'ghost' : 'primary'}`} onClick={onAllow}>🎙️ Allow microphone</button>
            )}
            {support.stt && <button type="button" class="btn ghost" onClick={run}>🎙️ Test microphone</button>}
          </div>
          {perm === 'denied' && (
            <div class="note unblock">
              <strong>How to unblock the microphone</strong>
              <ol class="small">
                {unblockSteps().map((s) => <li key={s}>{s}</li>)}
              </ol>
            </div>
          )}
        </>
      ) : (
        <p class="small muted">This browser can't use the microphone. Try Chrome, Edge or Safari.</p>
      )}
      {state && <p class="small" aria-live="polite">{state}</p>}
    </div>
  );
}
function NarratorPicker({ lang, st }) {
  const list = narrators(lang);
  if (list.length < 2) return null;
  const current = list.find((n) => n.voice === narratorVoice(lang, st.narrator))?.id;
  const sample = lang.voiceSample || lang.micPhrase || 'Hello!';
  return (
    <div class="field" role="radiogroup" aria-label="Narrator voice">
      Narrator voice
      <div class="narrators">
        {list.map((n) => (
          <div key={n.id} class={`narrator ${current === n.id ? 'active' : ''}`}>
            <label>
              <input type="radio" name="narrator" value={n.id} checked={current === n.id} onChange={() => set('narrator', n.id)} />
              <strong>{n.label}</strong>
            </label>
            <button
              type="button"
              class="btn-icon"
              aria-label={`Preview ${n.label} narrator`}
              title="Preview"
              onClick={() => say(sample, { course: lang, rate: st.rate, voiceURI: st.voiceURI, narrator: n.id })}
            >
              ▶
            </button>
          </div>
        ))}
      </div>
      <span class="small muted">Reads vocabulary, drills, prompts and reviews. Dialogues and stories keep their own character voices.</span>
    </div>
  );
}

function OfflineAudio({ code, narrator }) {
  const [status, setStatus] = useState(null);
  const run = async () => {
    setStatus({ done: 0, total: 0 });
    const total = await prefetchAudio(code, (done, n) => setStatus({ done, total: n }), narrator);
    setStatus({ finished: true, total });
    toast(total ? `${total} audio clips saved for offline use.` : 'No recorded audio available yet.', total ? '📦' : 'ℹ️');
  };
  if (status && !status.finished) {
    return <span class="small muted" role="status">Downloading audio… {status.done}/{status.total || '…'}</span>;
  }
  return (
    <button type="button" class="btn ghost" onClick={run}>
      {status?.finished ? '✓ Audio saved offline' : '📦 Download audio for offline'}
    </button>
  );
}

export function Settings() {
  const course = useCourse();
  const s = useStore();
  const st = s.settings;
  const [voices, setVoices] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    voicesFor(course.lang.speech).then(setVoices);
  }, [course]);

  const doExport = () => {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `langto-progress-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Progress exported. Keep the file somewhere safe!', '💾');
  };

  const doImport = async (e) => {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      const data = parseImport(await file.text());
      if (!confirm(`Replace your current progress with this backup?\n\nBackup: ${data.xp} XP, ${Object.values(data.lessons).reduce((n, l) => n + Object.keys(l).length, 0)} lessons.\nCurrent: ${s.xp} XP.`)) return;
      replaceState(data);
      toast('Progress imported!', '📥');
    } catch (err) {
      toast(err.message, '⚠️');
    }
  };

  const doReset = () => {
    if (confirm('Delete ALL progress on this device? This cannot be undone. (Export first if you want a backup.)')) {
      resetAll();
      toast('Progress reset.', '🗑️');
      navigate('#/');
    }
  };

  return (
    <section class="page settings">
      <h1>⚙️ Settings</h1>

      <fieldset class="card">
        <legend>🎨 Theme</legend>
        <div class="theme-grid">
          {THEMES.map((t) => (
            <button key={t.id} type="button" class={`theme-btn ${st.theme === t.id ? 'active' : ''}`} aria-pressed={st.theme === t.id} onClick={() => set('theme', t.id)} title={t.hint || t.name}>
              <span class="swatch" style={{ background: `linear-gradient(135deg, ${t.swatch[0]} 50%, ${t.swatch[1]} 50%)` }} />
              {t.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset class="card">
        <legend>🔤 Font</legend>
        <div class="font-list">
          {FONTS.map((f) => (
            <label key={f.id} class={`font-opt ${st.font === f.id ? 'active' : ''}`} data-font-preview={f.id}>
              <input type="radio" name="font" checked={st.font === f.id} onChange={() => set('font', f.id)} />
              <span>
                <strong>{f.name}</strong>
                {f.hint && <span class="muted small"> — {f.hint}</span>}
              </span>
            </label>
          ))}
        </div>
        <label class="field">
          Text size: <strong>{Math.round(st.fontScale * 100)}%</strong>
          <input type="range" min="0.85" max="1.5" step="0.05" value={st.fontScale} onInput={(e) => set('fontScale', Number(e.currentTarget.value))} />
        </label>
      </fieldset>

      <fieldset class="card">
        <legend>🔊 Voice & speech</legend>
        <p class="small muted">Lessons use recorded neural voices. Your device's voice is only used for any line without a recording.</p>
        <label class="field">
          Speaking speed: <strong>{st.rate.toFixed(2)}×</strong>
          <input type="range" min="0.5" max="1.3" step="0.05" value={st.rate} onInput={(e) => set('rate', Number(e.currentTarget.value))} />
        </label>
        <NarratorPicker lang={course.lang} st={st} />
        <div class="row gap wrap">
          <OfflineAudio code={course.lang.code} narrator={narratorVoice(course.lang, st.narrator)} />
        </div>
        {support.tts ? (
          <>
            <label class="field">
              Device voice ({course.lang.name}) — only used if a recording is missing
              <select value={st.voiceURI} onChange={(e) => set('voiceURI', e.currentTarget.value)}>
                <option value="">Automatic</option>
                {voices.map((v) => (
                  <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
                ))}
              </select>
            </label>
            {voices.length === 0 && <p class="small muted">No {course.lang.name} voice found on this device. Install one in your OS speech settings for a better fallback.</p>}
          </>
        ) : (
          <p class="small muted">This browser has no built-in text-to-speech, so only recorded lines can be played.</p>
        )}
        <label class="toggle"><input type="checkbox" checked={st.autoPlay} onChange={(e) => set('autoPlay', e.currentTarget.checked)} /> Play new phrases automatically</label>
        <MicTest />
      </fieldset>

      <fieldset class="card">
        <legend>🎯 Learning</legend>
        <div class="goal-grid">
          {GOALS.map((g) => (
            <button key={g.xp} type="button" class={`goal-btn ${st.dailyGoal === g.xp ? 'active' : ''}`} aria-pressed={st.dailyGoal === g.xp} onClick={() => set('dailyGoal', g.xp)}>
              <strong>{g.label}</strong>
              <span class="small">{g.xp} XP · {g.desc}</span>
            </button>
          ))}
        </div>
        <label class="toggle"><input type="checkbox" checked={st.showTranslations} onChange={(e) => set('showTranslations', e.currentTarget.checked)} /> Show English translations</label>
        <label class="toggle"><input type="checkbox" checked={st.sounds} onChange={(e) => set('sounds', e.currentTarget.checked)} /> Sound effects</label>
        <div class="row gap wrap"><a class="btn ghost" href="#/welcome/settings">👋 Replay welcome tour</a><span class="muted small">Your progress, XP and badges stay as they are.</span></div>
      </fieldset>

      <fieldset class="card">
        <legend>💾 Your data</legend>
        <p class="small muted">
          No account needed — your progress lives only in this browser. Export a backup to move it to another device or keep it safe, then import it there.
        </p>
        <div class="row gap wrap">
          <button type="button" class="btn primary" onClick={doExport}>⬇ Export progress</button>
          <button type="button" class="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Import progress</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={doImport} />
          <button type="button" class="btn danger" onClick={doReset}>Reset all progress</button>
        </div>
      </fieldset>

      <p class="muted small center">
        Langto — get your tongue around a new language. <br />Made with ❤️ · <a href="https://github.com/adamsdenniskariuki/langto" target="_blank" rel="noopener">Source on GitHub</a>
      </p>
    </section>
  );
}
