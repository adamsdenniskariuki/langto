// Shared by the app and scripts/generate-audio.mjs so both agree on which voice speaks which text.

export const DEFAULT_TTS = { default: '', partner: '' };

/** Normalise text the same way at build time and runtime (strip trailing "…", collapse spaces). */
export function ttsText(text) {
  return String(text || '')
    .replace(/(\u2026|\.\.\.)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resolve the Azure voice name for a line. `role` is 'partner' for the other speaker in dialogues. */
export function voiceFor(lang, { voice, role } = {}) {
  const tts = lang?.tts || DEFAULT_TTS;
  return voice || (role === 'partner' ? tts.partner || tts.default : tts.default) || '';
}

export const audioKey = (voice, text) => `${voice}|${ttsText(text)}`;

/** Every { text, voice } the app may play for a language's course content. */
export function collectLines(lang, units) {
  const out = new Map();
  const add = (text, opts) => {
    const t = ttsText(text);
    const voice = voiceFor(lang, opts);
    if (t && voice) out.set(audioKey(voice, t), { text: t, voice });
  };
  if (lang.voiceSample) add(lang.voiceSample);
  for (const unit of units) {
    for (const l of unit.lessons || []) {
      for (const p of l.phrases || []) add(p.t);
      for (const line of l.dialogue?.lines || []) {
        add(line.t, line.who === 'you' ? { voice: line.voice } : { voice: line.voice || l.dialogue.voice, role: 'partner' });
      }
      for (const p of l.prompts || []) for (const a of p.t || []) add(a);
      for (const d of l.drills || []) {
        add(d.base?.t);
        for (const it of d.items || []) add(it.t);
      }
      if (l.story) {
        const sv = l.story.voice;
        for (const line of l.story.lines || []) add(line.t, { voice: line.voice || sv, role: line.voice || sv ? undefined : line.role });
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
