import * as THREE from 'three';
import { RaceSim, type RaceEvent, type RaceResult } from '../core/race/race';
import { CARS } from '../core/physics/cars';
import { MODES } from '../core/physics/assists';
import { skinChoisie } from '../core/skins';
import type { AssistParams, CarParams, CarState } from '../core/physics/types';
import type { Assets } from '../render/assets';
import { World } from '../render/world';
import { CAMERA_LOIN, CAMERA_PROCHE, type ChaseConfig } from '../render/camera';
import type { QualityManager } from '../render/quality';
import type { AudioEngine } from '../audio/audio';
import type { InputManager } from '../input/manager';
import type { Reglages } from '../storage/store';
import { FixedStepLoop } from './loop';
import { interpolatePose } from './pose';
import type { Hud } from './hud';
import type { PreparedLevel } from './prepare';
import { camDepuisUrl, type CamLibre } from '../debug/camLibre';
import { Enregistreur, quantifier } from '../core/replay/replay';

export interface DebugHook {
  attach(car: CarParams, assists: AssistParams, cam: ChaseConfig): void;
  frame(car: CarState, dt: number): void;
}

export interface SessionDeps {
  renderer: THREE.WebGLRenderer;
  assets: Assets;
  hud: Hud;
  audio: AudioEngine;
  input: InputManager;
  quality: QualityManager;
  reglages: Reglages;
  debug?: DebugHook | null;
}

export interface SessionCallbacks {
  onFinish(r: RaceResult): void;
  onPause(): void;
}

export function toggleFullscreen(): void {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  else document.exitFullscreen?.().catch(() => {});
}

export class GameSession {
  private race: RaceSim;
  private readonly world: World;
  private readonly loop: FixedStepLoop;
  private raf = 0;
  private last = 0;
  private paused = false;
  private disposed = false;
  private pendingReplace = false;
  private finishDelay = -1;
  private camCfg: ChaseConfig;
  /** commandes de chaque pas de la course en cours (envoyées au serveur pour vérifier le score) */
  private enregistreur = new Enregistreur();

  constructor(private readonly level: PreparedLevel, private readonly deps: SessionDeps, private readonly cb: SessionCallbacks) {
    this.world = new World({
      renderer: deps.renderer, level: level.level, track: level.track, terrain: level.terrain, env: level.env,
      assets: deps.assets, carId: deps.reglages.voiture, color: deps.reglages.couleur, skin: skinChoisie(deps.reglages.skins, deps.reglages.voiture), fumee: deps.reglages.fumee, quality: deps.quality.level,
    });
    this.race = this.newRace();
    this.loop = new FixedStepLoop(() => this.simStep());
    this.camCfg = deps.reglages.cameraLoin ? CAMERA_LOIN : CAMERA_PROCHE;
    deps.debug?.attach(CARS[deps.reglages.voiture], MODES[deps.reglages.mode], this.camCfg);
    if (deps.debug) this.exposerDebug();
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  /** `window.__dc` (sous `?debug` seulement) : inspection et caméra libre pour vérifier le décor à l'œil. */
  private exposerDebug(): void {
    const cam = camDepuisUrl(location.search);
    if (cam) this.world.camLibre = cam;
    const tp = (s: number): void => {
      const { track, terrain } = this.level;
      const sp = track.samples[Math.max(0, Math.min(track.samples.length - 1, Math.round(s)))];
      for (const c of [this.race.car, this.race.prevCar]) {
        c.x = sp.x; c.z = sp.z; c.y = terrain.heightAt(sp.x, sp.z); c.heading = Math.atan2(sp.tx, sp.tz);
        c.vx = c.vz = c.speed = 0;
      }
    };
    (window as unknown as { __dc: unknown }).__dc = {
      world: this.world, level: this.level, teleporter: tp,
      camera: (c: CamLibre | null) => { this.world.camLibre = c; },
    };
  }

  private newRace(): RaceSim {
    const { level, track, terrain, env } = this.level;
    return new RaceSim({ level, track, terrain, env, car: CARS[this.deps.reglages.voiture], assists: MODES[this.deps.reglages.mode] });
  }

  private readonly onResize = (): void => {
    this.world.resize(window.innerWidth, window.innerHeight);
  };

  start(): void {
    this.deps.hud.reset();
    this.deps.hud.show(true);
    this.world.resetCamera(this.race.car);
    this.deps.input.reset();
    this.deps.audio.startEngine(this.deps.reglages.voiture);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) return;

    const a = this.deps.input.consumeActions();
    if (a.recommencer) { this.restart(); return; }
    if (a.pause && this.race.phase !== 'arrivee') { this.cb.onPause(); return; }
    if (a.camera) {
      this.deps.reglages.cameraLoin = !this.deps.reglages.cameraLoin;
      this.camCfg = this.deps.reglages.cameraLoin ? CAMERA_LOIN : CAMERA_PROCHE;
    }
    if (a.muet) this.deps.reglages.muet = this.deps.audio.toggleMute();
    if (a.pleinEcran) toggleFullscreen();
    if (a.replacer) this.pendingReplace = true;

    const alpha = this.loop.advance(dt);
    const car = this.race.car;
    const pose = interpolatePose(this.race.prevCar, car, alpha, this.level.terrain);
    this.world.update(pose, car, dt, this.camCfg);
    this.world.render();
    this.deps.hud.update(this.race.hud());
    this.deps.audio.updateEngine(car.rpm, car.throttle, car.rearSlip, car.speed, { gear: car.gear, onRoad: this.race.onRoad });
    this.deps.debug?.frame(car, dt);
    if (this.race.phase === 'course' && this.deps.quality.sample(dt)) this.world.setQuality(this.deps.quality.level);

    if (this.finishDelay >= 0) {
      this.finishDelay -= dt;
      if (this.finishDelay < 0 && this.race.result) this.cb.onFinish(this.race.result);
    }
  };

