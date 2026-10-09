// Web Speech API wrappers: text-to-speech, speech recognition and self-recording.
import { audioKey, voiceFor } from './tts-keys.js';
import { ensureMicPermission, forgetMicPermission, micErrorCode, micErrorMessage } from './mic.js';

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const Recognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

export const support = {
  tts: !!synth,
  stt: !!Recognition,
  record: typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder),
};

// ---------- Pre-generated neural audio (Azure Speech, built at deploy time) ----------
// public/audio/<lang>/manifest.json maps "<voice>|<text>" -> mp3 file. Missing lines fall back to Web Speech.

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/';
const manifests = new Map(); // code -> Promise<{files}>
const blobs = new Map(); // url -> Promise<objectURL>
let currentAudio = null;

export function loadAudioManifest(code) {
  if (!manifests.has(code)) {
    manifests.set(
      code,
      fetch(`${BASE}audio/${code}/manifest.json`)
        .then((r) => (r.ok ? r.json() : { files: {} }))
        .catch(() => ({ files: {} }))
    );
  }
  return manifests.get(code);
}

/** URL of the pre-generated clip for this text, or null. */
export async function audioUrlFor(lang, text, opts = {}) {
  if (!lang?.code || typeof fetch === 'undefined') return null;
  const voice = voiceFor(lang, opts);
  if (!voice) return null;
  const { files = {} } = await loadAudioManifest(lang.code);
  const file = files[audioKey(voice, text)];
  return file ? `${BASE}audio/${lang.code}/${file}` : null;
}

// Fetch as a blob (no Range requests) so the service worker can cache clips for offline use.
function blobUrl(url) {
  if (!blobs.has(url)) {
    const p = fetch(url).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.blob();
    }).then((b) => URL.createObjectURL(b));
    p.catch(() => blobs.delete(url));
    blobs.set(url, p);
  }
  return blobs.get(url);
}

async function playClip(url, rate) {
  const src = await blobUrl(url);
  const audio = new Audio(src);
  audio.playbackRate = rate;
  audio.preservesPitch = true;
  currentAudio = audio;
  await new Promise((resolve, reject) => {
    audio.onended = resolve;
    audio.onpause = resolve;
    audio.onerror = () => reject(new Error('audio error'));
    audio.play().catch(reject);
  });
}

/** Cache every clip for a language (used by Settings → "Download audio for offline"). */
export async function prefetchAudio(code, onProgress) {
  const { files = {} } = await loadAudioManifest(code);
  const urls = [...new Set(Object.values(files))].map((f) => `${BASE}audio/${code}/${f}`);
  let done = 0;
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (queue.length) {
        const u = queue.shift();
        await fetch(u).catch(() => {});
        onProgress?.(++done, urls.length);
      }
    })
  );
  return urls.length;
}

export function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/**
 * Speak `text`: pre-generated neural audio when available, otherwise the browser's Web Speech voice.
 * `course` is the course language object ({ code, speech, tts }); `role: 'partner'` / `voice` pick the speaker.
 */
export async function say(text, { course, rate = 0.9, voiceURI = '', role, voice } = {}) {
  stopSpeaking();
  try {
    const url = await audioUrlFor(course, text, { role, voice });
    if (url) return await playClip(url, rate);
  } catch {
    /* fall through to Web Speech */
  }
  return speak(text, { lang: course?.speech, rate, voiceURI, pitch: role === 'partner' ? 1.1 : 1 });
}

// ---------- Text to speech (Web Speech fallback) ----------
let voicesReady;
export function getVoices() {
  if (!synth) return Promise.resolve([]);
  if (!voicesReady) {
    voicesReady = new Promise((resolve) => {
      const have = synth.getVoices();
      if (have.length) return resolve(have);
      const done = () => resolve(synth.getVoices());
      synth.addEventListener?.('voiceschanged', done, { once: true });
      setTimeout(done, 1500);
    });
  }
  return voicesReady;
}

