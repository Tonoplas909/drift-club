/**
 * Sons ponctuels (événements de course, interface, caisses). Chaque fonction planifie à l'instant `t` (secondes du contexte)
 * et libère ses nœuds toute seule : aucune fuite, attaque ≥ 1,5 ms et fin sous −80 dB (pas de clic).
 */
import type { Rarete } from '../core/raretes';
import type { Env } from './bus';
import type { NoiseKind } from './noise';
import { bankNotes, chocIntensite, revealParams, tempsFinDecroissance, tickFreq } from './params';

interface Tone { t: number; f: number; f1?: number; glide?: number; type?: OscillatorType; peak: number; atk?: number; tau: number; lp?: number; detune?: number }
interface Burst {
  t: number; kind?: NoiseKind; filter?: BiquadFilterType; f: number; f1?: number; sweep?: number; q?: number;
  peak: number; atk?: number; tau: number; lp?: number; offset?: number; am?: { f: number; depth: number };
}

function suivre(env: Env, src: AudioScheduledSourceNode, ...noeuds: AudioNode[]): void {
  env.actives.n++;
  src.onended = () => {
    env.actives.n--;
    src.disconnect();
    for (const n of noeuds) n.disconnect();
  };
}

/** Enveloppe : 0 → peak (attaque linéaire) puis décroissance exponentielle de constante `tau`. */
function enveloppe(p: AudioParam, t: number, peak: number, atk: number, tau: number): void {
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(peak, t + atk);
  p.setTargetAtTime(0, t + atk, tau);
}

function tone(env: Env, out: AudioNode, o: Tone): void {
  const { ctx } = env;
  const atk = o.atk ?? 0.004;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, o.t);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t + (o.glide ?? 0.2));
  if (o.detune) osc.detune.value = o.detune;
  const g = ctx.createGain();
  enveloppe(g.gain, o.t, o.peak, atk, o.tau);
  const noeuds: AudioNode[] = [g];
  let tete: AudioNode = osc;
  if (o.lp) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = 0.5;
    osc.connect(lp); tete = lp; noeuds.push(lp);
  }
  tete.connect(g); g.connect(out);
  suivre(env, osc, ...noeuds);
  osc.start(o.t);
  osc.stop(tempsFinDecroissance(o.t, atk, o.tau));
}

function burst(env: Env, out: AudioNode, o: Burst): void {
  const { ctx } = env;
  const atk = o.atk ?? 0.004;
  const src = ctx.createBufferSource();
  src.buffer = env.noise[o.kind ?? 'pink'];
  src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = o.filter ?? 'lowpass';
  f.frequency.setValueAtTime(o.f, o.t);
  if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(o.f1, o.t + (o.sweep ?? 0.2));
  f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  enveloppe(g.gain, o.t, o.peak, atk, o.tau);
  src.connect(f);
  const noeuds: AudioNode[] = [f, g];
  let tete: AudioNode = f;
  if (o.lp) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = o.lp; lp.Q.value = 0.5;
    f.connect(lp); tete = lp; noeuds.push(lp);
  }
  tete.connect(g); g.connect(out);
  if (o.am) {
    // trémolo (frottement saccadé) : oscillateur → gain → g.gain
    const lfo = ctx.createOscillator(); lfo.frequency.value = o.am.f;
    const d = ctx.createGain(); d.gain.value = o.am.depth;
    lfo.connect(d); d.connect(g.gain);
    suivre(env, lfo, d);
    lfo.start(o.t); lfo.stop(tempsFinDecroissance(o.t, atk, o.tau));
  }
  suivre(env, src, ...noeuds);
  src.start(o.t, o.offset ?? 0);
  src.stop(tempsFinDecroissance(o.t, atk, o.tau));
}

/** Timbre de cloche douce : fondamentale + octave + partiel inharmonique bref. */
function cloche(env: Env, out: AudioNode, t: number, f: number, peak: number, tau: number): void {
  tone(env, out, { t, f, peak, atk: 0.004, tau });
  tone(env, out, { t, f: f * 2, peak: peak * 0.14, atk: 0.004, tau: tau * 0.55 });
  tone(env, out, { t, f: f * 2.76, peak: peak * 0.03, atk: 0.003, tau: tau * 0.2 });
}

// ---------- course ----------

/** Décompte : 3-2-1 bips doux ; 0 = « GO » plus haut, plus ample (accord majeur). */
export function decompte(env: Env, out: AudioNode, t: number, n: number): void {
  if (n > 0) {
    tone(env, out, { t, f: 440, peak: 0.2, atk: 0.008, tau: 0.07, lp: 3000 });
    tone(env, out, { t, f: 880, peak: 0.03, atk: 0.008, tau: 0.04 });
  } else {
    for (const [f, p] of [[880, 0.17], [1108.7, 0.12], [1318.5, 0.1]] as const) tone(env, out, { t, f, peak: p, atk: 0.01, tau: 0.16, lp: 4000 });
    tone(env, out, { t, f: 440, peak: 0.08, atk: 0.01, tau: 0.2 });
  }
}

/** « Ding » agréable de l'encaissement d'un drift, plus haut à chaque cran de multiplicateur. */
export function ding(env: Env, out: AudioNode, t: number, multiplier: number): void {
  for (const n of bankNotes(multiplier)) cloche(env, out, t + n.delai, n.f, 0.17 * n.gain, 0.11);
}