  private simStep(): void {
    // commandes quantifiées : la simulation voit exactement ce que le replay contiendra
    const input = quantifier(this.deps.input.state(this.deps.reglages.accelAuto));
    if (this.race.phase !== 'arrivee') this.enregistreur.ajouter(input, this.pendingReplace);
    const events = this.race.step(input, this.pendingReplace);
    this.pendingReplace = false;
    for (const e of events) this.handle(e);
  }

  private handle(e: RaceEvent): void {
    switch (e.type) {
      case 'decompte':
        this.deps.audio.playCountdown(e.n);
        if (e.n === 0) this.deps.hud.go();
        break;
      case 'bank':
        this.deps.audio.playBank(e.multiplier);
        this.deps.hud.flash('bank', e.points);
        break;
      case 'lose':
        this.deps.audio.playLose();
        this.deps.hud.flash('lose', e.points);
        break;
      case 'choc':
        this.deps.audio.playCrash(e.impact);
        this.world.shake(e.impact);
        break;
      case 'replace':
        this.world.resetCamera(this.race.car);
        break;
      case 'arrivee':
        this.deps.audio.playFinish();
        this.finishDelay = 1.5;
        break;
    }
  }

  /** Replay de la course terminée (null avant l'arrivée). */
  replay(): Uint8Array | null {
    return this.race.result ? this.enregistreur.octetsReplay() : null;
  }

  /** vrai pendant la pause et sur l'écran des résultats */
  get enPause(): boolean {
    return this.paused;
  }

  pause(): void {
    this.paused = true;
    this.deps.audio.stopEngine();
  }

  resume(): void {
    this.paused = false;
    this.loop.reset();
    this.deps.input.reset();
    this.deps.audio.startEngine(this.deps.reglages.voiture);
    this.last = performance.now();
  }

  restart(): void {
    this.race = this.newRace();
    this.enregistreur = new Enregistreur();
    this.finishDelay = -1;
    this.pendingReplace = false;
    this.world.resetEffects();
    this.world.resetCamera(this.race.car);
    this.deps.hud.reset();
    this.resume();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.deps.audio.stopEngine();
    this.deps.hud.show(false);
    this.world.dispose();
  }
}
