// Pre-generates lesson audio with Azure AI Speech (neural TTS) at build time.
//
//   AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=westeurope npm run audio
//
// Output: public/audio/<lang>/<hash>.mp3 + public/audio/<lang>/manifest.json ({ "<voice>|<text>": "<hash>.mp3" }).
// Filenames are content hashes of voice+text+format, so existing files are reused (cache) and only new or
// changed lines are synthesised. Without credentials the script indexes whatever MP3s already exist and
// exits successfully; the app then falls back to the browser's Web Speech voice.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audioKey, collectLines } from '../src/lib/tts-keys.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const KEY = process.env.AZURE_SPEECH_KEY?.trim();
const REGION = process.env.AZURE_SPEECH_REGION?.trim();
const FORMAT = 'audio-24khz-48kbitrate-mono-mp3';
const CONCURRENCY = Number(process.env.AZURE_SPEECH_CONCURRENCY || 4);
const PRUNE = !process.argv.includes('--no-prune');

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

for (const lang of langs) {
  if (!lang.tts?.default) continue;
  const course = readJSON(lang.course);
  const dir = lang.course.replace(/[^/]+$/, '');
  const units = course.levels.filter((l) => !l.comingSoon).flatMap((l) => l.units.map((f) => readJSON(dir + f)));
  const lines = collectLines(lang, units);
  const outDir = join(root, 'audio', lang.code);
  mkdirSync(outDir, { recursive: true });

  const manifest = {};
  const todo = [];
  for (const line of lines) {
    const file = fileFor(line.voice, line.text);
    if (existsSync(join(outDir, file))) {
      manifest[audioKey(line.voice, line.text)] = file;
      reused++;
    } else if (KEY && REGION) todo.push({ ...line, file });
    else missing++;
  }

  await pool(todo, CONCURRENCY, async (line) => {
    try {
      const mp3 = await synthesize(line, lang.speech);
      writeFileSync(join(outDir, line.file), mp3);
      manifest[audioKey(line.voice, line.text)] = line.file;
      made++;
      if (made % 25 === 0) console.log(`  … ${made}/${todo.length}`);
    } catch (e) {
      failed++;
      if (failed <= 5) console.warn(`⚠ ${e.message}`);
    }
  });

  if (PRUNE && KEY && REGION && !failed) {
    const keep = new Set(Object.values(manifest));
    for (const f of readdirSync(outDir)) if (f.endsWith('.mp3') && !keep.has(f)) unlinkSync(join(outDir, f));
  }

  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify({ format: FORMAT, files: sorted }, null, 1));
  console.log(`✔ ${lang.code}: ${lines.length} lines → ${Object.keys(sorted).length} audio files`);
}

console.log(`Audio: ${made} synthesised, ${reused} reused from cache${missing ? `, ${missing} missing (Web Speech fallback)` : ''}${failed ? `, ${failed} FAILED (Web Speech fallback)` : ''}.`);
if (failed && process.argv.includes('--strict')) process.exit(1);
