import * as THREE from 'three';
import { RaceSim, type RaceEvent, type RaceResult } from '../core/race/race';
import { CARS } from '../core/physics/cars';
import { MODES } from '../core/physics/assists';
import { skinChoisie } from '../core/skins';
import type { AssistParams, CarId, CarParams, CarState } from '../core/physics/types';
import type { CarPose } from '../render/carView';
import type { Assets } from '../render/assets';
import { World } from '../render/world';
import { CAMERA_LOIN, CAMERA_PROCHE, type ChaseConfig } from '../render/camera';
import { NOMS_VUES, vueSuivante } from '../render/vuesEmbarquees';
import type { QualityManager } from '../render/quality';
import type { AudioEngine } from '../audio/audio';
import type { InputManager } from '../input/manager';
import { vibrationChoc, vibrationDrift, vibrationHorsPiste } from '../input/gamepad';
import type { Reglages } from '../storage/store';
import { FixedStepLoop } from './loop';
import { interpolatePose } from './pose';
import type { Hud } from './hud';
import type { PreparedLevel } from './prepare';
import { camDepuisUrl, type CamLibre } from '../debug/camLibre';
import { Enregistreur, quantifier } from '../core/replay/replay';
import type { ScenePhoto } from './photo';
import type { CompteurPilote } from './statistiques';
import { tournerFilm, postesBordDeRoute, planBordDeRoute, planHelico, type CameraFilm, type Film } from './film';
import { estEmbarquee } from '../render/vuesEmbarquees';
import { wrapAngle } from '../core/math/vec';
import { SIM_DT } from '../core/constants';

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
  /** statistiques du pilote (distance, glisse, drifts…) */
  stats?: CompteurPilote | null;
}

export interface SessionCallbacks {
  onFinish(r: RaceResult): void;
  onPause(): void;
}

interface LectureFilm extends Film {
  /** position dans le film, en pas de simulation (fractionnaire) */
  t: number;
  vitesse: number;
  pause: boolean;
  camera: CameraFilm;
  /** mode photo ouvert : le film ne se redessine pas */
  photo: boolean;
  postes: { s: number; pos: [number, number, number] }[];
  /** cap lissé de l'hélicoptère */
  cap: number;
  /** temps écoulé dans le film (s), pour le mouvement de l'hélicoptère */
  temps: number;
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
  /** « Revoir sa course » en cours (null : course normale) */
  private film: LectureFilm | null = null;
  /** fantôme du record : une image par pas depuis le départ (décompte compris) */
  private fantome: Film | null = null;
  /** pas de simulation joués depuis le départ */
  private pas = 0;

  constructor(private readonly level: PreparedLevel, private readonly deps: SessionDeps, private readonly cb: SessionCallbacks) {
    this.world = new World({
      renderer: deps.renderer, level: level.level, track: level.track, terrain: level.terrain, env: level.env,
      assets: deps.assets, carId: deps.reglages.voiture, color: deps.reglages.couleur, skin: skinChoisie(deps.reglages.skins, deps.reglages.voiture), fumee: deps.reglages.fumee, quality: deps.quality.level,
    });
    this.race = this.newRace();
    this.loop = new FixedStepLoop(() => this.simStep());
    this.camCfg = deps.reglages.camera === 'loin' ? CAMERA_LOIN : CAMERA_PROCHE;
    this.world.vue = deps.reglages.camera;
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
    this.deps.audio.setDecor(this.level.level.environnement);
    this.deps.audio.startEngine(this.deps.reglages.voiture);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.25, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.film) { this.imageFilm(dt); return; }
    if (this.paused) return;

    const a = this.deps.input.consumeActions();
    if (a.recommencer) { this.restart(); return; }
    if (a.pause && this.race.phase !== 'arrivee') { this.cb.onPause(); return; }
    if (a.camera) {
      const vue = (this.deps.reglages.camera = vueSuivante(this.deps.reglages.camera));
      this.camCfg = vue === 'loin' ? CAMERA_LOIN : CAMERA_PROCHE;
      this.world.vue = vue;
      this.deps.hud.annonce(`Caméra : ${NOMS_VUES[vue]}`);
    }
    if (a.muet) this.deps.reglages.muet = this.deps.audio.toggleMute();
    if (a.pleinEcran) toggleFullscreen();
    if (a.replacer) this.pendingReplace = true;

