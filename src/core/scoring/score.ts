import { DEG } from '../math/vec';

export interface ScoreParams {
  betaMinDeg: number;
  speedMinKmh: number;
  gainPerKmh: number;
  bankDelay: number;
  comboTimeout: number;
  comboMax: number;
  spinDeg: number;
  spinSpeedKmh: number;
  progressMin: number;
  timeBonusPerSec: number;
}

/** Valeurs de départ (spec §6), réglables avec ?debug. */
export const DEFAULT_SCORE_PARAMS: ScoreParams = {
  betaMinDeg: 15,
  speedMinKmh: 30,
  gainPerKmh: 10,
  bankDelay: 0.5,
  comboTimeout: 2,
  comboMax: 5,
  spinDeg: 90,
  spinSpeedKmh: 15,
  progressMin: 2,
  timeBonusPerSec: 2000,
};

export interface ScoreState {
  total: number;
  /** points bruts du drift en cours (à multiplier) */
  drift: number;
  multiplier: number;
  active: boolean;
  /** un drift attend d'être encaissé */
  pending: boolean;
  inactiveTime: number;
  sinceBank: number;
  bestDrift: number;
  driftCount: number;
}

export type ScoreEvent = { type: 'bank'; points: number; multiplier: number } | { type: 'lose'; points: number };

export interface ScoreFrame {
  betaRad: number;
  /** m/s */
  speed: number;
  onRoad: boolean;
  /** vitesse de progression le long de la route, m/s */
  progressRate: number;
  crash: boolean;
  reset: boolean;
}

export function createScore(): ScoreState {
  return { total: 0, drift: 0, multiplier: 1, active: false, pending: false, inactiveTime: 0, sinceBank: 0, bestDrift: 0, driftCount: 0 };
}

/** Facteur d'angle : 0,5 à 15°, 1 de 25° à 60°, 0,5 à 90°, 0 au-delà. */
export function angleFactor(betaDeg: number): number {
  const b = Math.abs(betaDeg);
  if (b < 15) return 0;
  if (b <= 25) return 0.5 + (0.5 * (b - 15)) / 10;
  if (b <= 60) return 1;
  if (b <= 90) return 1 - (0.5 * (b - 60)) / 30;
  return 0;
}

function bank(st: ScoreState, p: ScoreParams): ScoreEvent | null {
  const raw = st.drift;
  const mult = st.multiplier;
  st.drift = 0;
  st.pending = false;
  st.inactiveTime = 0;
  st.sinceBank = p.bankDelay;
  if (raw <= 0) return null;
  const points = raw * mult;
  st.total += points;
  st.bestDrift = Math.max(st.bestDrift, points);
  st.driftCount++;
  st.multiplier = Math.min(p.comboMax, mult + 1);
  return { type: 'bank', points, multiplier: mult };
}

function lose(st: ScoreState): ScoreEvent | null {
  const lost = st.drift * st.multiplier;
  const hadCombo = st.multiplier > 1;
  st.drift = 0;
  st.multiplier = 1;
  st.active = false;
  st.pending = false;
  st.inactiveTime = 0;
  st.sinceBank = 0;
  return lost > 0 || hadCombo ? { type: 'lose', points: lost } : null;
}

export function stepScore(st: ScoreState, f: ScoreFrame, dt: number, p: ScoreParams = DEFAULT_SCORE_PARAMS): ScoreEvent | null {
  const betaDeg = Math.abs(f.betaRad) / DEG;
  const kmh = f.speed * 3.6;
  if (f.crash || f.reset || (betaDeg > p.spinDeg && kmh > p.spinSpeedKmh)) return lose(st);

  const active = betaDeg > p.betaMinDeg && kmh > p.speedMinKmh;
  st.active = active;
  if (active) {
    st.pending = true;
    st.inactiveTime = 0;
    st.sinceBank = 0;
    if (f.onRoad && f.progressRate >= p.progressMin) st.drift += p.gainPerKmh * angleFactor(betaDeg) * kmh * dt;
    return null;
  }
  if (st.pending) {
    st.inactiveTime += dt;
    return st.inactiveTime >= p.bankDelay - 1e-9 ? bank(st, p) : null;
  }
  st.sinceBank += dt;
  if (st.sinceBank >= p.comboTimeout - 1e-9 && st.multiplier > 1) st.multiplier = 1;
  return null;
}

/** À l'arrivée : encaisse le drift en cours s'il y en a un. */
export function finishScore(st: ScoreState, p: ScoreParams = DEFAULT_SCORE_PARAMS): ScoreEvent | null {
  return st.pending ? bank(st, p) : null;
}

export function timeBonus(targetTime: number, time: number, p: ScoreParams = DEFAULT_SCORE_PARAMS): number {
  return Math.max(0, targetTime - time) * p.timeBonusPerSec;
}
