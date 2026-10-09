// Local-only persistence (localStorage), reactive store, toasts, export/import.
import { useEffect, useState } from 'preact/hooks';
import { newlyEarned } from './badges.js';
import { dateKey } from './date.js';

export const STORAGE_KEY = 'langto:v1';
export const FORMAT = 1;

export const DEFAULT_SETTINGS = {
  lang: 'de',
  theme: 'system',
  font: 'system',
  fontScale: 1,
  rate: 0.9,
  voiceURI: '',
  dailyGoal: 20,
  showTranslations: true,
  autoPlay: true,
  sounds: true,
};

export function defaultState() {
  return {
    version: FORMAT,
    createdAt: new Date().toISOString(),
    onboarded: false,
    settings: { ...DEFAULT_SETTINGS },
    xp: 0,
    xpLog: {},
    goalsMet: 0,
    streak: { count: 0, best: 0, last: null, freezes: 0 },
    speaking: { seconds: 0, sentences: 0, attempts: 0, dialogues: 0, prompts: 0, aces: 0, free: 0, pairs: 0, drills: 0, questions: 0, branches: 0 },
    lessons: {},
    levelStarts: {},
    cards: {},
    misses: {},
    checkpoints: 0,
    tests: {},
    pronLessons: 0,
    reviews: 0,
    perfectLessons: 0,
    badges: {},
    exports: 0,
    meta: { earlyBird: false, nightOwl: false },
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Fill in any fields missing from older/foreign data with defaults.
export function migrate(data) {
  const merge = (base, over) => {
    if (!isObj(over)) return base;
    const out = { ...base };
    for (const [k, v] of Object.entries(over)) out[k] = isObj(base[k]) && isObj(v) ? merge(base[k], v) : v;
    return out;
  };
  const s = merge(defaultState(), data);
  s.version = FORMAT;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrate(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

let state = typeof localStorage !== 'undefined' ? load() : defaultState();
const listeners = new Set();
let courseInfo = {};

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast('Could not save progress — storage may be full or blocked.', '⚠️');
  }
}

export function getState() {
  return state;
}

export function setCourseInfo(lang, info) {
  courseInfo = { ...courseInfo, [lang]: info };
  update(() => {}); // re-check badges with course knowledge
}

const EVENT_TOASTS = {
  goal: () => ['Daily goal reached! 🎯', '🥅'],
  level: (e) => [`Level up! You're now level ${e.level}.`, '⬆️'],
  'freeze-earned': () => ['You earned a streak freeze ❄️', '❄️'],
  'freeze-used': (e) => [`A streak freeze saved your streak (${e.n} day${e.n > 1 ? 's' : ''}).`, '❄️'],
};

/** Mutate state via `fn(draft, events)`; persists, awards badges and notifies subscribers. */
export function update(fn) {
  const draft = structuredClone(state);
  const events = [];
  fn(draft, events);
  for (const b of newlyEarned(draft, courseInfo)) {
    draft.badges[b.id] = dateKey();
    events.push({ type: 'badge', badge: b });
  }
  state = draft;
  save();
  listeners.forEach((l) => l(state));
  for (const e of events) {
    if (e.type === 'badge') toast(`Badge unlocked: ${e.badge.name}`, e.badge.icon, 'badge');
    else if (EVENT_TOASTS[e.type]) toast(...EVENT_TOASTS[e.type](e));
  }
  return events;
}

export function replaceState(next) {
  state = migrate(next);
  save();
  listeners.forEach((l) => l(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useStore() {
  const [s, set] = useState(state);
  useEffect(() => subscribe(set), []);
  return s;
}

// ---------- Toasts ----------
let toastId = 0;
let toasts = [];
const toastListeners = new Set();
export function toast(text, icon = 'ℹ️', kind = 'info') {
  const t = { id: ++toastId, text, icon, kind };
  toasts = [...toasts, t];
  toastListeners.forEach((l) => l(toasts));
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    toastListeners.forEach((l) => l(toasts));
  }, kind === 'badge' ? 5000 : 3500);
}
export function useToasts() {
  const [t, set] = useState(toasts);
  useEffect(() => {
    toastListeners.add(set);
    return () => toastListeners.delete(set);
  }, []);
  return t;
}

// ---------- Export / import ----------
export function exportData() {
  update((s) => {
    s.exports = (s.exports || 0) + 1;
  });
  return JSON.stringify({ app: 'langto', format: FORMAT, exportedAt: new Date().toISOString(), data: state }, null, 2);
}

export function parseImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!parsed || parsed.app !== 'langto' || !isObj(parsed.data)) throw new Error("That file isn't a Langto backup.");
  if (parsed.format > FORMAT) throw new Error('This backup was made by a newer version of Langto. Please reload the site and try again.');
  const d = parsed.data;
  if (typeof d.xp !== 'number' || !isObj(d.lessons)) throw new Error('The backup looks damaged (missing progress data).');
  return migrate(d);
}

export function resetAll() {
  const keepSettings = state.settings;
  replaceState({ ...defaultState(), settings: keepSettings, onboarded: false });
}
