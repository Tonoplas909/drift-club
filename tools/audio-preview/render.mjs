// Rend les scénarios audio en WAV via Chromium headless (OfflineAudioContext), avec le nouvel AudioEngine et,
// si OLD_AUDIO est défini, l'ancien (fichier audio.ts d'avant la refonte, imports absolus) pour comparer.
//   node tools/audio-preview/render.mjs <dossier de sortie>
// Variables : PLAYWRIGHT (chemin de playwright-core/index.mjs), CHROME (exécutable), OLD_AUDIO (ancien audio.ts), SCENARIOS (liste séparée par des virgules).
import { build } from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sortie = resolve(process.argv[2] ?? 'sons');
mkdirSync(sortie, { recursive: true });
const old = process.env.OLD_AUDIO ? resolve(process.env.OLD_AUDIO) : null;

const entree = `
import { rendre, rendreVoix, SCENARIOS, VOIX_SEULES } from ${JSON.stringify(resolve(racine, 'tools/audio-preview/harness.ts'))};
import { AudioEngine as Neuf } from ${JSON.stringify(resolve(racine, 'src/audio/audio.ts'))};
${old ? `import { AudioEngine as Ancien } from ${JSON.stringify(old)};` : ''}
function b64(f32) { const u = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
window.__scenarios = SCENARIOS;
window.__voix = VOIX_SEULES;
window.__rendreVoix = async (nom) => b64(await rendreVoix(nom));
window.__rendre = async (nom, variante) => {
  const make = variante === 'neuf'
    ? (ctx) => new Neuf({ context: ctx })
    : (ctx) => { window.AudioContext = function () { return ctx; }; return new Ancien(); };
  return b64(await rendre(nom, make, 1));
};`;
const r = await build({ stdin: { contents: entree, resolveDir: racine, loader: 'ts' }, bundle: true, write: false, format: 'iife', target: 'es2022', nodePaths: [resolve(racine, 'node_modules')] });
const js = r.outputFiles[0].text;

function wav(f32, sr = 44100) {
  const n = f32.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767))), 44 + i * 2);
  return buf;
}

const pw = await import(pathToFileURL(process.env.PLAYWRIGHT ?? 'playwright-core/index.mjs').href);
const navigateur = await pw.chromium.launch({ executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const page = await navigateur.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: js });
const liste = process.env.SCENARIOS ? process.env.SCENARIOS.split(',') : await page.evaluate(() => window.__scenarios);
for (const variante of old ? ['neuf', 'ancien'] : ['neuf']) {
  for (const nom of liste) {
    const b = await page.evaluate(([n, v]) => window.__rendre(n, v), [nom, variante]);
    const f32 = new Float32Array(Buffer.from(b, 'base64').buffer.slice(0));
    const fichier = resolve(sortie, `${variante === 'neuf' ? '' : 'avant-'}${nom}.wav`);
    writeFileSync(fichier, wav(f32));
    console.log(fichier, f32.length);
  }
}
if (process.env.VOIX) {
  for (const nom of await page.evaluate(() => window.__voix)) {
    const f32 = new Float32Array(Buffer.from(await page.evaluate((n) => window.__rendreVoix(n), nom), 'base64').buffer.slice(0));
    writeFileSync(resolve(sortie, `${nom}.wav`), wav(f32));
  }
}
await navigateur.close();
