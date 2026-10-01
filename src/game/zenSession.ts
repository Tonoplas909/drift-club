import { CARS } from '../core/physics/cars';
import { MODES } from '../core/physics/assists';
import { skinChoisie } from '../core/skins';
import { THEMES } from '../core/env/themes';
import { RouteZen } from '../core/zen/route';
import { ZenSim, type EvenementZen } from '../core/zen/zenSim';
import { ZenWorld } from '../render/zenWorld';
import { CAMERA_LOIN, CAMERA_PROCHE, type ChaseConfig } from '../render/camera';
import { camDepuisUrl, type CamLibre } from '../debug/camLibre';
import { FixedStepLoop } from './loop';
import type { InputState } from '../core/input';
import { clamp, wrapAngle } from '../core/math/vec';
import { interpolatePose } from './pose';
import { toggleFullscreen, type SessionDeps } from './session';

export interface ZenCallbacks {
  onPause(): void;
}

/** Temps (ms) accordé à chaque image pour construire la route à venir (tronçons, décor, terrain). */
const BUDGET_TRAVAIL = 4;

/** Nouvelle graine de route (hors du cœur : le hasard du navigateur est permis ici). */
export function nouvelleGraine(): number {
  return Math.floor(Math.random() * 2147483647);
}

/**
 * Balade Zen : route infinie, pas de score ni de chrono. La route, le décor et le terrain se construisent au fil de
 * l'eau, par petites unités, dans le temps libre de chaque image.
 */
export class ZenSession {
  private route!: RouteZen;
  private world!: ZenWorld;
  private sim!: ZenSim;
  private readonly loop: FixedStepLoop;
  private raf = 0;
  private last = 0;
  private paused = false;
  private disposed = false;
  private pendingReplace = false;
  private camCfg: ChaseConfig;
  private image = 0;
  /** mesures (développement) : durée des unités de travail de la route (ms) */
  readonly mesures = { coeur: [] as number[], image: [] as number[] };

  constructor(private seed: number, private readonly deps: SessionDeps, private readonly cb: ZenCallbacks) {
    this.loop = new FixedStepLoop(() => this.simStep());
    this.camCfg = deps.reglages.cameraLoin ? CAMERA_LOIN : CAMERA_PROCHE;
    this.construire();
    deps.debug?.attach(CARS[deps.reglages.voiture], MODES[deps.reglages.mode], this.camCfg);
    if (deps.debug) this.exposerDebug();
    window.addEventListener('resize', this.onResize);
    this.onResize();
  }

  /** Graine de la route en cours (affichée dans la pause). */
  get graine(): number { return this.seed; }

  /** Route, décor et terrain autour du départ (quelques centaines de ms, derrière l'écran de chargement). */
  private construire(): void {
    const d = this.deps, r = d.reglages;
    this.route = new RouteZen(this.seed);
    this.route.viser(0);
    this.route.toutFaire();
    this.world = new ZenWorld({
      renderer: d.renderer, route: this.route, assets: d.assets, carId: r.voiture, color: r.couleur,
      skin: skinChoisie(r.skins, r.voiture), quality: d.quality.level,
    });
    this.world.troncons.appliquer(this.route.vider());
    this.sim = new ZenSim(this.route, CARS[r.voiture], MODES[r.mode]);
    while (this.world.troncons.travailler(this.sim.car.x, this.sim.car.z)) { /* terrain du départ */ }
  }

  private exposerDebug(): void {
    const cam = camDepuisUrl(location.search);
    if (cam) this.world.camLibre = cam;
    const self = this; // eslint-disable-line @typescript-eslint/no-this-alias
    (window as unknown as { __dc: unknown }).__dc = {
      zen: this,
      get world() { return self.world; },
      get route() { return self.route; },
      get sim() { return self.sim; },
      /** place la voiture à l'abscisse `s` de la route (génère tout ce qu'il faut, d'un coup) */
      teleporter: (s: number) => this.teleporter(s),
      pilote: (v: number) => { this.pilote = v; },
      camera: (c: CamLibre | null) => { this.world.camLibre = c; },
    };
  }

  /** Téléportation (développement) : génère la route jusque-là et construit tout autour, d'un coup. */
  teleporter(s: number): void {
    // en arrière : la route derrière est oubliée, on la refait depuis le début (même graine, même route)
    if (s < this.sim.maxProgressS - 300) {
      this.world.dispose();
      this.construire();
      this.onResize();
    }
    this.route.viser(s);
    this.route.toutFaire();
    this.world.troncons.appliquer(this.route.vider());
    this.sim.teleporter(s);
    while (this.world.troncons.travailler(this.sim.car.x, this.sim.car.z)) { /* tout le terrain */ }
    this.world.resetCamera(this.sim.car);
    this.world.resetEffects();
  }

  private readonly onResize = (): void => {
    this.world.resize(window.innerWidth, window.innerHeight);
  };

