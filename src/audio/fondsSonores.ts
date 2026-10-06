/**
 * Fond sonore de chaque décor (vent, oiseaux, vagues, néons, ville, pluie…), en boucle sous le moteur.
 * Tout est synthétisé : nappes de bruit filtré dont le volume ondule lentement, bourdons d'oscillateurs, et petits
 * événements tirés au hasard (cris d'oiseaux, mouettes, klaxons au loin). Le hasard est à graine : un rendu hors ligne
 * (tools/audio-preview) redonne toujours le même son.
 */
import type { Environnement } from '../core/level/types';
import type { Env } from './bus';

/** Ondulation du volume : fréquence (Hz) et profondeur (0..1, part du volume qui ondule). */
export interface Ondulation { freq: number; profondeur: number; forme?: OscillatorType }

/** Nappe de bruit filtré. */
export interface Nappe {
  bruit: 'white' | 'pink' | 'brown';
  filtre: BiquadFilterType;
  freq: number;
  q?: number;
  gain: number;
  ondulations?: Ondulation[];
}

/** Bourdon : un oscillateur (passe-haut facultatif pour ne garder que le grésillement). */
export interface Bourdon { freq: number; forme: OscillatorType; gain: number; passeHaut?: number; ondulations?: Ondulation[] }

export type TypeEvenement = 'oiseau' | 'mouette' | 'klaxon';

/** Événement répété à intervalle aléatoire entre `min` et `max` secondes. */
export interface Evenement { type: TypeEvenement; min: number; max: number; gain: number }

export interface RecetteFond { nappes: Nappe[]; bourdons?: Bourdon[]; evenements?: Evenement[] }

const rafales = (freq: number, profondeur = 0.6): Ondulation[] => [{ freq, profondeur }];

export const FONDS_SONORES: Record<Environnement, RecetteFond> = {
  montagne: {
    nappes: [{ bruit: 'pink', filtre: 'bandpass', freq: 420, q: 0.5, gain: 0.1, ondulations: rafales(0.07) }],
    evenements: [{ type: 'oiseau', min: 2.5, max: 7, gain: 0.03 }],
  },
  neige: {
    nappes: [
      { bruit: 'pink', filtre: 'bandpass', freq: 900, q: 1.2, gain: 0.1, ondulations: rafales(0.05, 0.7) },
      // sifflement du vent glacé
      { bruit: 'white', filtre: 'bandpass', freq: 2400, q: 8, gain: 0.05, ondulations: rafales(0.11, 0.85) },
    ],
  },
  desert: {
    nappes: [
      { bruit: 'pink', filtre: 'bandpass', freq: 300, q: 0.6, gain: 0.09, ondulations: rafales(0.04, 0.5) },
      // sable soulevé
      { bruit: 'white', filtre: 'highpass', freq: 4000, gain: 0.016, ondulations: rafales(0.09, 0.8) },
    ],
  },
  automne: {
    nappes: [
      { bruit: 'pink', filtre: 'bandpass', freq: 500, q: 0.5, gain: 0.08, ondulations: rafales(0.06) },
      // feuilles qui bruissent
      { bruit: 'white', filtre: 'bandpass', freq: 3000, q: 0.8, gain: 0.02, ondulations: [{ freq: 0.06, profondeur: 0.6 }, { freq: 2.3, profondeur: 0.5 }] },
    ],
    evenements: [{ type: 'oiseau', min: 4, max: 10, gain: 0.022 }],
  },
  ville: {
    nappes: [{ bruit: 'brown', filtre: 'lowpass', freq: 220, gain: 0.042, ondulations: rafales(0.03, 0.3) }],
    evenements: [{ type: 'klaxon', min: 9, max: 22, gain: 0.012 }],
  },
  pirate: {
    nappes: [
      // vagues : la houle et l'écume montent et descendent ensemble
      { bruit: 'brown', filtre: 'lowpass', freq: 600, gain: 0.048, ondulations: rafales(0.11, 0.9) },
      { bruit: 'pink', filtre: 'bandpass', freq: 1500, q: 0.5, gain: 0.012, ondulations: rafales(0.11, 1) },
    ],
    evenements: [{ type: 'mouette', min: 6, max: 15, gain: 0.018 }],
  },
  backrooms: {
    nappes: [{ bruit: 'brown', filtre: 'lowpass', freq: 120, gain: 0.011 }],
    // bourdonnement électrique des néons (secteur 50 Hz et harmoniques, grésillement qui vacille)
    bourdons: [
      { freq: 100, forme: 'sine', gain: 0.011 },
      { freq: 200, forme: 'sine', gain: 0.0044 },
      { freq: 100, forme: 'sawtooth', gain: 0.0055, passeHaut: 2500, ondulations: [{ freq: 7.3, profondeur: 0.4, forme: 'square' }] },
    ],
  },
  espace: {
    nappes: [{ bruit: 'brown', filtre: 'lowpass', freq: 150, gain: 0.015, ondulations: rafales(0.03, 0.4) }],
    bourdons: [
      { freq: 55, forme: 'sine', gain: 0.0125, ondulations: rafales(0.05, 0.5) },
      { freq: 82.4, forme: 'sine', gain: 0.0075, ondulations: rafales(0.037, 0.6) },
    ],
  },
  japon: {
    nappes: [
      // cigales : bruit aigu haché très vite, qui enfle et retombe
      { bruit: 'white', filtre: 'bandpass', freq: 4800, q: 3, gain: 0.084, ondulations: [{ freq: 38, profondeur: 0.8, forme: 'square' }, { freq: 0.08, profondeur: 0.7 }] },
      { bruit: 'pink', filtre: 'bandpass', freq: 450, q: 0.5, gain: 0.07, ondulations: rafales(0.06) },
    ],
    evenements: [{ type: 'oiseau', min: 8, max: 16, gain: 0.018 }],
  },
  cyberpunk: {
    nappes: [
      { bruit: 'brown', filtre: 'lowpass', freq: 200, gain: 0.036, ondulations: rafales(0.03, 0.3) },
      // pluie
      { bruit: 'white', filtre: 'bandpass', freq: 5000, q: 0.4, gain: 0.018, ondulations: rafales(0.2, 0.15) },
    ],
    bourdons: [{ freq: 120, forme: 'sawtooth', gain: 0.0024, passeHaut: 3000, ondulations: [{ freq: 11, profondeur: 0.3, forme: 'square' }] }],
    evenements: [{ type: 'klaxon', min: 12, max: 28, gain: 0.008 }],
  },
};

