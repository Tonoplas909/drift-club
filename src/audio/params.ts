/** Maths pures du son (aucun Web Audio) : régimes, enveloppes, lissages, paramètres des sons. Testable sous node. */
import { clamp, smoothstep } from '../core/math/vec';
import type { CarId } from '../core/physics/types';
import type { Rarete } from '../core/raretes';

export const RPM_RALENTI = 900;
export const RPM_MAX = 7500;
/** Au-delà, le coupe-allumage « rebondit ». */
export const RPM_LIMITEUR = 7250;
/** Nombre maximal de sources sonores ponctuelles simultanées. */
export const MAX_SOURCES = 36;
/** Plafond de sortie (≈ −1,1 dBFS). */
export const PLAFOND = 0.88;

/** Fréquence d'allumage du moteur (4 cylindres : 2 explosions par tour). */
export function engineFrequency(rpm: number): number {
  return (rpm / 60) * 2;
}

/** `max` : régime au rupteur de la voiture (RPM_MAX par défaut). */
export function rpmNorm(rpm: number, max = RPM_MAX): number {
  return clamp((rpm - RPM_RALENTI) / (max - RPM_RALENTI), 0, 1);
}

/** Curseur de volume 0..1 → gain linéaire (courbe perceptive douce, 0 → silence). */
export function volumeToGain(v: number): number {
  const x = clamp(Number.isFinite(v) ? v : 0, 0, 1);
  return x * x;
}

/** Coefficient de lissage exponentiel pour un pas `dt` et une constante de temps `tau`. */
export function smoothFactor(dt: number, tau: number): number {
  return tau <= 0 ? 1 : 1 - Math.exp(-Math.max(0, dt) / tau);
}

/** Lissage à montée et descente distinctes (attaque rapide, relâchement lent…). */
export function smoothAsym(cur: number, target: number, dt: number, rise: number, fall: number): number {
  return cur + (target - cur) * smoothFactor(dt, target > cur ? rise : fall);
}

/** Instant où une décroissance `exp(-t/tau)` passe sous −80 dB : on peut alors couper la source sans clic. */
export function tempsFinDecroissance(t0: number, attaque: number, tau: number): number {
  return t0 + attaque + tau * 9.3;
}

// ---------- moteur ----------

export interface CarSound {
  /** multiplicateur de la fréquence d'allumage (plus haut = plus aigu) */
  pitch: number;
  /** écart (cents) entre les deux dents de scie */
  detune: number;
  saw: number; sub: number; upper: number;
  cutBase: number; cutRpm: number; cutThrottle: number; q: number;
  /** saturation douce (1 = très légère) */
  drive: number;
  /** couche « combustion » (bruit) */
  noise: number;
  /** niveau global de la voiture */
  level: number;
  turbo: boolean;
  /** régime au rupteur (tr/min) ; RPM_MAX si absent */
  rpmMax?: number;
}

