/**
 * Harnais de prévisualisation audio (exécuté dans Chromium, voir render.mjs) : rend des scénarios de jeu dans un
 * OfflineAudioContext avec le VRAI AudioEngine (ou l'ancien, pour comparer) et renvoie les échantillons.
 * Les régimes viennent de la vraie physique (stepCar), pas d'une courbe inventée.
 */
import { SIM_DT } from '../../src/core/constants';
import { createCarState, stepCar } from '../../src/core/physics/car';
import { CARS } from '../../src/core/physics/cars';
import { MODES } from '../../src/core/physics/assists';
import type { CarId } from '../../src/core/physics/types';
import type { InputState } from '../../src/core/input';
import type { Ground } from '../../src/core/track/terrain';
import type { Rarete } from '../../src/core/raretes';
import { createBus, createEnv } from '../../src/audio/bus';
import { AmbianceVoice, EngineVoice, TyreVoice } from '../../src/audio/voices';
import { volumeToGain } from '../../src/audio/params';

export const SR = 44100;

/** Ce que les deux implémentations (ancienne et nouvelle) exposent. */
export interface AudioLike {
  unlock(): void;
  setVolume(v: number): void;
  startEngine(car?: CarId): void;
  stopEngine(): void;
  updateEngine(rpm: number, throttle: number, slip: number, speed: number, extra?: { gear?: number; onRoad?: boolean }): void;
  playBank(m: number): void; playLose(): void; playCrash(i: number): void; playCountdown(n: number): void;
  playTick(k?: number): void; playOuvrirCaisse(): void; playReveal(r: Rarete): void;
  playFinish?(): void; playClick?(): void; playScrape?(k?: number): void;
}

interface Frame { rpm: number; throttle: number; slip: number; speed: number; gear: number; onRoad: boolean }

const plat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };
const inp = (p: Partial<InputState>): InputState => ({ gaz: 0, frein: 0, direction: 0, freinAMain: false, ...p });

/** Trajectoire de la voiture à 60 Hz sous un pilotage donné (physique réelle, mode Arcade). */
function simuler(car: CarId, dur: number, plan: (t: number) => InputState, surRoute: (t: number) => boolean = () => true): Frame[] {
  const st = createCarState(0, 0, 0);
  const ctx = { params: CARS[car], assists: MODES.arcade, ground: plat, onRoad: true };
  const frames: Frame[] = [];
  const pas = Math.round(1 / 60 / SIM_DT);
  for (let i = 0; i * SIM_DT < dur; i++) {
    const t = i * SIM_DT;
    ctx.onRoad = surRoute(t);
    stepCar(st, plan(t), ctx, SIM_DT);
    if (i % pas === 0) { frames.push({ rpm: st.rpm, throttle: st.throttle, slip: st.rearSlip, speed: st.speed, gear: st.gear, onRoad: ctx.onRoad }); }
  }
  return frames;
}

export const SCENARIOS = [
  'moteur-equilibree', 'moteur-legere', 'moteur-turbo', 'moteur-kei', 'moteur-muscle', 'moteur-rotative', 'moteur-break', 'drift', 'evenements', 'caisse',
] as const;
export type Scenario = (typeof SCENARIOS)[number];

/** Pas d'horloge du rendu : multiple du quantum de rendu (128 échantillons) proche de 60 Hz. */
const PAS = Math.round(SR / 60 / 128) * 128 / SR;

interface Plan { dur: number; tick?: (a: AudioLike, t: number) => void; init?: (a: AudioLike) => void; events?: [number, (a: AudioLike) => void][] }

