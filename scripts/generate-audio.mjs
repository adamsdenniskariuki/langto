// Pre-generates lesson audio with Azure AI Speech (neural TTS) at build time.
//
//   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope npm run audio
//
// Output: public/audio/<lang>/<hash>.mp3 + public/audio/<lang>/manifest.json ({ "<voice>|<text>": "<hash>.mp3" }).
// Filenames are content hashes of voice+text+format, so existing files are reused (cache) and only new or
// changed lines are synthesised. Without credentials the script indexes whatever MP3s already exist and
// exits successfully; the app then falls back to the browser's Web Speech voice.
//
// Narrated lines are generated once per narrator voice (languages.json → tts.narrators). A monthly character
// budget (AZURE_SPEECH_MONTHLY_CHARS, default 500000 = Azure free tier, minus a 5% margin) is tracked in
// public/audio/usage.json (kept in the CI audio cache); lines over budget are deferred to later runs, most
// important first (default voices before extra narrators). public/audio/<lang>/narration.json lists
// narration-only clips per voice so offline downloads can skip narrators the learner didn't choose.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioKey, collectLines, narratorVoice } from '../src/lib/tts-keys.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const KEY = process.env.AZURE_SPEECH_KEY?.trim();
const REGION = process.env.AZURE_SPEECH_REGION?.trim();
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const CONCURRENCY = Number(process.env.AZURE_SPEECH_CONCURRENCY || 4);
const PRUNE = !process.argv.includes('--no-prune');
const MONTHLY = Number(process.env.AZURE_SPEECH_MONTHLY_CHARS || 500000);
const BUDGET = Math.floor(MONTHLY * 0.95);
const month = new Date().toISOString().slice(0, 7);

const readJSON = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const fileFor = (voice, text) => createHash('sha256').update(`${FORMAT}|${voice}|${text}`).digest('hex').slice(0, 20) + '.mp3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synthesize({ text, voice }, xmlLang) {
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${/^[a-z]{2}-[A-Z]{2}-/.test(voice) ? voice.slice(0, 5) : xmlLang}"><voice name="${esc(voice)}">${esc(text)}</voice></speak>`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': FORMAT,
        'User-Agent': 'langto-audio-generator',
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      await sleep(Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`Azure TTS ${res.status} ${res.statusText} for "${text}" (${voice}): ${(await res.text()).slice(0, 200)}`);
  }
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const langs = readJSON('content/languages.json');
if (!KEY || !REGION) console.warn('⚠ AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set — skipping synthesis; indexing existing audio only.');
let made = 0;
let reused = 0;
let missing = 0;
let failed = 0;
// Circuit breaker: after this many failures in a row (e.g. quota exhausted) stop calling Azure so CI doesn't hang.
const MAX_STREAK = Number(process.env.AZURE_SPEECH_MAX_FAILURES || 20);
let streak = 0;
let tripped = false;
let deferred = 0;
let deferredChars = 0;
let spent = 0;

// Characters already sent to Azure this month. Without a ledger (first run or lost cache) assume every
// existing clip was made this month — conservative, so we never overshoot the free tier.
const usagePath = join(root, 'audio', 'usage.json');
let usage = null;
try {
  usage = JSON.parse(readFileSync(usagePath, 'utf8'));
} catch {
  /* no ledger yet */
}
let used = null;
const startUsed = (existingChars) => {
  if (used !== null) return;
  if (usage?.month === month) used = usage.chars;
  else if (usage) used = 0;
  else used = existingChars;
};

for (const lang of langs) {
  if (!lang.tts?.default) continue;
  const course = readJSON(lang.course);
  const dir = lang.course.replace(/[^/]+$/, '');
  const units = [
    ...course.levels.filter((l) => !l.comingSoon).flatMap((l) => l.units),
    ...(course.tracks || []).flatMap((t) => t.units),
  ].map((f) => readJSON(dir + f));
  const lines = collectLines(lang, units);
  const outDir = join(root, 'audio', lang.code);
  mkdirSync(outDir, { recursive: true });

  const manifest = {};
  const narration = {};
  let todo = [];
  let existingChars = 0;
  for (const line of lines) {
    const file = fileFor(line.voice, line.text);
    if (existsSync(join(outDir, file))) {
      manifest[audioKey(line.voice, line.text)] = file;
      existingChars += line.text.length;
      reused++;
    } else if (KEY && REGION) todo.push({ ...line, file });
    else missing++;
  }

  if (todo.length) {
    startUsed(existingChars);
    // Default-voice lines first; extra narrator voices (nice-to-have) last.
    const main = narratorVoice(lang);
    const rank = (l) => (l.narrated && l.voice !== main ? 1 : 0);
    todo.sort((a, b) => rank(a) - rank(b));
    let left = BUDGET - used;
    const keep = [];
    for (const l of todo) {
      if (l.text.length <= left) {
        left -= l.text.length;
        keep.push(l);
      } else {
        deferred++;
        deferredChars += l.text.length;
      }
    }
    todo = keep;
  }

  await pool(todo, CONCURRENCY, async (line) => {
    if (tripped) {
      failed++;
      return;
    }
    try {
      spent += line.text.length;
      const mp3 = await synthesize(line, lang.speech);
      writeFileSync(join(outDir, line.file), mp3);
      manifest[audioKey(line.voice, line.text)] = line.file;
      made++;
      streak = 0;
      if (made % 25 === 0) console.log(`  … ${made}/${todo.length}`);
    } catch (e) {
      failed++;
      if (failed <= 5) console.warn(`⚠ ${e.message}`);
      if (++streak >= MAX_STREAK && !tripped) {
        tripped = true;
        console.warn(`⚠ ${streak} failures in a row — stopping synthesis (quota or outage?). Remaining lines use Web Speech.`);
      }
    }
  });

  if (PRUNE && KEY && REGION && !failed) {
    const keep = new Set(Object.values(manifest));
    for (const f of readdirSync(outDir)) if (f.endsWith('.mp3') && !keep.has(f)) unlinkSync(join(outDir, f));
  }

  for (const l of lines) {
    const f = manifest[audioKey(l.voice, l.text)];
    if (l.narrated && f) (narration[l.voice] ||= []).push(f);
  }
  for (const v of Object.keys(narration)) narration[v].sort();
  writeFileSync(join(outDir, 'narration.json'), JSON.stringify(narration));

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ format: FORMAT, files: sorted }, null, 1));
  console.log(`✔ ${lang.code}: ${lines.length} lines → ${Object.keys(sorted).length} audio files`);
}

if (used !== null) {
  writeFileSync(usagePath, JSON.stringify({ month, chars: used + spent }, null, 1));
  console.log(`Azure characters this month: ${used + spent} of ${BUDGET} budget (${MONTHLY} free tier).`);
}
if (deferred) console.log(`⏭ ${deferred} lines (${deferredChars} chars) deferred to next month's budget — they fall back to the other narrator / device voice until then.`);
console.log(`Audio: ${made} synthesised, ${reused} reused from cache${missing ? `, ${missing} missing (Web Speech fallback)` : ''}${failed ? `, ${failed} FAILED (Web Speech fallback)` : ''}.`);
if (failed && process.argv.includes('--strict')) process.exit(1);