export const CAR_SOUND: Record<CarId, CarSound> = {
  equilibree: { pitch: 1, detune: 8, saw: 0.55, sub: 0.5, upper: 0.28, cutBase: 380, cutRpm: 0.2, cutThrottle: 650, q: 2.2, drive: 1.5, noise: 0.05, level: 1, turbo: false },
  legere: { pitch: 1.22, detune: 12, saw: 0.5, sub: 0.3, upper: 0.4, cutBase: 450, cutRpm: 0.2, cutThrottle: 600, q: 2.4, drive: 1.3, noise: 0.05, level: 1.12, turbo: false },
  turbo: { pitch: 0.86, detune: 6, saw: 0.55, sub: 0.7, upper: 0.22, cutBase: 300, cutRpm: 0.18, cutThrottle: 600, q: 2, drive: 1.8, noise: 0.07, level: 0.88, turbo: true },
  // trois cylindres nerveux : très aigu, un peu râpeux, monte haut dans les tours
  kei: { pitch: 1.3, detune: 20, saw: 0.62, sub: 0.14, upper: 0.5, cutBase: 520, cutRpm: 0.22, cutThrottle: 700, q: 2.6, drive: 1.2, noise: 0.07, level: 1.08, turbo: false, rpmMax: 8200 },
  // gros V8 : grave, sourd, avec un battement lent entre les deux dents de scie ; rupteur bas
  muscle: { pitch: 0.62, detune: 26, saw: 0.5, sub: 0.95, upper: 0.14, cutBase: 260, cutRpm: 0.14, cutThrottle: 500, q: 1.6, drive: 2.3, noise: 0.1, level: 0.96, turbo: false, rpmMax: 6200 },
  // rotatif : timbre clair et lisse, très haut dans les tours, souffle de combustion marqué (le « brap »)
  rotative: { pitch: 1.25, detune: 4, saw: 0.45, sub: 0.2, upper: 0.62, cutBase: 520, cutRpm: 0.26, cutThrottle: 850, q: 3, drive: 1.6, noise: 0.11, level: 1.02, turbo: false, rpmMax: 9000 },
  // break : quatre cylindres placide, plutôt grave et rond
  break: { pitch: 0.94, detune: 7, saw: 0.5, sub: 0.6, upper: 0.2, cutBase: 340, cutRpm: 0.17, cutThrottle: 560, q: 2, drive: 1.5, noise: 0.06, level: 0.98, turbo: false, rpmMax: 6800 },
};

export interface EngineTargets {
  freq: number; cutoff: number; q: number; gain: number; load: number;
  upper: number; sub: number; noiseGain: number; noiseFreq: number; drive: number;
}

/** Consignes du moteur pour un régime et un accélérateur : en charge (gaz) plus brillant et plus fort qu'en décélération. */
export function engineTargets(c: CarSound, rpm: number, throttle: number): EngineTargets {
  const load = clamp(Math.abs(throttle), 0, 1);
  const max = c.rpmMax ?? RPM_MAX;
  const r = rpmNorm(rpm, max);
  const timbre = 0.55 + 0.45 * load;
  return {
    freq: engineFrequency(clamp(rpm, RPM_RALENTI, max)) * c.pitch,
    cutoff: Math.min(4000, (c.cutBase + rpm * c.cutRpm + load * c.cutThrottle) * timbre),
    q: c.q,
    gain: c.level * (0.45 + 0.55 * load) * (0.75 + 0.25 * r),
    load,
    upper: c.upper * (0.35 + 0.65 * load),
    sub: c.sub * (1.15 - 0.3 * load),
    noiseGain: c.noise * (0.4 + 0.6 * load) * (0.5 + 0.5 * r),
    noiseFreq: 350 + rpm * 0.16,
    drive: c.drive,
  };
}

/** 0 sous le seuil, 1 à fond de régime : intensité du rebond du limiteur. */
export function limiteurQuantite(rpm: number, max = RPM_MAX): number {
  return smoothstep(max - (RPM_MAX - RPM_LIMITEUR), max - 20, rpm);
}

/**
 * Creux de puissance au changement de rapport, `ecoule` s après le changement : descente vers `profondeur`
 * (constante `tauBas`), maintien `tenue`, puis retour à 1 (constante `tauHaut`). Même forme que l'automation planifiée.
 */
export function creuxChangement(ecoule: number, profondeur = 0.5, tauBas = 0.012, tenue = 0.05, tauHaut = 0.05): number {
  if (ecoule <= 0) return 1;
  const bas = (e: number): number => profondeur + (1 - profondeur) * Math.exp(-e / tauBas);
  if (ecoule <= tenue) return bas(ecoule);
  return 1 - (1 - bas(tenue)) * Math.exp(-(ecoule - tenue) / tauHaut);
}

/** Pression du turbo visée : monte avec les gaz et le régime. */
export function boostCible(throttle: number, rpm: number): number {
  return clamp(throttle, 0, 1) * smoothstep(2200, 5500, rpm);
}

export function sifflementFreq(boost: number): number {
  return 1300 + clamp(boost, 0, 1) * 1700;
}

export function sifflementGain(boost: number): number {
  const b = clamp(boost, 0, 1);
  return b * b * 0.022;
}

