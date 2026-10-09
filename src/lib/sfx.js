// Tiny synthesized sound effects (no audio files needed).
import { getState } from './store.js';

let ctx;
function tone(freq, start, dur, type = 'sine', gain = 0.08) {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur);
}

export function sfx(kind) {
  if (!getState().settings.sounds) return;
  try {
    if (kind === 'good') {
      tone(660, 0, 0.12);
      tone(880, 0.1, 0.18);
    } else if (kind === 'bad') {
      tone(220, 0, 0.2, 'triangle');
    } else if (kind === 'done') {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.1, 0.25));
    }
  } catch {
    /* audio unavailable */
  }
}