  start(): void {
    this.deps.hud.reset();
    this.deps.hud.zen(true);
    this.deps.hud.show(true);
    this.deps.hud.annonce(THEMES[this.sim.region].nom);
    this.world.resetCamera(this.sim.car);
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
    if (a.pause) { this.cb.onPause(); return; }
    if (a.camera) {
      this.deps.reglages.cameraLoin = !this.deps.reglages.cameraLoin;
      this.camCfg = this.deps.reglages.cameraLoin ? CAMERA_LOIN : CAMERA_PROCHE;
    }
    if (a.muet) this.deps.reglages.muet = this.deps.audio.toggleMute();
    if (a.pleinEcran) toggleFullscreen();
    if (a.replacer) this.pendingReplace = true;

    const alpha = this.loop.advance(dt);
    const car = this.sim.car;
    const pose = interpolatePose(this.sim.prevCar, car, alpha, this.route.sol);
    this.world.update(pose, car, dt, this.camCfg, this.sim.progressS);
    this.world.render();
    this.deps.hud.updateZen(this.sim.hud());
    this.deps.audio.updateEngine(car.rpm, car.throttle, car.rearSlip, car.speed, { gear: car.gear, onRoad: this.sim.onRoad });
    this.deps.debug?.frame(car, dt);
    if (this.deps.quality.sample(dt)) this.world.setQuality(this.deps.quality.level);
    this.travailler();
    this.mesures.image.push(performance.now() - now);
    if (this.mesures.image.length > 300) this.mesures.image.shift();
  };

  /** Construction de la route à venir dans le temps libre de l'image (une grosse unité au plus par image). */
  private travailler(): void {
    const t0 = performance.now();
    const s = this.sim.progressS;
    this.route.viser(s);
    // la zone de la voiture doit être prête (c'est normalement déjà le cas bien avant) : sinon on la termine tout de suite
    while (!this.route.pret(s) && this.route.travailler()) this.world.troncons.appliquer(this.route.vider());
    this.world.troncons.appliquer(this.route.vider());
    const car = this.sim.car;
    let coeur = false;
    // une image sur trois, la route passe avant le terrain (pour ne jamais prendre de retard)
    const routeDabord = this.image++ % 3 === 0;
    while (performance.now() - t0 < BUDGET_TRAVAIL) {
      if (routeDabord && !coeur && this.unite()) { coeur = true; continue; }
      if (this.world.troncons.travailler(car.x, car.z)) continue;
      if (!coeur && this.unite()) { coeur = true; continue; }
      break;
    }
  }

  private unite(): boolean {
    const t0 = performance.now();
    const fait = this.route.travailler();
    if (fait) {
      this.world.troncons.appliquer(this.route.vider());
      this.mesures.coeur.push(performance.now() - t0);
      if (this.mesures.coeur.length > 300) this.mesures.coeur.shift();
    }
    return fait;
  }

  /** pilote automatique (développement, `__dc.pilote(v)`) : suit la route à `v` m/s au plus */
  private pilote = 0;

  private simStep(): void {
    const input = this.pilote > 0 ? this.autopilote() : this.deps.input.state(this.deps.reglages.accelAuto);
    const events = this.sim.step(input, this.pendingReplace);
    this.pendingReplace = false;
    for (const e of events) this.handle(e);
  }

  private autopilote(): InputState {
    const car = this.sim.car, route = this.route, s = this.sim.progressS;
    const cible = route.echantillon(s + 8 + car.speed * 0.5);
    const err = wrapAngle(Math.atan2(cible.x - car.x, cible.z - car.z) - car.heading);
    let kMax = 0;
    for (let d = 0; d < 60; d += 5) kMax = Math.max(kMax, Math.abs(route.echantillon(s + d).k));
    const v = clamp(Math.sqrt(5 / Math.max(kMax, 1e-4)), 8, this.pilote);
    return { gaz: car.speed < v ? 1 : 0, frein: car.speed > v + 3 ? 1 : 0, direction: clamp(err * 2.5, -1, 1), freinAMain: false };
  }

  private handle(e: EvenementZen): void {
    switch (e.type) {
      case 'choc':
        this.deps.audio.playCrash(e.impact);
        this.world.shake(e.impact);
        break;
      case 'replace':
        this.world.resetCamera(this.sim.car);
        break;
      case 'region':
        this.deps.hud.annonce(THEMES[e.theme].nom);
        break;
    }
  }

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

  /** Nouvelle route (nouvelle graine), depuis la pause. */
  restart(seed = nouvelleGraine()): void {
    this.seed = seed;
    this.world.dispose();
    this.construire();
    this.onResize();
    if (this.deps.debug) this.exposerDebug();
    this.pendingReplace = false;
    this.deps.hud.reset();
    this.deps.hud.zen(true);
    this.world.resetCamera(this.sim.car);
    this.deps.hud.annonce(THEMES[this.sim.region].nom);
    this.resume();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.deps.audio.stopEngine();
    this.deps.hud.zen(false);
    this.deps.hud.show(false);
    this.world.dispose();
  }
}
