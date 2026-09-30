import { SIM_DT } from '../constants';
import type { InputState } from '../input';
import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import type { Terrain } from '../track/terrain';
import { projectOnTrack, nearestSample } from '../track/projection';
import type { Environment } from '../env/types';
import type { AssistParams, CarParams, CarState, StepContext } from '../physics/types';
import { createCarState, copyCarState, stepCar } from '../physics/car';
import { buildCollisionWorld, resolveCollisions, CRASH_IMPACT, type CollisionWorld } from '../physics/collision';
import {
  createScore, stepScore, finishScore, timeBonus, comboRestant, facteursDrift, DEFAULT_SCORE_PARAMS,
  type ScoreEvent, type ScoreParams, type ScoreState,
} from '../scoring/score';
import { clamp, DEG } from '../math/vec';

export type RacePhase = 'compte' | 'course' | 'arrivee';

export interface RaceConfig {
  level: Level;
  track: TrackData;
  terrain: Terrain;
  env: Environment;
  car: CarParams;
  assists: AssistParams;
  scoreParams?: ScoreParams;
  countdown?: number;
}

export interface RaceResult {
  score: number;
  driftPoints: number;
  bonus: number;
  time: number;
  bestDrift: number;
  targetTime: number;
}

export type RaceEvent =
  | { type: 'decompte'; n: number }
  | ScoreEvent
  | { type: 'choc'; impact: number }
  | { type: 'replace'; auto: boolean }
  | { type: 'arrivee'; result: RaceResult };

export interface HudData {
  phase: RacePhase;
  countdown: number;
  time: number;
  score: number;
  drift: number;
  multiplier: number;
  driftActive: boolean;
  /** fraction du temps restant avant la fin du combo (null : pas de compte à rebours) */
  combo: number | null;
  /** décomposition exacte des points du drift en cours (null hors drift) : base × km/h moyens × secondes × facteur d'angle moyen × combo */
  glisse: { base: number; kmh: number; secondes: number; angle: number; combo: number } | null;
  /** angle de dérive signé (degrés), pour l'indicateur sous la voiture */
  angle: number;
  progress: number;
  wrongWay: boolean;
  speedKmh: number;
}

export const ZONE_LIMIT = 35;
export const FROZEN_LIMIT = 5;
const COAST: InputState = { gaz: 0, frein: 0.3, direction: 0, freinAMain: false };

export class RaceSim {
  readonly car: CarState;
  readonly prevCar: CarState;
  phase: RacePhase = 'compte';
  countdown: number;
  time = 0;
  readonly score: ScoreState = createScore();
  progressIndex: number;
  progressS: number;
  maxProgressS: number;
  onRoad = true;
  wrongWay = false;
  result: RaceResult | null = null;
  readonly config: RaceConfig;

  private wrongWayTime = 0;
  private frozenTime = 0;
  private readonly world: CollisionWorld;
  private readonly ctx: StepContext;
  private readonly sp: ScoreParams;
  private pending: RaceEvent[] = [];

  constructor(cfg: RaceConfig) {
    this.config = cfg;
    this.sp = cfg.scoreParams ?? DEFAULT_SCORE_PARAMS;
    this.countdown = cfg.countdown ?? 3;
    this.world = buildCollisionWorld(cfg.env);
    this.ctx = { params: cfg.car, assists: cfg.assists, ground: cfg.terrain, onRoad: true };
    const idx = Math.min(6, cfg.track.samples.length - 1);
    const s0 = cfg.track.samples[idx];
    this.car = createCarState(s0.x, s0.z, Math.atan2(s0.tx, s0.tz), cfg.terrain.heightAt(s0.x, s0.z));
    this.prevCar = copyCarState(this.car);
    this.progressIndex = idx;
    this.progressS = s0.s;
    this.maxProgressS = s0.s;
    if (this.countdown > 0) this.pending.push({ type: 'decompte', n: Math.ceil(this.countdown) });
    else this.phase = 'course';
  }