export async function voicesFor(langTag) {
  const base = langTag.split('-')[0].toLowerCase();
  const all = await getVoices();
  return all
    .filter((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(base))
    .sort((a, b) => (b.lang === langTag) - (a.lang === langTag) || (b.localService === false) - (a.localService === false));
}

export async function speak(text, { lang = 'de-DE', rate = 0.9, voiceURI = '', pitch = 1 } = {}) {
  if (!synth || !text) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  u.rate = rate;
  u.pitch = pitch;
  const voices = await voicesFor(lang);
  const v = voices.find((x) => x.voiceURI === voiceURI) || voices[0];
  if (v) u.voice = v;
  return new Promise((resolve) => {
    let finished = false;
    const end = () => {
      if (!finished) {
        finished = true;
        resolve();
      }
    };
    u.onend = end;
    u.onerror = end;
    // Safety net: some browsers never fire onend.
    setTimeout(end, 1500 + text.length * 180 / rate);
    synth.speak(u);
  });
}

export function stopSpeaking() {
  synth?.cancel();
  stopAudio();
}

// ---------- Speech recognition ----------
/**
 * Listen once. Resolves { transcripts: string[], seconds }.
 * Rejects with Error(code) where code is e.g. 'not-allowed', 'no-speech', 'network', 'unsupported'.
 */
// Ask for the mic first (from the user's tap) so the browser always shows its prompt, then start recognising.
function withMic(start) {
  if (!Recognition) return { promise: Promise.reject(new Error('unsupported')), stop() {} };
  let inner = null;
  let cancelled = false;
  const promise = ensureMicPermission()
    .then(() => {
      if (cancelled) throw new Error('aborted');
      inner = start();
      return inner.promise;
    })
    .catch((e) => {
      if (micErrorCode(e.message) === 'not-allowed') forgetMicPermission();
      throw e;
    });
  return {
    promise,
    stop: () => {
      cancelled = true;
      inner?.stop();
    },
  };
}

export function listen(opts = {}) {
  return withMic(() => listenNow(opts));
}

export function listenLong(opts = {}) {
  return withMic(() => listenLongNow(opts));
}

function listenNow({ lang = 'de-DE', maxSeconds = 12, onStart } = {}) {
  const rec = new Recognition();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let started = 0;
  let timer;
  const promise = new Promise((resolve, reject) => {
    let results = null;
    let error = null;
    rec.onstart = () => {
      started = performance.now();
      onStart?.();
      timer = setTimeout(() => rec.stop(), maxSeconds * 1000);
    };
    rec.onresult = (e) => {
      const r = e.results[0];
      results = Array.from(r).map((a) => a.transcript);
    };
    rec.onerror = (e) => {
      error = e.error || 'error';
    };
    rec.onend = () => {
      clearTimeout(timer);
      const seconds = started ? (performance.now() - started) / 1000 : 0;
      if (results && results.length) resolve({ transcripts: results, seconds });
      else reject(Object.assign(new Error(error || 'no-speech'), { seconds }));
    };
    try {
      rec.start();
    } catch (e) {
      reject(new Error('busy'));
    }
  });
  return { promise, stop: () => rec.stop() };
}

/**
 * Listen continuously for up to `seconds` (free speaking). Restarts the recogniser if the browser ends it early.
 * `onText(text)` receives the running transcript (final + interim). Resolves { transcript, seconds }.
 */
function listenLongNow({ lang = 'de-DE', seconds = 30, onText } = {}) {
  let finals = [];
  let interim = '';
  let stopped = false;
  let rec = null;
  let fatal = null;
  const t0 = performance.now();
  let finish;
  const promise = new Promise((resolve, reject) => {
    finish = () => {
      const transcript = [...finals, interim].join(' ').replace(/\s+/g, ' ').trim();
      const secs = (performance.now() - t0) / 1000;
      if (fatal && !transcript) reject(new Error(fatal));
      else resolve({ transcript, seconds: secs });
    };
  });
  const timer = setTimeout(() => stop(), seconds * 1000);
  const run = () => {
    rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finals.push(r[0].transcript);
        else interim += r[0].transcript;
      }
      onText?.([...finals, interim].join(' ').trim());
    };
    rec.onerror = (e) => {
      if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network'].includes(e.error)) {
        fatal = e.error;
        stopped = true;
      }
    };
    rec.onend = () => {
      if (interim) {
        finals.push(interim);
        interim = '';
      }
      if (stopped) {
        clearTimeout(timer);
        finish();
      } else run();
    };
    try {
      rec.start();
    } catch {
      fatal = 'busy';
      stopped = true;
      clearTimeout(timer);
      finish();
    }
  };
  function stop() {
    stopped = true;
    try {
      rec?.stop();
    } catch {
      finish();
    }
  }
  run();
  return { promise, stop };
}

export function recognitionErrorMessage(code) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
    case 'no-mic':
    case 'mic-busy':
    case 'insecure':
      return micErrorMessage(code);
    case 'aborted':
      return '';
    case 'no-speech':
      return "I didn't hear anything. Tap the mic and speak a little louder.";
    case 'audio-capture':
      return micErrorMessage('no-mic');
    case 'network':
      return 'Speech recognition needs an internet connection in this browser.';
    case 'unsupported':
      return "Speech recognition isn't available in this browser.";
    default:
      return 'Something went wrong with the microphone. Try again.';
  }
}

// ---------- Self-recording ----------
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const rec = new MediaRecorder(stream);
  const chunks = [];
  const t0 = performance.now();
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  rec.start();
  return {
    stop: () =>
      new Promise((resolve) => {
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          resolve({ url: URL.createObjectURL(blob), seconds: (performance.now() - t0) / 1000 });
        };
        rec.stop();
      }),
  };
}
