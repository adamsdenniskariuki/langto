// Shared by the app and scripts/generate-audio.mjs so both agree on which voice speaks which text.

export const DEFAULT_TTS = { default: '', partner: '' };

/** Normalise text the same way at build time and runtime (strip trailing "…", collapse spaces). */
export function ttsText(text) {
  return String(text || '')
    .replace(/(\u2026|\.\.\.)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Narrator voices a course offers (languages.json → tts.narrators: [{ id, label, voice }]).
 * Without a list, the course default voice is the only narrator.
 */
export function narrators(lang) {
  const tts = lang?.tts || DEFAULT_TTS;
  if (Array.isArray(tts.narrators) && tts.narrators.length) return tts.narrators.filter((n) => n?.id && n?.voice);
  return tts.default ? [{ id: 'default', label: 'Default', voice: tts.default }] : [];
}

/** Voice of the chosen narrator `id`; unknown/empty ids fall back to the course default voice. */
export function narratorVoice(lang, id) {
  const ns = narrators(lang);
  const def = lang?.tts?.default;
  return (ns.find((n) => n.id === id) || ns.find((n) => n.voice === def) || ns[0])?.voice || def || '';
}

/** Narrated lines (vocab, drills, prompts…) follow the narrator setting; dialogue/story characters don't. */
export const isNarrated = ({ voice, role, character } = {}) => !voice && !role && !character;

/**
 * Resolve the Azure voice name for a line. `role` is 'partner' for the other speaker in dialogues,
 * `character: true` marks a story/dialogue line spoken by the default character voice, and `narrator`
 * is the learner's chosen narrator id for narrated lines.
 */
export function voiceFor(lang, opts = {}) {
  const tts = lang?.tts || DEFAULT_TTS;
  if (opts.voice) return opts.voice;
  if (opts.role === 'partner') return tts.partner || tts.default || '';
  if (opts.role || opts.character) return tts.default || '';
  return narratorVoice(lang, opts.narrator);
}

/** Voices to try for a line, best first: chosen narrator, then the other narrators. */
export function voiceCandidates(lang, opts = {}) {
  const first = voiceFor(lang, opts);
  if (!isNarrated(opts)) return first ? [first] : [];
  return [...new Set([first, ...narrators(lang).map((n) => n.voice)].filter(Boolean))];
}
export const audioKey = (voice, text) => `${voice}|${ttsText(text)}`;

/**
 * Every { text, voice, narrated } the app may play for a language's course content. Narrated lines are
 * listed once per narrator voice; `narrated` is false if a clip is also used by a dialogue/story character.
 */
export function collectLines(lang, units) {
  const out = new Map();
  const put = (t, voice, narrated) => {
    const k = audioKey(voice, t);
    const prev = out.get(k);
    out.set(k, { text: t, voice, narrated: prev ? prev.narrated && narrated : narrated });
  };
  const add = (text, opts = {}) => {
    const t = ttsText(text);
    if (!t) return;
    if (isNarrated(opts)) for (const n of narrators(lang)) put(t, n.voice, true);
    else {
      const voice = voiceFor(lang, opts);
      if (voice) put(t, voice, false);
    }
  };
  if (lang.voiceSample) add(lang.voiceSample);
  for (const unit of units) {
    for (const l of unit.lessons || []) {
      for (const p of l.phrases || []) add(p.t);
      for (const line of l.dialogue?.lines || []) {
        add(line.t, line.who === 'you' ? { voice: line.voice, character: true } : { voice: line.voice || l.dialogue.voice, role: 'partner' });
      }
      for (const p of l.prompts || []) for (const a of p.t || []) add(a);
      for (const d of l.drills || []) {
        add(d.base?.t);
        for (const it of d.items || []) add(it.t);
      }
      if (l.story) {
        const sv = l.story.voice;
        for (const line of l.story.lines || []) add(line.t, { voice: line.voice || sv, role: line.voice || sv ? undefined : line.role, character: true });
        for (const q of l.story.questions || []) {
          add(q.q);
          if (q.t?.[0]) add(q.t[0]);
        }
      }
      if (l.branch) for (const node of Object.values(l.branch.nodes || {})) add(node.t, { voice: l.branch.voice, role: 'partner' });
      for (const f of l.free || []) add(f.model);
      for (const pr of l.pairs || []) {
        add(pr.a?.t);
        add(pr.b?.t);
      }
      for (const st of l.stress || []) add(st.t);
    }
  }
  return [...out.values()];
}
