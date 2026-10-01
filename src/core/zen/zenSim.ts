import { SIM_DT } from '../constants';
import type { InputState } from '../input';
import type { Environnement } from '../level/types';
import type { AssistParams, CarParams, CarState, StepContext } from '../physics/types';
import { createCarState, copyCarState, stepCar } from '../physics/car';
import { resolveCollisions, CRASH_IMPACT } from '../physics/collision';
import { DEG } from '../math/vec';
import { RECUL_MAX, RouteZen, type Troncon } from './route';

/** Données affichées pendant une balade Zen (pas de score ni de chrono). */
export interface HudZen {
  speedKmh: number;
  /** angle de dérive signé (degrés) */
  angle: number;
  wrongWay: boolean;
  /** distance parcourue le long de la route (m) */
  distance: number;
  region: Environnement;
}

export type EvenementZen =
  | { type: 'choc'; impact: number }
  | { type: 'replace'; auto: boolean }
  | { type: 'region'; theme: Environnement };

/** Au-delà de cette distance (m) à l'axe, la voiture est replacée (comme en course). */
export const LIMITE_ZONE = 35;
const GEL_MAX = 5;
/** Départ : quelques mètres après le début de la route. */
export const S_DEPART = 6;

/**
 * Simulation d'une balade Zen : la même physique que la course, sur la route infinie. On suit la progression (pour
 * replacer la voiture et savoir où générer la route), on signale le mauvais sens et les changements de région.
 */
export class ZenSim {
  readonly car: CarState;
  readonly prevCar: CarState;
  progressS: number;
  maxProgressS: number;
  onRoad = true;
  wrongWay = false;
  region: Environnement;

  private progressIndex: number;
  private wrongWayTime = 0;
  private frozenTime = 0;
  private readonly ctx: StepContext;
  private readonly proches: Troncon[] = [];

  constructor(readonly route: RouteZen, car: CarParams, assists: AssistParams, depart = S_DEPART) {
    this.ctx = { params: car, assists, ground: route.sol, onRoad: true };
    const sp = route.echantillon(depart);
    this.car = createCarState(sp.x, sp.z, Math.atan2(sp.tx, sp.tz), route.sol.heightAt(sp.x, sp.z));
    this.prevCar = copyCarState(this.car);
    this.progressIndex = Math.round(depart);
    this.progressS = depart;
    this.maxProgressS = depart;
    this.region = route.regions.dominant(depart);
  }

  step(input: InputState, replacer = false): EvenementZen[] {
    const ev: EvenementZen[] = [];
    copyCarState(this.car, this.prevCar);
    const route = this.route;
    this.ctx.onRoad = this.onRoad;
    stepCar(this.car, input, this.ctx, SIM_DT);
    let impact = 0;
    for (const t of route.finisPres(this.car.x, this.car.z, 45, this.proches)) {
      for (const m of t.mondes) impact = Math.max(impact, resolveCollisions(this.car, this.ctx.params, m));
    }
    if (impact > CRASH_IMPACT) ev.push({ type: 'choc', impact });

    // progression : projection dans une fenêtre autour de la dernière position (anti-raccourci)
    let best = this.progressIndex, bestD2 = Infinity;
    const i0 = Math.max(route.dessinateur.debut, this.progressIndex - 20);
    for (let i = i0; i <= this.progressIndex + 30; i++) {
      const s = route.echantillon(i);
      const d2 = (s.x - this.car.x) ** 2 + (s.z - this.car.z) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = i; }
    }
    const sp = route.echantillon(best);
    const dx = this.car.x - sp.x, dz = this.car.z - sp.z;
    const lat = Math.abs(dx * sp.nx + dz * sp.nz);
    this.onRoad = lat <= sp.w;
    let rate = 0;
    if (lat <= sp.w + 25) {
      const prev = this.progressS;
      this.progressIndex = best;
      this.progressS = Math.max(0, best + dx * sp.tx + dz * sp.tz);
      rate = (this.progressS - prev) / SIM_DT;
      if (this.progressS > this.maxProgressS) this.maxProgressS = this.progressS;
      this.frozenTime = 0;
    } else {
      this.frozenTime += SIM_DT;
    }

    if (rate < -1) this.wrongWayTime += SIM_DT;
    else this.wrongWayTime = Math.max(0, this.wrongWayTime - 2 * SIM_DT);
    this.wrongWay = this.wrongWayTime > 2;

    // trop loin à contresens : la route derrière n'est plus construite, on replace la voiture
    let auto = this.frozenTime > GEL_MAX || this.progressS < this.maxProgressS - RECUL_MAX + 20;
    if (!auto && lat > 30) {
      const near = route.sol.plusProche(this.car.x, this.car.z, 64);
      if (!near || near.dist > LIMITE_ZONE) auto = true;
    }
    if (replacer || auto) {
      this.respawn();
      ev.push({ type: 'replace', auto: !replacer });
    }

    const region = route.regions.dominant(this.maxProgressS);
    if (region !== this.region) {
      this.region = region;
      ev.push({ type: 'region', theme: region });
    }
    return ev;
  }

  hud(): HudZen {
    return {
      speedKmh: this.car.speed * 3.6,
      angle: this.car.speed > 1 ? this.car.beta / DEG : 0,
      wrongWay: this.wrongWay,
      distance: this.maxProgressS - S_DEPART,
      region: this.region,
    };
  }

  /** Place la voiture à l'abscisse `s` (replacement, téléportation de développement). */
  placer(s: number): void {
    const idx = Math.max(this.route.dessinateur.debut, Math.round(s));
    const sp = this.route.echantillon(idx);
    const fresh = createCarState(sp.x, sp.z, Math.atan2(sp.tx, sp.tz), this.route.sol.heightAt(sp.x, sp.z));
    fresh.wheelSpin = this.car.wheelSpin;
    Object.assign(this.car, fresh);
    copyCarState(this.car, this.prevCar);
    this.progressIndex = idx;
    this.progressS = idx;
    this.wrongWayTime = 0;
    this.frozenTime = 0;
    this.onRoad = true;
  }

  /** Téléporte la voiture (développement) : la progression maximale suit. */
  teleporter(s: number): void {
    this.maxProgressS = s;
    this.placer(s);
    this.region = this.route.regions.dominant(s);
  }

  private respawn(): void {
    this.placer(Math.max(0, this.maxProgressS - 5));
  }
}
