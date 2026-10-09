# Langto

**Get your tongue around a new language.** Langto is a free, speech-first language-learning site, starting with German. It teaches step by step, from A1 upwards, and the goal is that you can *speak*.

🌍 Live at **https://langto.madebyfavor.com**

## Features

- **Speech-first lessons**: listen & repeat, shadowing, pronunciation checks, role-play dialogues, timed spoken answers, and optional self-recording so you can compare yourself with the model.
- **Natural neural voices**: lesson audio is pre-generated with Azure AI Speech at build time. If a clip is missing, the browser's own voice (Web Speech API) is used instead.
- **Step-by-step path**: CEFR-aligned levels and units. German A1 has 10 units and 22 lessons.
- **Light gamification**: XP, daily goal, streaks with freezes, levels and badges, including speaking badges for minutes spoken, sentences said and dialogues completed. There are no hearts and no leaderboards.
- **Spaced-repetition review** of every phrase you've learned.
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
  de/course.json            # levels (A1, A2…) → unit files
  de/a1/u01-hallo.json      # a unit: lessons with tip, phrases, dialogue, prompts
```

Each lesson has:

- `phrases`: `{ "t": "German", "n": "English" }`
- an optional `tip`
- an optional `dialogue`: `{ "title", "voice"?, "lines": [{ "who": "A" | "you", "name"?, "t", "n", "voice"? }] }`
- `prompts`: `{ "n": "English cue", "t": ["accepted German answer", …] }`

`npm run validate` (run automatically on build) checks the structure.

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