/** Drift perdu : glissando descendant, feutré. */
export function perdu(env: Env, out: AudioNode, t: number): void {
  tone(env, out, { t, f: 392, f1: 247, glide: 0.4, peak: 0.13, atk: 0.012, tau: 0.13, lp: 1300 });
  tone(env, out, { t, f: 196, f1: 123, glide: 0.4, type: 'triangle', peak: 0.07, atk: 0.012, tau: 0.13, lp: 700 });
}

/** Frottement contre une barrière : bruit filtré saccadé, `k` 0..1. */
export function frottement(env: Env, out: AudioNode, t: number, k: number): void {
  const dur = 0.15 + 0.35 * k;
  burst(env, out, { t, kind: 'white', filter: 'bandpass', f: 650, f1: 1000, sweep: dur, q: 2.2, peak: 0.45 * (0.4 + 0.6 * k), atk: 0.02, tau: dur / 3.5, lp: 2600, am: { f: 38, depth: 0.12 * k } });
}

/** Choc : sourd (sinus grave + bruit passe-bas), proportionnel à l'impact ; les gros chocs ajoutent craquement et frottement. */
export function choc(env: Env, out: AudioNode, t: number, impact: number): void {
  const k = chocIntensite(impact);
  tone(env, out, { t, f: 115, f1: 46, glide: 0.2, peak: 0.42 * k, atk: 0.003, tau: 0.085 });
  burst(env, out, { t, kind: 'pink', f: 380 + 900 * k, q: 0.7, peak: 0.55 * k, atk: 0.003, tau: 0.05 + 0.085 * k });
  if (k > 0.5) burst(env, out, { t, kind: 'white', filter: 'bandpass', f: 1300, q: 0.9, peak: 0.09 * k, atk: 0.003, tau: 0.05, lp: 3000 });
  if (k > 0.4) frottement(env, out, t + 0.03, k * 0.8);
}

/** Arrivée : arpège ascendant en cloches puis accord tenu. */
export function arrivee(env: Env, out: AudioNode, t: number): void {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => cloche(env, out, t + i * 0.11, f, 0.14, 0.14));
  const t2 = t + 0.5;
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => cloche(env, out, t2, f, 0.09, 0.55));
  tone(env, out, { t: t2, f: 261.63, peak: 0.1, atk: 0.01, tau: 0.5, lp: 900 });
}

// ---------- interface ----------

/** Clic de menu : petit « tap » feutré. */
export function clic(env: Env, out: AudioNode, t: number): void {
  tone(env, out, { t, f: 620, f1: 480, glide: 0.03, peak: 0.1, atk: 0.002, tau: 0.012 });
  burst(env, out, { t, kind: 'pink', f: 2200, peak: 0.05, atk: 0.002, tau: 0.006 });
}

/** Tic de la roulette : « tok » de bois doux, sans arête (attaque 1,5 ms, pas de carré). */
export function tic(env: Env, out: AudioNode, t: number, k: number): void {
  const f = tickFreq(k);
  tone(env, out, { t, f, f1: f * 0.8, glide: 0.02, peak: 0.16, atk: 0.0015, tau: 0.009 });
  tone(env, out, { t, f: f * 2.1, peak: 0.03, atk: 0.0015, tau: 0.004 });
  burst(env, out, { t, kind: 'pink', f: 2400, peak: 0.04, atk: 0.0015, tau: 0.004 });
}

/** Ouverture de la caisse : coup sourd + souffle montant. */
export function ouverture(env: Env, out: AudioNode, t: number): void {
  tone(env, out, { t, f: 130, f1: 50, glide: 0.25, peak: 0.34, atk: 0.004, tau: 0.09 });
  burst(env, out, { t, kind: 'pink', filter: 'bandpass', f: 300, f1: 2200, sweep: 0.45, q: 0.8, peak: 0.1, atk: 0.16, tau: 0.09, lp: 3500 });
}

const ETINCELLES = [2637, 3136, 2349, 3520, 2794, 2960, 3322, 2489, 3136];

/** Révélation : plus la rareté est haute, plus la fanfare est ample, longue et scintillante. */
export function revelation(env: Env, out: AudioNode, t: number, r: Rarete): void {
  const p = revealParams(r);
  p.notes.forEach((f, i) => cloche(env, out, t + i * p.ecart, f, 0.13 * p.niveau, p.tau * 0.5));
  const fin = t + p.notes.length * p.ecart;
  // accord tenu sur les trois dernières notes
  p.notes.slice(-3).forEach((f) => cloche(env, out, fin, f, 0.08 * p.niveau, p.tau));
  if (p.choc) tone(env, out, { t: fin - p.ecart, f: 96, f1: 48, glide: 0.3, peak: 0.26, atk: 0.005, tau: 0.12 });
  if (p.houle) {
    for (const d of [-7, 7]) tone(env, out, { t: fin - p.ecart, f: p.notes[0] / 2, type: 'sawtooth', detune: d, peak: 0.035, atk: 0.35, tau: p.tau, lp: 1100 });
  }
  for (let i = 0; i < p.etincelles; i++) {
    tone(env, out, { t: fin + 0.05 + i * 0.07, f: ETINCELLES[i % ETINCELLES.length], peak: 0.028, atk: 0.003, tau: 0.05 + 0.01 * (i % 3) });
  }
}

/** Décharge du turbo (« pschh ») quand on relâche les gaz à haut régime. `k` 0..1 selon la pression. */
export function soufflage(env: Env, out: AudioNode, t: number, k: number): void {
  burst(env, out, { t, kind: 'white', filter: 'bandpass', f: 4200, f1: 2000, sweep: 0.4, q: 0.7, peak: 0.06 * (0.4 + 0.6 * k), atk: 0.02, tau: 0.09, lp: 5500 });
}
