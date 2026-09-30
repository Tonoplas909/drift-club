// Analyse objective de WAV 16 bits mono : crête, RMS, facteur de crête, centroïde spectral, énergie > 5 kHz,
// écrêtage, décalage continu, sauts d'un échantillon à l'autre (clics), sonie approchée (K-weighting BS.1770, avec portes).
//   node tools/audio-preview/analyse.mjs <dossier ou fichiers .wav…>
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename } from 'node:path';

export function lireWav(chemin) {
  const b = readFileSync(chemin);
  const sr = b.readUInt32LE(24);
  const n = (b.length - 44) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  return { x, sr };
}

const db = (v) => 20 * Math.log10(Math.max(v, 1e-9));

export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

function biquad(x, b, a) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

function kWeight(x, sr) {
  // étage 1 : étagère aiguë (+4 dB à 1682 Hz) ; étage 2 : passe-haut 38 Hz (formules RBJ, approximation de la BS.1770)
  const w0 = (2 * Math.PI * 1681.97) / sr, A = Math.pow(10, 3.9998 / 40), al = Math.sin(w0) / (2 * 0.7071), c = Math.cos(w0), s2A = 2 * Math.sqrt(A) * al;
  const b1 = [A * ((A + 1) + (A - 1) * c + s2A), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - s2A)];
  const a1 = [(A + 1) - (A - 1) * c + s2A, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - s2A];
  const w1 = (2 * Math.PI * 38.135) / sr, al2 = Math.sin(w1) / (2 * 0.5003), c1 = Math.cos(w1);
  const b2 = [(1 + c1) / 2, -(1 + c1), (1 + c1) / 2], a2 = [1 + al2, -2 * c1, 1 - al2];
  return biquad(biquad(x, b1, a1), b2, a2);
}

/** Sonie intégrée approchée (LUFS, mono) : blocs de 400 ms, porte absolue −70, porte relative −10. */
function lufs(x, sr) {
  const k = kWeight(x, sr), bloc = Math.round(0.4 * sr), pas = Math.round(0.1 * sr), e = [];
  for (let i = 0; i + bloc <= k.length; i += pas) { let s = 0; for (let j = i; j < i + bloc; j++) s += k[j] * k[j]; e.push(s / bloc); }
  const l = (v) => -0.691 + 10 * Math.log10(Math.max(v, 1e-12));
  const g1 = e.filter((v) => l(v) > -70);
  if (!g1.length) return -Infinity;
  const rel = l(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter((v) => l(v) > rel);
  return g2.length ? l(g2.reduce((a, b) => a + b, 0) / g2.length) : -Infinity;
}

export function analyser(x, sr) {
  let peak = 0, sum = 0, clip = 0, tPeak = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], a = Math.abs(v); if (a > peak) { peak = a; tPeak = i / sr; } sum += v; if (a >= 0.999) clip++; }
  // RMS « actif » : fenêtres de 50 ms au-dessus de −60 dBFS
  const w = Math.round(0.05 * sr); let sq = 0, nAct = 0, sqAll = 0;
  for (let i = 0; i + w <= x.length; i += w) {
    let s = 0; for (let j = i; j < i + w; j++) s += x[j] * x[j];
    sqAll += s;
    if (db(Math.sqrt(s / w)) > -60) { sq += s; nAct += w; }
  }
  const rmsAct = Math.sqrt(sq / Math.max(1, nAct));
  // spectre : Hann 4096, saut 2048, fenêtres actives seulement
  const N = 4096, hann = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  let sp = 0, spf = 0, haut = 0, tot = 0, med = 0;
  for (let i = 0; i + N <= x.length; i += N / 2) {
    let s = 0; for (let j = i; j < i + N; j++) s += x[j] * x[j];
    if (db(Math.sqrt(s / N)) < -60) continue;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let j = 0; j < N; j++) re[j] = x[i + j] * hann[j];
    fft(re, im);
    for (let k = 1; k < N / 2; k++) {
      const f = (k * sr) / N, p = re[k] * re[k] + im[k] * im[k];
      sp += p; spf += p * f; if (f > 5000) haut += p; if (f > 2000 && f <= 5000) med += p; tot += p;
    }
  }
  // douceur : sauts de niveau entre fenêtres RMS de 50 ms voisines (un clic ou un « zipper » se voit ici ; les dents de scie périodiques non)
  let sautMax = 0, sautEnv = 0, tSaut = 0, clics = 0; const tClics = [];
  for (let i = 1; i < x.length; i++) sautMax = Math.max(sautMax, Math.abs(x[i] - x[i - 1]));
  const wm = Math.round(0.05 * sr); let prev = null;
  for (let i = 0; i + wm <= x.length; i += wm) {
    let s = 0; for (let j = i; j < i + wm; j++) s += x[j] * x[j];
    const l = db(Math.sqrt(s / wm));
    if (prev !== null && l > -55 && prev > -55) {
      const dd = Math.abs(l - prev);
      if (dd > sautEnv) { sautEnv = dd; tSaut = i / sr; }
      if (dd > 6) { clics++; if (tClics.length < 12) tClics.push(+(i / sr).toFixed(3)); }
    }
    prev = l;
  }
  return {
    crete: db(peak), rms: db(rmsAct), facteurCrete: db(peak) - db(rmsAct), lufs: lufs(x, sr),
    centroide: sp ? spf / sp : 0, haut5k: tot ? (100 * haut) / tot : 0, bande2a5: tot ? (100 * med) / tot : 0, ecretage: clip, dc: sum / x.length, sautMax, sautEnv, tSaut, clics,
    duree: x.length / sr, tPeak, tClics,
  };
}

if (process.argv[1] && process.argv[1].endsWith('analyse.mjs')) {
  const args = process.argv.slice(2);
  const fichiers = args.flatMap((a) => (statSync(a).isDirectory() ? readdirSync(a).filter((f) => f.endsWith('.wav')).map((f) => resolve(a, f)) : [resolve(a)])).sort();
  const res = {};
  for (const f of fichiers) { const { x, sr } = lireWav(f); res[basename(f, '.wav')] = analyser(x, sr); }
  console.log('fichier | crête dBFS | RMS actif dBFS | facteur de crête dB | LUFS≈ | centroïde Hz | >5 kHz % | 2-5 kHz % | écrêtage | DC | saut max | saut enveloppe dB | sauts>6dB');
  for (const [n, m] of Object.entries(res)) {
    console.log([n, m.crete.toFixed(1), m.rms.toFixed(1), m.facteurCrete.toFixed(1), m.lufs.toFixed(1), m.centroide.toFixed(0), m.haut5k.toFixed(2), m.bande2a5.toFixed(2), m.ecretage, m.dc.toExponential(1), m.sautMax.toFixed(3), `${m.sautEnv.toFixed(1)}@${m.tSaut.toFixed(2)}s`, m.clics, `crête@${m.tPeak.toFixed(2)}s`, m.tClics.length ? `à ${m.tClics.join(',')}` : ''].join(' | '));
  }
  console.log(JSON.stringify(res));
}
