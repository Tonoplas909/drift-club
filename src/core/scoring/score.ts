import { DEG } from '../math/vec';

export interface ScoreParams {
  betaMinDeg: number;
  speedMinKmh: number;
  gainPerKmh: number;
  bankDelay: number;
  comboTimeout: number;
  comboMax: number;
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
  /** durée (s) pendant laquelle le drift en cours a marqué des points */
  driftTime: number;
  /** Σ km/h·dt du drift en cours (pour la vitesse moyenne affichée) */
  driftVitesse: number;
  /** Σ facteur d'angle·km/h·dt du drift en cours (pour le facteur d'angle moyen affiché) */
  driftAngle: number;
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
  /** la voiture repasse sur une portion de route déjà parcourue (après un recul) : le drift n'y rapporte rien */
  dejaParcouru?: boolean;
}

export function createScore(): ScoreState {
  return { total: 0, drift: 0, multiplier: 1, active: false, pending: false, inactiveTime: 0, sinceBank: 0, bestDrift: 0, driftCount: 0, driftTime: 0, driftVitesse: 0, driftAngle: 0 };
}

/** Facteur d'angle : 0,5 à 15°, 1 de 25° à 60°, puis baisse progressive (0,7 à 90°, 0,4 à 120°, 0,1 à 150°), 0 à 180°. */
export function angleFactor(betaDeg: number): number {
  const b = Math.abs(betaDeg);
  if (b < 15) return 0;
  if (b <= 25) return 0.5 + (0.5 * (b - 15)) / 10;
  if (b <= 60) return 1;
  if (b <= 150) return 1 - (0.9 * (b - 60)) / 90;
  return Math.max(0, 0.1 * (180 - b) / 30);
}

function bank(st: ScoreState, p: ScoreParams): ScoreEvent | null {
  const raw = st.drift;
  const mult = st.multiplier;
  st.drift = 0;
  st.driftTime = st.driftVitesse = st.driftAngle = 0;
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
  st.driftTime = st.driftVitesse = st.driftAngle = 0;
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
  // seuls un choc ou un replacement font perdre (un tête-à-queue n'est plus sanctionné)
  if (f.crash || f.reset) return lose(st);

  const active = betaDeg > p.betaMinDeg && kmh > p.speedMinKmh;
  st.active = active;
  if (active) {
    st.pending = true;
    st.inactiveTime = 0;
    st.sinceBank = 0;
    if (f.onRoad && !f.dejaParcouru && f.progressRate >= p.progressMin) {
      const fa = angleFactor(betaDeg);
      st.drift += p.gainPerKmh * fa * kmh * dt;
      st.driftTime += dt;
      st.driftVitesse += kmh * dt;
      st.driftAngle += fa * kmh * dt;
    }
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

/**
 * Temps restant avant que le combo retombe à x1, en fraction (1 = juste encaissé, 0 = retombe),
 * ou null quand aucun compte à rebours n'est en cours (pas de combo, drift en cours ou en attente d'encaissement).
 */
export function comboRestant(st: ScoreState, p: ScoreParams = DEFAULT_SCORE_PARAMS): number | null {
  if (st.multiplier <= 1 || st.active || st.pending) return null;
  const fenetre = p.comboTimeout - p.bankDelay;
  if (fenetre <= 0) return null;
  return Math.min(1, Math.max(0, (p.comboTimeout - st.sinceBank) / fenetre));
}

/**
 * Décomposition EXACTE des points du drift en cours : base × vitesse moyenne × durée × facteur d'angle moyen × combo
 * = points affichés. La vitesse est la moyenne dans le temps, le facteur d'angle la moyenne pondérée par la vitesse,
 * ce qui rend le produit égal à la somme accumulée. null tant que le drift n'a rien marqué.
 */
export function facteursDrift(st: ScoreState, p: ScoreParams = DEFAULT_SCORE_PARAMS): { base: number; kmh: number; secondes: number; angle: number; combo: number } | null {
  if (st.driftTime <= 0 || st.driftVitesse <= 0) return null;
  return {
    base: p.gainPerKmh,
    kmh: st.driftVitesse / st.driftTime,
    secondes: st.driftTime,
    angle: st.driftAngle / st.driftVitesse,
    combo: st.multiplier,
  };
}

/** À l'arrivée : encaisse le drift en cours s'il y en a un. */
export function finishScore(st: ScoreState, p: ScoreParams = DEFAULT_SCORE_PARAMS): ScoreEvent | null {
  return st.pending ? bank(st, p) : null;
}

export function timeBonus(targetTime: number, time: number, p: ScoreParams = DEFAULT_SCORE_PARAMS): number {
  return Math.max(0, targetTime - time) * p.timeBonusPerSec;
}