/** Pschh de décharge : gaz relâchés alors que la pression était haute et le régime élevé. */
export function soufflageDeclenche(boostPrec: number, throttle: number, rpm: number): boolean {
  return boostPrec > 0.45 && throttle < 0.15 && rpm > 3200;
}

// ---------- pneus, surface, vent ----------

/** Niveau 0..1 du crissement selon la glisse arrière et la vitesse. */
export function screechLevel(slip: number, speed: number): number {
  const s = clamp(slip, 0, 1);
  return s * s * (3 - 2 * s) * smoothstep(3, 10, speed);
}

/** Gain du crissement dans le mix (garde le nom historique). */
export function screechGain(slip: number, speed: number): number {
  return screechLevel(slip, speed) * 0.16;
}

/** Fréquence centrale du crissement : 800 à 1900 Hz, jamais perçant. */
export function screechCentre(slip: number, speed: number): number {
  return 800 + clamp(slip, 0, 1) * 500 + smoothstep(5, 40, speed) * 600;
}

/** Grondement gravier / herbe hors piste. */
export function surfaceLevel(onRoad: boolean, speed: number): number {
  return onRoad ? 0 : smoothstep(1, 16, speed);
}

/** Souffle du vent : très discret, seulement à vive allure. */
export function ventLevel(speed: number): number {
  const s = smoothstep(12, 58, speed);
  return s * s;
}

// ---------- chocs et événements ----------

/** Intensité 0..1 d'un choc (impact = vitesse normale en m/s ; le jeu déclenche à partir de 2,5). */
export function chocIntensite(impact: number): number {
  return 0.15 + 0.85 * smoothstep(2.5, 16, impact);
}

const PENTA = [0, 2, 4, 7, 9, 12];

/** Note du « ding » d'un combo : monte d'un degré de gamme pentatonique par multiplicateur (1..5+). */
export function bankFreq(multiplier: number): number {
  const i = clamp(Math.round(multiplier) - 1, 0, PENTA.length - 1);
  return 784 * Math.pow(2, PENTA[i] / 12);
}

export interface NoteSon { f: number; delai: number; gain: number }

export function bankNotes(multiplier: number): NoteSon[] {
  const f = bankFreq(multiplier);
  const n: NoteSon[] = [{ f, delai: 0, gain: 1 }, { f: f * 1.5, delai: 0.075, gain: 0.85 }];
  if (multiplier >= 4) n.push({ f: f * 2, delai: 0.15, gain: 0.6 });
  return n;
}

/** Hauteur du tic de la roulette, k ∈ [0,1]. */
export function tickFreq(k: number): number {
  return 900 + clamp(k, 0, 1) * 300;
}

const semi = (n: number): number => 523.25 * Math.pow(2, n / 12);

export interface RevealParams {
  notes: number[];
  ecart: number;
  tau: number;
  niveau: number;
  etincelles: number;
  choc: boolean;
  houle: boolean;
}

/** Sting de révélation : plus la rareté est haute, plus il est long, riche et scintillant. */
export function revealParams(r: Rarete): RevealParams {
  switch (r) {
    case 'commune': return { notes: [semi(0), semi(4)], ecart: 0.1, tau: 0.16, niveau: 0.9, etincelles: 0, choc: false, houle: false };
    case 'rare': return { notes: [semi(0), semi(4), semi(7)], ecart: 0.095, tau: 0.22, niveau: 1, etincelles: 2, choc: false, houle: false };
    case 'epique': return { notes: [semi(0), semi(4), semi(7), semi(12)], ecart: 0.09, tau: 0.3, niveau: 1.05, etincelles: 4, choc: true, houle: false };
    case 'legendaire': return { notes: [semi(-5), semi(0), semi(4), semi(7), semi(12)], ecart: 0.09, tau: 0.4, niveau: 1.1, etincelles: 6, choc: true, houle: true };
    case 'exotique': return { notes: [semi(-5), semi(0), semi(4), semi(7), semi(12), semi(16)], ecart: 0.085, tau: 0.5, niveau: 1.15, etincelles: 9, choc: true, houle: true };
  }
}
