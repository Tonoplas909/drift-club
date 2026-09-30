// Spectrogramme PNG (fréquence en échelle logarithmique 30 Hz–16 kHz, dB) d'un WAV : pour « voir » un rendu sans l'écouter.
//   node tools/audio-preview/spectro.mjs <fichier.wav> <sortie.png> [largeur]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { lireWav, fft } from './analyse.mjs';

const [entree, sortie, larg = '1400'] = process.argv.slice(2);
const { x, sr } = lireWav(entree);
const N = 4096, W = Number(larg), H = 420, fmin = 30, fmax = 16000;
const hann = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
const img = Buffer.alloc(W * H * 3);
const palette = (v) => { // 0..1 → noir → violet → orange → jaune
  const r = Math.min(1, v * 2), g = Math.max(0, Math.min(1, v * 2 - 0.8)), b = Math.max(0, 0.6 - Math.abs(v - 0.25) * 2.4);
  return [r * 255, g * 255, b * 255];
};
for (let cx = 0; cx < W; cx++) {
  const c = Math.floor((cx / W) * (x.length - N));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let j = 0; j < N; j++) re[j] = x[c + j] * hann[j];
  fft(re, im);
  for (let cy = 0; cy < H; cy++) {
    const f0 = fmin * Math.pow(fmax / fmin, (H - 1 - cy) / H), f1 = fmin * Math.pow(fmax / fmin, (H - cy) / H);
    let p = 0, n = 0;
    for (let k = Math.floor((f0 * N) / sr); k <= Math.ceil((f1 * N) / sr) && k < N / 2; k++) { p = Math.max(p, re[k] * re[k] + im[k] * im[k]); n++; }
    const d = 10 * Math.log10(p / (N * N / 16) + 1e-12); // ≈ dBFS
    const [r, g, b] = palette(Math.max(0, Math.min(1, (d + 100) / 80)));
    const o = (cy * W + cx) * 3; img[o] = r; img[o + 1] = g; img[o + 2] = b;
  }
}
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; img.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const crc = (() => { const t = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }); return (b) => { let c = 0xffffffff; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(sortie, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log(sortie);