function plan(nom: Scenario): Plan {
  if (nom.startsWith('moteur-')) {
    const car = nom.slice(7) as CarId;
    const dur = 11;
    const fr = simuler(car, dur, (t) => inp({ gaz: t >= 2 && t < 8 ? 1 : 0 }));
    return { dur, init: (a) => a.startEngine(car), tick: (a, t) => { const f = fr[Math.min(fr.length - 1, Math.floor(t * 60))]; a.updateEngine(f.rpm, f.throttle, f.slip, f.speed, { gear: f.gear, onRoad: f.onRoad }); } };
  }
  if (nom === 'drift') {
    const dur = 11;
    // accélération 3 s, coup de volant, drift tenu jusqu'à 7 s, puis ligne droite ; hors piste à partir de 8,5 s
    const fr = simuler('equilibree', dur, (t) => t < 3 ? inp({ gaz: 1 }) : t < 3.6 ? inp({ gaz: 1, direction: 1 }) : t < 7 ? inp({ gaz: 1, direction: 0.3 }) : inp({ gaz: 0.7 }), (t) => t < 8.5);
    return { dur, init: (a) => a.startEngine('equilibree'), tick: (a, t) => { const f = fr[Math.min(fr.length - 1, Math.floor(t * 60))]; a.updateEngine(f.rpm, f.throttle, f.slip, f.speed, { gear: f.gear, onRoad: f.onRoad }); } };
  }
  if (nom === 'evenements') {
    const ev: [number, (a: AudioLike) => void][] = [
      [0.3, (a) => a.playCountdown(3)], [1.3, (a) => a.playCountdown(2)], [2.3, (a) => a.playCountdown(1)], [3.3, (a) => a.playCountdown(0)],
      [5, (a) => a.playBank(1)], [6, (a) => a.playBank(2)], [7, (a) => a.playBank(3)], [8, (a) => a.playBank(4)], [9, (a) => a.playBank(5)],
      [10.3, (a) => a.playLose()],
      [11.5, (a) => a.playCrash(3)], [12.5, (a) => a.playCrash(8)], [13.5, (a) => a.playCrash(18)],
      [15.2, (a) => a.playFinish?.()],
      [17.5, (a) => a.playClick?.()], [18.3, (a) => a.playScrape?.(0.6)],
    ];
    return { dur: 20, events: ev };
  }
  // caisse : ouverture, ticks qui ralentissent (~5 s), puis une révélation par rareté
  const ev: [number, (a: AudioLike) => void][] = [[0.2, (a) => a.playOuvrirCaisse()]];
  let t = 0.6, i = 0;
  while (t < 5.6) {
    const k = ((i * 0.37) % 1);
    ev.push([t, (a) => a.playTick(k)]);
    const p = (t - 0.6) / 5; // easeOut : intervalle de 30 ms à 450 ms
    t += 0.03 + 0.42 * p * p;
    i++;
  }
  (['commune', 'rare', 'epique', 'legendaire', 'exotique'] as Rarete[]).forEach((r, j) => ev.push([7 + j * 4, (a) => a.playReveal(r)]));
  return { dur: 7 + 5 * 4 - 0.5, events: ev };
}

/** Rend un scénario avec l'implémentation `make` ; `volume` = curseur du jeu (1 = pire cas pour les crêtes). */
export async function rendre(nom: Scenario, make: (ctx: OfflineAudioContext) => AudioLike, volume = 1): Promise<Float32Array> {
  const p = plan(nom);
  const ctx = new OfflineAudioContext(1, Math.ceil(p.dur * SR), SR);
  const a = make(ctx);
  a.unlock();
  // moteur physique : le module AudioWorklet se charge avant le début du rendu
  await (a as { physiquePret?: Promise<boolean> }).physiquePret;
  a.setVolume(volume);
  p.init?.(a);
  const evts = [...(p.events ?? [])].sort((x, y) => x[0] - y[0]);
  let e = 0;
  const jusqua = (t: number): void => {
    while (e < evts.length && evts[e][0] <= t + 1e-9) { evts[e][1](a); e++; }
  };
  const tick = (t: number): void => { jusqua(t); p.tick?.(a, t); };
  tick(0);
  let n = 1;
  const suivant = (): void => {
    const t = n * PAS;
    if (t >= p.dur - PAS) return;
    void ctx.suspend(t).then(() => { tick(ctx.currentTime); n++; suivant(); void ctx.resume(); });
  };
  suivant();
  const buf = await ctx.startRendering();
  return buf.getChannelData(0).slice();
}

export const VOIX_SEULES = ['voix-moteur', 'voix-pneus', 'voix-surface', 'voix-vent'] as const;

/** Chaque voix continue seule, à niveau nominal, pour comparer les niveaux relatifs du mixage (volume du jeu à 1). */
export async function rendreVoix(nom: (typeof VOIX_SEULES)[number]): Promise<Float32Array> {
  const dur = 4;
  const ctx = new OfflineAudioContext(1, dur * SR, SR);
  const bus = createBus(ctx), env = createEnv(ctx);
  bus.volume.gain.value = volumeToGain(1);
  const moteur = nom === 'voix-moteur' ? new EngineVoice(env, bus.drive, 'equilibree') : null;
  const pneus = nom === 'voix-pneus' ? new TyreVoice(env, bus.drive) : null;
  const amb = nom === 'voix-surface' || nom === 'voix-vent' ? new AmbianceVoice(env, bus.drive) : null;
  const tick = (t: number): void => {
    moteur?.update(t, PAS, 4500, 1, 2);
    pneus?.update(t, PAS, 1, 20);
    amb?.update(t, PAS, nom === 'voix-vent', nom === 'voix-vent' ? 55 : 20);
  };
  tick(0);
  let n = 1;
  const suivant = (): void => {
    const t = n * PAS;
    if (t >= dur - PAS) return;
    void ctx.suspend(t).then(() => { tick(ctx.currentTime); n++; suivant(); void ctx.resume(); });
  };
  suivant();
  return (await ctx.startRendering()).getChannelData(0).slice();
}
