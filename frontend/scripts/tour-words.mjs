/**
 * Transcribe el audio del recorrido con voz (public/audio/recorrido.mp3) y guarda cada palabra
 * con su segundo de inicio y fin. Con eso se ponen los tiempos de `tour/recorrido.json` cada vez
 * que se regraba la voz. Usa el mismo Whisper de Groq que el dictado de la app (GROQ_API_KEY de
 * backend/.env); la llave no se imprime.
 *
 * Uso (desde la raíz del proyecto):  node frontend/scripts/tour-words.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const key = readFileSync(join(root, 'backend', '.env'), 'utf8').match(/^GROQ_API_KEY=["']?([^"'\r\n]+)/m)?.[1];
if (!key) throw new Error('Falta GROQ_API_KEY en backend/.env');

const form = new FormData();
form.append('file', new Blob([readFileSync(join(root, 'frontend', 'public', 'audio', 'recorrido.mp3'))]), 'recorrido.mp3');
form.append('model', 'whisper-large-v3');
form.append('language', 'es');
form.append('response_format', 'verbose_json');
form.append('timestamp_granularities[]', 'word');

const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${key}` },
  body: form,
});
if (!res.ok) throw new Error(`Groq respondió ${res.status}: ${(await res.text()).slice(0, 300)}`);
const { text, words, duration } = await res.json();

const out = join(tmpdir(), 'recorrido-palabras.json');
writeFileSync(out, JSON.stringify({ duration, text, words }, null, 1));
console.log(`${words.length} palabras, ${duration} s. Guardado en ${out}`);