    const alpha = this.loop.advance(dt);
    const car = this.race.car;
    const pose = interpolatePose(this.race.prevCar, car, alpha, this.level.terrain);
    this.world.placerFantome(this.poseFantome(alpha));
    this.world.update(pose, car, dt, this.camCfg);
    this.world.render();
    this.deps.hud.update(this.race.hud());
    this.deps.audio.updateEngine(car.rpm, car.throttle, car.rearSlip, car.speed, { gear: car.gear, onRoad: this.race.onRoad });
    if (this.race.phase === 'course' && !this.race.onRoad) this.deps.input.gamepad?.vibrer(vibrationHorsPiste(car.speed), now);
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
    this.pas++;
    if (this.pendingReplace) this.deps.stats?.couper();
    this.pendingReplace = false;
    if (this.race.phase === 'course') this.deps.stats?.pas(this.deps.reglages.voiture, this.race.car.speed, this.race.car.beta, false, SIM_DT);
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
        this.deps.input.gamepad?.vibrer(vibrationDrift(e.multiplier), performance.now());
        this.deps.hud.flash('bank', e.points);
        this.deps.stats?.drift(e.points);
        break;
      case 'lose':
        this.deps.audio.playLose();
        this.deps.hud.flash('lose', e.points);
        break;
      case 'choc':
        this.deps.audio.playCrash(e.impact);
        this.world.shake(e.impact);
        this.deps.input.gamepad?.vibrer(vibrationChoc(e.impact), performance.now());
        break;
      case 'replace':
        this.world.resetCamera(this.race.car);
        break;
      case 'arrivee':
        this.deps.audio.playFinish();
        this.deps.stats?.courseFinie();
        this.finishDelay = 1.5;
        break;
    }
  }

  /** Replay de la course terminée (null avant l'arrivée). */
  replay(): Uint8Array | null {
    return this.race.result ? this.enregistreur.octetsReplay() : null;
  }

  /** Mode photo (pendant la pause) : caméra posée à la main et image redessinée aussitôt ; null = caméra de poursuite. */
  rendrePhoto(cam: CamLibre | null): void {
    if (this.film && !cam) {
      // retour au film (fin du mode photo) : son image, avec sa caméra
      const f = this.film, photo = f.photo;
      f.photo = false;
      this.imageFilm(0);
      f.photo = photo;
      return;
    }
    this.world.camPhoto = cam;
    const car = this.voitureAffichee();
    this.world.update(interpolatePose(car, car, 1, this.level.terrain), car, 0, this.camCfg);
    this.world.render();
  }

  /** Voiture à l'écran : celle du film pendant « Revoir », sinon celle de la course. */
  private voitureAffichee(): CarState {
    return this.film ? this.film.images[Math.min(this.film.images.length - 1, Math.floor(this.film.t))].car : this.race.car;
  }

  scenePhoto(): ScenePhoto {
    const c = this.voitureAffichee(), p = this.world.camera.position;
    return { voiture: { x: c.x, y: c.y, z: c.z }, camera: { x: p.x, y: p.y, z: p.z }, sol: (x, z) => this.level.terrain.heightAt(x, z) };
  }

  /** vrai pendant la pause et sur l'écran des résultats */
  get enPause(): boolean {
    return this.paused;
  }

  pause(): void {
    this.paused = true;
    this.deps.audio.stopEngine();
    this.deps.input.gamepad?.arreterVibrations();
  }

  resume(): void {
    this.paused = false;
    this.loop.reset();
    this.deps.input.reset();
    this.deps.audio.startEngine(this.deps.reglages.voiture);
    this.last = performance.now();
  }

  // --- Fantôme du record ---------------------------------------------------------------------------------

  /** Rejoue le record (replay) en voiture translucide ; false s'il ne mène plus à l'arrivée (jeu modifié depuis). */
  installerFantome(voiture: CarId, replay: Uint8Array): boolean {
    const f = tournerFilm(this.level, voiture, this.deps.reglages.mode, replay, { depuisDebut: true });
    if (!f) return false;
    this.fantome = f;
    this.world.ajouterFantome(voiture);
    return true;
  }

  /** Pose du fantôme au même instant de course que le joueur (null : pas de fantôme, ou il a fini). */
  private poseFantome(alpha: number): CarPose | null {
    const f = this.fantome;
    const i = this.pas - 1;
    if (!f || i < 0 || i >= f.images.length) return null;
    return interpolatePose(f.images[Math.max(0, i - 1)].car, f.images[i].car, alpha, this.level.terrain);
  }

  // --- Revoir sa course ------------------------------------------------------------------------------------

  /**
   * Rejoue la course terminée (depuis son replay) et la passe comme un film. Renvoie false si elle ne peut pas
   * être rejouée. La course reste en pause ; `arreterFilm` revient à l'écran des résultats.
   */
  lancerFilm(): boolean {
    const replay = this.replay();
    if (!replay) return false;
    const film = tournerFilm(this.level, this.deps.reglages.voiture, this.deps.reglages.mode, replay);
    if (!film) return false;
    this.world.placerFantome(null);
    this.film = { ...film, t: 0, vitesse: 1, pause: false, camera: 'tele', photo: false, postes: postesBordDeRoute(this.level.track, (x, z) => this.level.terrain.heightAt(x, z)), cap: film.images[0].car.heading, temps: 0 };
    this.world.resetEffects();
    this.world.resetCamera(film.images[0].car);
    this.deps.hud.reset();
    this.deps.hud.show(true);
    this.deps.audio.startEngine(this.deps.reglages.voiture);
    this.last = performance.now();
    return true;
  }

  arreterFilm(): void {
    if (!this.film) return;
    this.film = null;
    this.world.camPhoto = null;
    this.world.resetEffects();
    this.deps.audio.stopEngine();
    // l'écran de course derrière les résultats : la voiture arrêtée après la ligne
    this.world.update(interpolatePose(this.race.prevCar, this.race.car, 1, this.level.terrain), this.race.car, 0, this.camCfg);
    this.world.render();
    this.deps.hud.update(this.race.hud());
  }

  /** État de la lecture pour les commandes à l'écran. */
  get lecture(): { position: number; duree: number; vitesse: number; pause: boolean; camera: CameraFilm } | null {
    const f = this.film;
    return f && { position: f.t * SIM_DT, duree: f.duree, vitesse: f.vitesse, pause: f.pause, camera: f.camera };
  }

  reglerFilm(o: { pause?: boolean; vitesse?: number; position?: number; camera?: CameraFilm; photo?: boolean }): void {
    const f = this.film;
    if (!f) return;
    if (o.pause !== undefined) {
      f.pause = o.pause;
      // relancer depuis la fin : on repart du début
      if (!o.pause && f.t >= f.images.length - 1) { f.t = 0; this.world.resetEffects(); }
      if (o.pause) this.deps.audio.stopEngine(); else this.deps.audio.startEngine(this.deps.reglages.voiture);
    }
    if (o.vitesse !== undefined) f.vitesse = o.vitesse;
    if (o.position !== undefined) {
      const t = Math.max(0, Math.min(f.images.length - 1, o.position / SIM_DT));
      if (t < f.t) this.world.resetEffects(); // les traces de pneus laissées « plus tard » s'effacent
      f.t = t;
      this.world.resetCamera(f.images[Math.floor(t)].car);
    }
    if (o.camera !== undefined) f.camera = o.camera;
    if (o.photo !== undefined) f.photo = o.photo;
    // en pause, l'image est redessinée tout de suite (déplacement dans le film, changement de caméra)
    if (f.pause && !f.photo) this.imageFilm(0);
  }

  private planFilm(car: CarState, s: number): CamLibre | null {
    const f = this.film;
    if (!f) return null;
    if (f.camera === 'tele') return planBordDeRoute(f.postes, car, s);
    if (f.camera === 'helico') return planHelico(car, f.cap, f.temps);
    return null;
  }

  private imageFilm(dt: number): void {
    const f = this.film;
    if (!f || f.photo) return;
    const fin = f.images.length - 1;
    const dtFilm = f.pause ? 0 : dt * f.vitesse;
    if (!f.pause) {
      f.t = Math.min(fin, f.t + dtFilm / SIM_DT);
      if (f.t >= fin) { f.pause = true; this.deps.audio.stopEngine(); }
    }
    f.temps += dtFilm;
    const i = Math.floor(f.t), a = f.t - i;
    const prev = f.images[i], cur = f.images[Math.min(fin, i + 1)];
    const car = cur.car;
    // cap de l'hélicoptère lissé (les drifts ne le font pas tourner d'un coup)
    const cible = car.speed > 2 ? Math.atan2(car.vx, car.vz) : car.heading;
    f.cap += wrapAngle(cible - f.cap) * (1 - Math.exp(-1.5 * dtFilm));
    const pose = interpolatePose(prev.car, car, a, this.level.terrain);
    this.world.camPhoto = this.planFilm({ ...car, x: pose.x, y: pose.y, z: pose.z }, prev.s + (cur.s - prev.s) * a);
    const vue = this.world.vue;
    if (f.camera === 'poursuite') this.world.vue = 'proche';
    else if (f.camera === 'embarquee' && !estEmbarquee(vue)) this.world.vue = 'capot';
    this.world.update(pose, car, dtFilm, this.camCfg);
    this.world.vue = vue;
    this.world.render();
    this.deps.hud.update(prev.hud);
    if (!f.pause) this.deps.audio.updateEngine(car.rpm, car.throttle, car.rearSlip, car.speed, { gear: car.gear, onRoad: true });
  }

  restart(): void {
    this.film = null;
    this.pas = 0;
    this.world.camPhoto = null;
    this.race = this.newRace();
    this.enregistreur = new Enregistreur();
    this.finishDelay = -1;
    this.pendingReplace = false;
    this.deps.stats?.couper();
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
