/** Bruits et courbes générés à la volée (pas de fichier audio) : fonctions pures, testables sous node. */
import { PLAFOND } from './params';

export type NoiseKind = 'white' | 'pink' | 'brown';

/** Bruit bouclable (jonction fondue) de RMS ≈ 0,25, graine déterministe. */
export function fillNoise(kind: NoiseKind, len: number, seed = 12345): Float32Array<ArrayBuffer> {
  const xf = Math.min(2048, len >> 2);
  const n = len + xf;
  let s = seed >>> 0 || 1;
  const rnd = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 0x80000000) - 1;
  };
  const raw = new Float32Array(n);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < n; i++) {
    const w = rnd();
    if (kind === 'white') raw[i] = w;
    else if (kind === 'pink') {
      // filtre de Paul Kellet
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      raw[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    } else {
      br = (br + 0.02 * w) / 1.02;
      raw[i] = br;
    }
  }
  // fondu enchaîné (puissance constante) : la fin se raccorde au début
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = raw[i];
  for (let i = 0; i < xf; i++) {
    const a = (i / xf) * Math.PI / 2;
    out[i] = raw[i] * Math.sin(a) + raw[len + i] * Math.cos(a);
  }
  let sum = 0;
  for (let i = 0; i < len; i++) sum += out[i];
  const mean = sum / len;
  let sq = 0;
  for (let i = 0; i < len; i++) { out[i] -= mean; sq += out[i] * out[i]; }
  const g = 0.25 / Math.max(1e-9, Math.sqrt(sq / len));
  for (let i = 0; i < len; i++) out[i] = Math.max(-1, Math.min(1, out[i] * g));
  return out;
}

/** Saturation douce (tanh normalisée) pour le moteur : impaire, monotone, y(±1) = ±1. */
export function saturationCurve(n: number, drive: number): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const d = Math.max(0.05, drive), norm = Math.tanh(d);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(d * x) / norm;
  }
  return c;
}

/** Écrêtage final : identité sous `genou`, puis arrondi progressif vers `plafond` (jamais dépassé). */
export function softClipCurve(n: number, plafond = PLAFOND, genou = 0.6): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  const span = plafond - genou;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x);
    const y = a <= genou ? a : genou + span * Math.tanh((a - genou) / span);
    c[i] = Math.sign(x) * y;
  }
  return c;
}