  step(input: InputState, replacer = false): RaceEvent[] {
    const ev = this.pending;
    this.pending = [];
    copyCarState(this.car, this.prevCar);

    if (this.phase === 'compte') {
      const before = Math.ceil(this.countdown - 1e-9);
      this.countdown = Math.max(0, this.countdown - SIM_DT);
      const after = Math.max(0, Math.ceil(this.countdown - 1e-9));
      if (after < before) ev.push({ type: 'decompte', n: after });
      if (this.countdown <= 0) this.phase = 'course';
      this.car.rpm = 900 + clamp(input.gaz, 0, 1) * 5200;
      return ev;
    }

    if (this.phase === 'arrivee') {
      this.ctx.onRoad = this.onRoad;
      stepCar(this.car, COAST, this.ctx, SIM_DT);
      resolveCollisions(this.car, this.config.car, this.world);
      return ev;
    }

    // Course
    this.time += SIM_DT;
    const track = this.config.track;
    this.ctx.onRoad = this.onRoad;
    stepCar(this.car, input, this.ctx, SIM_DT);
    const impact = resolveCollisions(this.car, this.config.car, this.world);
    const crash = impact > CRASH_IMPACT;
    if (crash) ev.push({ type: 'choc', impact });

    // Progression (fenêtre autour de la dernière position : anti-raccourci)
    const proj = projectOnTrack(track, this.car.x, this.car.z, this.progressIndex);
    const sp = track.samples[proj.index];
    const lat = Math.abs(proj.lateral);
    this.onRoad = lat <= sp.w;
    let progressRate = 0;
    if (lat <= sp.w + 25) {
      const prevS = this.progressS;
      this.progressIndex = proj.index;
      this.progressS = proj.s;
      progressRate = (this.progressS - prevS) / SIM_DT;
      if (this.progressS > this.maxProgressS) this.maxProgressS = this.progressS;
      this.frozenTime = 0;
    } else {
      this.frozenTime += SIM_DT;
    }

    // Mauvais sens
    if (progressRate < -1) this.wrongWayTime += SIM_DT;
    else this.wrongWayTime = Math.max(0, this.wrongWayTime - 2 * SIM_DT);
    this.wrongWay = this.wrongWayTime > 2;

    // Replacement manuel ou automatique
    let auto = this.frozenTime > FROZEN_LIMIT;
    if (!auto && lat > 30) {
      const near = nearestSample(track, this.car.x, this.car.z);
      if (!near || near.dist > ZONE_LIMIT) auto = true;
    }
    // la voiture ne roule pas dans l'eau : elle est replacée dès qu'elle y entre
    if (!auto && this.config.terrain.distanceEau(this.car.x, this.car.z) > 0.5) auto = true;
    let reset = false;
    if (replacer || auto) {
      this.respawn();
      reset = true;
      ev.push({ type: 'replace', auto: !replacer });
    }

    // Score
    const se = stepScore(
      this.score,
      { betaRad: this.car.beta, speed: this.car.speed, onRoad: this.onRoad, progressRate, crash, reset },
      SIM_DT,
      this.sp,
    );
    if (se) ev.push(se);

    // Arrivée
    if (this.maxProgressS >= track.length - 1.5 && this.onRoad) this.finish(ev);
    return ev;
  }

  hud(): HudData {
    return {
      phase: this.phase,
      countdown: this.countdown,
      time: this.time,
      score: this.score.total,
      drift: this.score.drift * this.score.multiplier,
      multiplier: this.score.multiplier,
      driftActive: this.score.active,
      combo: comboRestant(this.score, this.sp),
      glisse: this.score.active || this.score.pending ? facteursDrift(this.score, this.sp) : null,
      angle: this.car.speed > 1 ? this.car.beta / DEG : 0,
      progress: clamp(this.maxProgressS / this.config.track.length, 0, 1),
      wrongWay: this.wrongWay,
      speedKmh: this.car.speed * 3.6,
    };
  }

  private respawn(): void {
    const track = this.config.track;
    const s = Math.max(0, this.maxProgressS - 5);
    const idx = Math.min(track.samples.length - 1, Math.round(s));
    const sp = track.samples[idx];
    const fresh = createCarState(sp.x, sp.z, Math.atan2(sp.tx, sp.tz), this.config.terrain.heightAt(sp.x, sp.z));
    fresh.wheelSpin = this.car.wheelSpin;
    Object.assign(this.car, fresh);
    copyCarState(this.car, this.prevCar);
    this.progressIndex = idx;
    this.progressS = sp.s;
    this.wrongWayTime = 0;
    this.frozenTime = 0;
    this.onRoad = true;
  }

  private finish(ev: RaceEvent[]): void {
    const fe = finishScore(this.score, this.sp);
    if (fe) ev.push(fe);
    const driftPoints = Math.round(this.score.total);
    const bonus = Math.round(timeBonus(this.config.track.targetTime, this.time, this.sp));
    this.result = {
      score: driftPoints + bonus,
      driftPoints,
      bonus,
      time: this.time,
      bestDrift: Math.round(this.score.bestDrift),
      targetTime: this.config.track.targetTime,
    };
    this.phase = 'arrivee';
    ev.push({ type: 'arrivee', result: this.result });
  }
}
