# Langto

**Get your tongue around a new language.** Langto is a free, speech-first language-learning site. It teaches step by step, from your very first hello upwards, and the goal is that you can *speak*. The first course is German (A1–C2), and more languages can be added as content alone.

🌍 Live at **https://langto.madebyfavor.com**

## Features

- **Speech-first lessons**: listen & repeat, shadowing, pronunciation checks, role-play dialogues, timed spoken answers, and optional self-recording so you can compare yourself with the model.
- **Varied lesson types in every unit**: grammar tips with spoken substitution drills, natural-speed listening (stories and conversations in several voices) with questions you answer out loud, **branching role-plays** where what you say decides how the other person replies, **free speaking tasks** checked against target words, and culture notes (du vs Sie, Germany/Austria/Switzerland, everyday customs).
- **Speaking checkpoints and level tests**: each unit ends with a checkpoint where you say its phrases from the English prompt only. Each level ends with a speaking test that earns the level badge.
- **Pronunciation track**: a separate path for the sounds English speakers find hard (ü ö ä, ch, r, final -en, sch/sp/st, w/v, z, vowel length, stress and intonation), with minimal-pair listening and shadowing. It unlocks gradually as you reach each level.
- **Natural neural voices**: lesson audio is pre-generated with Azure AI Speech at build time. If a clip is missing, the browser's own voice (Web Speech API) is used instead.
- **Step-by-step path**: CEFR-aligned levels and units. German covers the full range from A1 to C2: 50 units and over 400 lessons, plus a 10-unit pronunciation track, from greetings up to irony, rhetoric and Austrian and Swiss German. Learners who already know some German can choose to **start at any level**.
- **Light gamification**: XP, daily goal, streaks with freezes, levels and badges, including speaking badges for minutes spoken, sentences said and dialogues completed, badges for pronunciation, checkpoints and free speaking, plus a level badge (earned by passing the level's speaking test) and a speaking milestone for each level. There are no hearts and no leaderboards.
- **Spaced-repetition review** of every phrase you've learned, plus a **Most missed** session built from the phrases you slip on most.
- **Themes and fonts**: System (follows dark mode), Light, Dark, Sepia, High contrast and more. Fonts include a dyslexia-friendly option, and text size is adjustable.
- **No account and fully private**: progress lives in your browser (localStorage). You can **export and import** a JSON backup to move between devices.
- **Works offline (PWA)**: you can download all lesson audio for offline use in Settings.

### Browser support for speaking

Pronunciation checks use the browser's `SpeechRecognition` (de-DE). This works in Chrome, Edge and Safari. In Firefox, and anywhere the mic isn't available, Langto falls back gracefully: you can still listen, record yourself and self-assess.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests (vitest)
npm run build      # validates content, then builds to dist/
npm run preview    # serve the production build
npm run audio      # (optional) pre-generate lesson audio, see below
```

## Lesson audio with Azure AI Speech

`scripts/generate-audio.mjs` reads every phrase, dialogue line and model answer from `public/content/<lang>/**`. It synthesises MP3s through the Azure Speech REST API with neural voices and writes them to `public/audio/<lang>/<hash>.mp3`, along with a `manifest.json`.

- **Filenames are content hashes** of voice + text + format. Existing files are skipped, so only new or changed lines are synthesised. CI keeps `public/audio` in the Actions cache between runs.
- **Voices** come from `tts` in `public/content/languages.json`: `default` speaks phrases and your lines, and `partner` speaks the other person in dialogues. You can override a voice per dialogue with `"voice"` on the dialogue, or per line with `"voice"` on the line.
- **No keys means no failure.** Without credentials the script just indexes any MP3s already present and exits successfully. The app then uses the browser voice.

### Set it up

1. In the [Azure portal](https://portal.azure.com), create a **Speech** resource (*Azure AI services → Speech service*). The free **F0** tier (0.5M characters a month for neural voices) is plenty for this course.
2. Open the resource and go to **Keys and Endpoint**. Copy **Key 1** and the **Location/Region** (e.g. `westeurope`).
3. In GitHub, go to **Settings → Secrets and variables → Actions → New repository secret** for this repo and add:
   - `AZURE_SPEECH_KEY`: the key
   - `AZURE_SPEECH_REGION`: the region, e.g. `westeurope`
4. Re-run the **Deploy to GitHub Pages** workflow, or push to `main`.

To generate audio locally (PowerShell):

```powershell
$env:AZURE_SPEECH_KEY = "<key>"; $env:AZURE_SPEECH_REGION = "westeurope"; npm run audio
```

`public/audio/` is git-ignored, so never commit keys or generated audio. Flags:

- `--strict`: fail when any line fails
- `--no-prune`: keep unused MP3s

## Content and adding a language

All course content is JSON in `public/content/`, so adding a language is just adding content:

```
public/content/
  languages.json            # languages: code, name, flag, speech tag (e.g. de-DE), tts voices, greetings…
  de/course.json            # levels (A1, A2…) → unit files; tracks (pronunciation) → unit files
  de/a1/u01-hallo.json      # a unit: lessons with tip, phrases, dialogue, prompts…
  de/pron/u01-umlaute.json  # a pronunciation-track unit ("level": "A1" decides when it unlocks)
```

Each lesson has:

- `id`, `title`, `goal` and an optional `kind`: `grammar`, `listening`, `roleplay`, `speaking`, `pron`, `checkpoint` or `test`. If `kind` is left out, it's an ordinary lesson.
- `phrases`: `{ "t": "German", "n": "English" }` (at least 4 for ordinary lessons)
- an optional `tip`: `{ "title", "body" }`, and an optional `culture` note: `{ "title", "body", "regions"?: ["DE", "AT", "CH"] }`
- an optional `dialogue`: `{ "title", "voice"?, "lines": [{ "who": "A" | "you", "name"?, "t", "n", "voice"? }] }`
- `prompts`: `{ "n": "English cue", "t": ["accepted German answer", …] }`
- `drills` (grammar): `[{ "title"?, "base": { "t", "n" }, "items": [{ "cue", "t", "n" }] }]`. The learner sees the base sentence and the cue, then says the changed sentence.
- `story` (listening): `{ "title", "intro"?, "voice"?, "rate"?, "lines": [{ "name"?, "voice"?, "t", "n" }], "questions": [{ "q", "n", "t": [answers] }] }`
- `branch` (role-play): `{ "title", "scene"?, "name", "voice"?, "start", "nodes": { "<id>": { "t", "n", "choices": [{ "t", "n", "next" }] } } }`. A node without `choices` ends the scene; add `"end": "good" | "bad"` and an `"outcome"`.
- `free` (free speaking): `[{ "n", "hint"?, "seconds", "minWords"?, "targets": [{ "label", "any": ["word", "phrase", "stem*"] }], "model" }]`. The transcript is checked on the device for the target words.
- `pairs` and `stress` (pronunciation): `[{ "sound"?, "a": { "t", "n" }, "b": { "t", "n" } }]` and `[{ "t", "n", "mark": "Ich *kom*me aus Ber*lin*.", "note"? }]`
- Checkpoints (`"kind": "checkpoint"`) and level tests (`"kind": "test"`, last lesson of a level) need no phrases. They sample phrases from the unit or level, and a test must be passed to earn the level badge.

Only append new lessons and phrases. Review cards are keyed by lesson id and phrase position, so renaming ids or reordering phrases would orphan saved progress.

`npm run validate` (run automatically on build) checks the structure, including that every role-play node is reachable.

To add a language:

1. Add an entry to `languages.json` with neural voices from the [Azure voice list](https://learn.microsoft.com/azure/ai-services/speech-service/language-support?tabs=tts).
2. Create `public/content/<code>/course.json` and its unit files.

## Deployment

`.github/workflows/deploy.yml` runs on every push to `main`. It installs dependencies, runs the tests, generates or restores audio, builds, and deploys to **GitHub Pages**. Pages source is set to *GitHub Actions*.

The custom domain is **langto.madebyfavor.com**, set by `public/CNAME`. It needs a DNS record:

| Type  | Name     | Value                          |
|-------|----------|--------------------------------|
| CNAME | `langto` | `adamsdenniskariuki.github.io` |

Once the certificate has been issued, enable **Enforce HTTPS** under *Settings → Pages*.

## Privacy

Langto has no backend and no analytics. Your progress never leaves your device unless you export it. Speech recognition is provided by your browser; some browsers, such as Chrome, send the audio to their own speech service.
