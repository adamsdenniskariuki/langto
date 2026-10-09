import { useState } from 'preact/hooks';
import { say } from '../lib/speech.js';
import { useStore } from '../lib/store.js';
import { useCourse } from './context.js';

/** Play a phrase with the target-language voice. Includes a slow "turtle" button. */
export function PlayButton({ text, role, voice, big = false, slow = true, label = 'Listen' }) {
  const s = useStore();
  const course = useCourse();
  const [playing, setPlaying] = useState(false);
  const play = async (rate) => {
    setPlaying(true);
    await say(text, { course: course.lang, rate, voiceURI: s.settings.voiceURI, role, voice });
    setPlaying(false);
  };
  return (
    <span class="play-group">
      <button type="button" class={`btn-icon ${big ? 'big' : ''} ${playing ? 'pulse' : ''}`} onClick={() => play(s.settings.rate)} aria-label={`${label}: ${text}`} title={label}>
        🔊
      </button>
      {slow && (
        <button type="button" class="btn-icon small" onClick={() => play(Math.max(0.5, s.settings.rate * 0.6))} aria-label={`Listen slowly: ${text}`} title="Slow">
          🐢
        </button>
      )}
    </span>
  );
}
