/** Bus de mixage et bruits partagés. Fonctionne sur AudioContext comme sur OfflineAudioContext (rendu de prévisualisation). */
import { fillNoise, softClipCurve, type NoiseKind } from './noise';
import { MAX_SOURCES } from './params';

export interface NoiseSet { white: AudioBuffer; pink: AudioBuffer; brown: AudioBuffer }

export function createNoises(ctx: BaseAudioContext, seconds = 2): NoiseSet {
  const make = (kind: NoiseKind, seed: number): AudioBuffer => {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    buf.copyToChannel(fillNoise(kind, len, seed), 0);
    return buf;
  };
  return { white: make('white', 12345), pink: make('pink', 777), brown: make('brown', 4242) };
}

/**
 * Chaîne maîtresse : (moteur | sfx | ui) → somme → compresseur doux → limiteur → écrêtage doux (plafond −1 dBFS)
 * → pause (fondu onglet caché) → volume → sortie.
 */
export interface Bus {
  /** moteur, pneus, surface, vent */
  drive: GainNode;
  /** chocs, événements de course */
  sfx: GainNode;
  /** menus, caisses, fanfares */
  ui: GainNode;
  pause: GainNode;
  volume: GainNode;
}

export function createBus(ctx: BaseAudioContext, dest: AudioNode = ctx.destination): Bus {
  const sum = ctx.createGain();
  const drive = ctx.createGain(); drive.gain.value = 0.9;
  const sfx = ctx.createGain(); sfx.gain.value = 0.45;
  const ui = ctx.createGain(); ui.gain.value = 0.4;
  drive.connect(sum); sfx.connect(sum); ui.connect(sum);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 14; comp.ratio.value = 2.5; comp.attack.value = 0.012; comp.release.value = 0.25;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -7; limiter.knee.value = 3; limiter.ratio.value = 14; limiter.attack.value = 0.003; limiter.release.value = 0.09;
  const clip = ctx.createWaveShaper();
  clip.curve = softClipCurve(1025);
  clip.oversample = '2x';
  const pause = ctx.createGain();
  const volume = ctx.createGain();
  sum.connect(comp); comp.connect(limiter); limiter.connect(clip); clip.connect(pause); pause.connect(volume); volume.connect(dest);
  return { drive, sfx, ui, pause, volume };
}

/** Contexte de fabrication des voix : bruits partagés + compteur de sources ponctuelles actives (plafonné). */
export interface Env {
  ctx: BaseAudioContext;
  noise: NoiseSet;
  actives: { n: number };
}

export function createEnv(ctx: BaseAudioContext): Env {
  return { ctx, noise: createNoises(ctx), actives: { n: 0 } };
}

export function peutJouer(env: Env, priorite = false): boolean {
  return priorite ? env.actives.n < MAX_SOURCES * 1.5 : env.actives.n < MAX_SOURCES;
}