/** Hasard à graine (générateur congruentiel), 0..1. */
export function hasardGraine(graine: number): () => number {
  let s = graine >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Prochain délai d'un événement (s), entre `min` et `max`. */
export function delaiEvenement(e: Evenement, hasard: () => number): number {
  return e.min + (e.max - e.min) * hasard();
}

/** Volume de base et amplitude de l'ondulation : le volume varie de gain × (1 − profondeur) à gain. */
export function ondulationGain(gain: number, profondeur: number): { base: number; amplitude: number } {
  const p = Math.max(0, Math.min(1, profondeur));
  return { base: gain * (1 - p / 2), amplitude: gain * p / 2 };
}

/** Voix du fond sonore d'un décor : fondu d'entrée, événements planifiés à chaque `update`, fondu de sortie. */
export class FondSonore {
  private readonly sortie: GainNode;
  private readonly sources: AudioScheduledSourceNode[] = [];
  private readonly prochains: number[];
  private readonly hasard: () => number;
  private arrete = false;

  constructor(private readonly env: Env, out: AudioNode, private readonly recette: RecetteFond, t: number, fondu = 1.5, graine = 1) {
    const ctx = env.ctx;
    this.hasard = hasardGraine(graine);
    this.sortie = ctx.createGain();
    this.sortie.gain.value = 0;
    this.sortie.gain.setTargetAtTime(1, t, fondu / 3);
    this.sortie.connect(out);

    for (const n of recette.nappes) {
      const s = ctx.createBufferSource();
      s.buffer = env.noise[n.bruit];
      s.loop = true;
      s.start(0, this.hasard() * s.buffer.duration);
      const f = ctx.createBiquadFilter();
      f.type = n.filtre; f.frequency.value = n.freq; f.Q.value = n.q ?? 0.7;
      s.connect(f); f.connect(this.volume(n.gain, n.ondulations));
      this.sources.push(s);
    }
    for (const b of recette.bourdons ?? []) {
      const o = ctx.createOscillator();
      o.type = b.forme; o.frequency.value = b.freq;
      const g = this.volume(b.gain, b.ondulations);
      if (b.passeHaut) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = b.passeHaut;
        o.connect(hp); hp.connect(g);
      } else o.connect(g);
      o.start();
      this.sources.push(o);
    }
    // premier événement après une demi-attente : on n'entend pas un oiseau dès la première seconde à chaque fois
    this.prochains = (recette.evenements ?? []).map((e) => t + delaiEvenement(e, this.hasard) * 0.5 + 1);
  }

  /** Chaîne de gains qui ondule (chaque ondulation module un étage : leurs effets se multiplient), reliée à la sortie. */
  private volume(gain: number, ondulations: Ondulation[] = []): AudioNode {
    const ctx = this.env.ctx;
    const fin = ctx.createGain(); fin.gain.value = gain;
    fin.connect(this.sortie);
    let entree: AudioNode = fin;
    for (const o of ondulations) {
      const { base, amplitude } = ondulationGain(1, o.profondeur);
      const g = ctx.createGain(); g.gain.value = base;
      const lfo = ctx.createOscillator(); lfo.type = o.forme ?? 'sine'; lfo.frequency.value = o.freq;
      const a = ctx.createGain(); a.gain.value = amplitude;
      lfo.connect(a); a.connect(g.gain);
      lfo.start(0);
      this.sources.push(lfo);
      g.connect(entree);
      entree = g;
    }
    return entree;
  }

  /** À chaque image : déclenche les événements dont l'heure est venue. */
  update(t: number): void {
    if (this.arrete) return;
    const ev = this.recette.evenements ?? [];
    for (let i = 0; i < ev.length; i++) {
      if (t < this.prochains[i]) continue;
      // retard (onglet en arrière-plan…) : on ne rattrape pas les événements manqués
      this.prochains[i] = Math.max(this.prochains[i], t - 0.1) + delaiEvenement(ev[i], this.hasard);
      this.jouer(ev[i], t + 0.02);
    }
  }

  private jouer(e: Evenement, t: number): void {
    const ctx = this.env.ctx;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (this.hasard() * 2 - 1) * 0.8;
    const sortie: AudioNode = pan ?? this.sortie;
    if (pan) pan.connect(this.sortie);
    const g = e.gain * (0.6 + 0.4 * this.hasard());
    if (e.type === 'oiseau') this.oiseau(sortie, t, g);
    else if (e.type === 'mouette') this.mouette(sortie, t, g);
    else this.klaxon(sortie, t, g);
  }

  /** Quelques gazouillis rapides (sinus qui glisse vers l'aigu). */
  private oiseau(out: AudioNode, t: number, gain: number): void {
    const ctx = this.env.ctx;
    const n = 2 + Math.floor(this.hasard() * 4);
    const base = 2600 + this.hasard() * 1400;
    for (let i = 0; i < n; i++) {
      const t0 = t + i * (0.11 + this.hasard() * 0.08), d = 0.06 + this.hasard() * 0.06;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.85 + this.hasard() * 0.2), t0);
      o.frequency.exponentialRampToValueAtTime(base * (1.3 + this.hasard() * 0.4), t0 + d);
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + d + 0.02);
    }
  }

  /** Cri de mouette : deux ou trois « kia » qui descendent. */
  private mouette(out: AudioNode, t: number, gain: number): void {
    const ctx = this.env.ctx;
    const n = 2 + Math.floor(this.hasard() * 2);
    for (let i = 0; i < n; i++) {
      const t0 = t + i * 0.42, d = 0.34;
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(1500, t0);
      o.frequency.exponentialRampToValueAtTime(950, t0 + d);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(lp); lp.connect(g); g.connect(out);
      o.start(t0); o.stop(t0 + d + 0.02);
    }
  }

  /** Klaxon au loin : deux notes carrées étouffées. */
  private klaxon(out: AudioNode, t: number, gain: number): void {
    const ctx = this.env.ctx;
    const d = 0.25 + this.hasard() * 0.35;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.03);
    g.gain.setValueAtTime(gain, t + d);
    g.gain.linearRampToValueAtTime(0, t + d + 0.08);
    lp.connect(g); g.connect(out);
    for (const f of [392, 494]) {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
      o.connect(lp);
      o.start(t); o.stop(t + d + 0.1);
    }
  }

  /** Fondu de sortie puis arrêt de toutes les sources. */
  stop(t: number, fondu = 0.3): void {
    if (this.arrete) return;
    this.arrete = true;
    this.sortie.gain.cancelScheduledValues(t);
    this.sortie.gain.setTargetAtTime(0, t, fondu / 3);
    for (const s of this.sources) { try { s.stop(t + fondu * 2); } catch { /* déjà arrêtée */ } }
  }
}
