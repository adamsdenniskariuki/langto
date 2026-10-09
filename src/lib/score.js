// Pronunciation / answer scoring. Pure functions, unit-tested.

const DE_ONES = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn',
  'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
const DE_TENS = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];

export function deNumber(n) {
  if (n < 20) return DE_ONES[n];
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10;
    return (o ? (o === 1 ? 'ein' : DE_ONES[o]) + 'und' : '') + DE_TENS[t];
  }
  if (n < 1000) {
    const h = Math.floor(n / 100), r = n % 100;
    return (h === 1 ? 'ein' : DE_ONES[h]) + 'hundert' + (r ? deNumber(r) : '');
  }
  return String(n);
}

// Speech recognisers often return digits ("3 Uhr") — spell them out so they match the lesson text.
const NUMBER_SPELLERS = { de: deNumber };

export function normalize(text, lang = 'de') {
  let s = String(text || '').normalize('NFC').toLowerCase();
  const spell = NUMBER_SPELLERS[lang];
  if (spell) {
    s = s.replace(/(\d{1,2})[:.](\d{2})(\s*uhr)?/g, (m, h, mm) => `${h} uhr${mm === '00' ? '' : ' ' + Number(mm)}`);
    s = s.replace(/\d+/g, (d) => (Number(d) < 1000 ? spell(Number(d)) : d));
  }
  if (lang === 'de') s = s.replace(/ß/g, 'ss');
  s = s.replace(/€/g, ' euro ');
  return s.replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

// Answers ending in "…" or "..." are open-ended: only the beginning must match ("Ich heiße …").
export function isOpen(expected) {
  return /(\u2026|\.\.\.)\s*$/.test(expected);
}

function compareOne(expected, heard, lang) {
  const open = isOpen(expected);
  const e = normalize(expected, lang);
  let h = normalize(heard, lang);
  if (open) {
    const n = e.split(' ').length;
    const hw = h.split(' ');
    if (hw.length <= n) return { score: similarity(e, h) * 0.9, open };
    h = hw.slice(0, n).join(' ');
  }
  return { score: similarity(e, h), open };
}

/**
 * Score what the learner said against one or more accepted answers.
 * @param {string|string[]} expected accepted answers
 * @param {string[]} heard recogniser alternatives (best first)
 */
export function scoreSpeech(expected, heard, lang = 'de') {
  const answers = (Array.isArray(expected) ? expected : [expected]).filter(Boolean);
  const alts = (heard || []).filter((x) => x && x.trim());
  let best = { score: 0, answer: answers[0] || '', heard: alts[0] || '' };
  for (const a of answers) {
    for (const h of alts) {
      const { score } = compareOne(a, h, lang);
      if (score > best.score) best = { score, answer: a, heard: h };
    }
  }
  return { ...best, words: wordMatches(best.answer, best.heard, lang) };
}

export function wordMatches(expected, heard, lang = 'de') {
  const hw = normalize(heard, lang).split(' ').filter(Boolean);
  return String(expected).replace(/(\u2026|\.\.\.)\s*$/, '').split(/\s+/).filter(Boolean).map((w) => {
    const nw = normalize(w, lang);
    if (!nw) return { w, ok: true };
    const ok = hw.some((x) => similarity(nw, x) >= 0.75);
    return { w, ok };
  });
}

export const PASS = 0.75;
export const GREAT = 0.9;

export function verdict(score) {
  if (score >= 0.97) return { label: 'Perfect!', tone: 'great', emoji: '🌟' };
  if (score >= GREAT) return { label: 'Excellent!', tone: 'great', emoji: '🎉' };
  if (score >= PASS) return { label: 'Good — keep going!', tone: 'good', emoji: '👍' };
  if (score >= 0.5) return { label: 'Almost — try again', tone: 'close', emoji: '💪' };
  return { label: "Let's try that again", tone: 'miss', emoji: '🔁' };
}

// Compare typed answers (keyboard fallback).
export function checkTyped(expected, typed, lang = 'de') {
  return scoreSpeech(expected, [typed], lang).score >= 0.85;
}
