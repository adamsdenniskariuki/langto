import { useEffect, useState } from 'preact/hooks';
import { update, useStore } from '../lib/store.js';
import { loadLanguages } from '../lib/content.js';
import { GOALS, MicTest } from './Settings.jsx';
import { support } from '../lib/speech.js';
import { navigate } from '../router.js';
import { RotatingGreeting } from '../components/RotatingGreeting.jsx';
import { Flag } from '../components/Flag.jsx';

// Replaying the tour (#/welcome) only edits the same settings as the Settings screen. It never
// touches progress or `onboarded`, so reloading or closing mid-tour just returns to the app.
export function welcomeReturn(from) {
  return from === 'settings' ? '#/settings' : '#/';
}

export function finishOnboarding(d, replay) {
  if (!replay) d.onboarded = true;
}

export function Onboarding({ replay = false, returnTo = '#/' } = {}) {
  const s = useStore();
  const [step, setStep] = useState(0);
  const [langs, setLangs] = useState([]);
  useEffect(() => {
    loadLanguages().then(setLangs).catch(() => {});
  }, []);

  const finish = () => {
    if (!replay) update((d) => finishOnboarding(d, replay));
    navigate(replay ? returnTo : '#/');
  };

  return (
    <section class="onboarding card" aria-label={replay ? 'Welcome tour' : undefined}>
      {replay && (
        <a class="btn-icon close-tour" href={returnTo} aria-label="Close welcome tour">✕</a>
      )}
      <div class="dots" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => <span key={i} class={i === step ? 'on' : ''} />)}
      </div>

      {step === 0 && (
        <div class="center">
          <img src="/icons/icon.svg" alt="" width="96" height="96" />
          <RotatingGreeting />
          <p class="lead">Get your tongue around a new language.</p>
          <ul class="features">
            <li>🗣️ <strong>Speech-first:</strong> listen, repeat and hold real conversations out loud.</li>
            <li>🪜 <strong>Step by step:</strong> short lessons from your very first hello.</li>
            <li>🔁 <strong>Smart review</strong> brings phrases back before you forget them.</li>
            <li>🔒 <strong>No account.</strong> Your progress stays on this device — export it any time.</li>
          </ul>
          <button type="button" class="btn primary big" onClick={() => setStep(1)}>Get started</button>
        </div>
      )}

      {step === 1 && (
        <div>
          <h2>Which language do you want to speak?</h2>
          <div class="lang-grid">
            {langs.map((l) => (
              <button
                key={l.code}
                type="button"
                class={`lang-btn ${s.settings.lang === l.code ? 'active' : ''}`}
                onClick={() => {
                  update((d) => (d.settings.lang = l.code));
                  setStep(2);
                }}
              >
                <span class="flag"><Flag code={l.code} size="1.8rem" /></span>
                <strong>{l.name}</strong>
                <span class="muted small">{l.native}</span>
              </button>
            ))}
            <div class="lang-btn soon" aria-disabled="true">
              <span class="flag" aria-hidden="true">🌍</span>
              <strong>More soon</strong>
              <span class="muted small">Spanish, French…</span>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2>Pick a daily goal</h2>
          <p class="muted">Little and often beats long and rare. You can change this later.</p>
          <div class="goal-grid">
            {GOALS.map((g) => (
              <button
                key={g.xp}
                type="button"
                class={`goal-btn ${s.settings.dailyGoal === g.xp ? 'active' : ''}`}
                onClick={() => {
                  update((d) => (d.settings.dailyGoal = g.xp));
                  setStep(3);
                }}
              >
                <strong>{g.label}</strong>
                <span class="small">{g.xp} XP · {g.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2>🎙️ You'll learn by speaking</h2>
          <p>
            Every lesson asks you to say phrases out loud. {support.stt ? 'Langto listens and scores your pronunciation right in your browser.' : ''} Your
            voice is processed by your browser's speech service and is never stored by Langto.
          </p>
          <MicTest />
          <p class="muted small">Tip: use headphones and a quiet spot. Can't talk right now? Every speaking exercise can be skipped.</p>
          <div class="row gap center">
            <button type="button" class="btn primary big" onClick={finish}>{replay ? 'Done' : 'Start learning →'}</button>
          </div>
        </div>
      )}

      {step > 0 && (
        <button type="button" class="btn ghost small back" onClick={() => setStep(step - 1)}>← Back</button>
      )}
    </section>
  );
}
