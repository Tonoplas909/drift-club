import type { CarId } from '../core/physics/types';
import { CAR_IDS } from '../core/physics/cars';

/**
 * Statistiques du pilote, comptées sur l'appareil : distances, temps en glisse, plus long drift, courses finies,
 * distance par voiture (voiture la plus jouée)… Rien n'est envoyé au serveur.
 */
export interface Statistiques {
  /** mètres parcourus en course (niveaux) */
  distanceCourse: number;
  /** mètres parcourus en mode Zen */
  distanceZen: number;
  /** secondes passées en glisse (angle et vitesse suffisants, comme pour le score) */
  tempsGlisse: number;
  /** plus long drift d'un seul tenant (s) */
  plusLongDrift: number;
  /** meilleur drift encaissé (points, combo compris) */
  meilleurDrift: number;
  /** drifts encaissés */
  drifts: number;
  /** courses finies (ligne d'arrivée passée) */
  courses: number;
  /** mètres parcourus avec chaque voiture */
  parVoiture: Partial<Record<CarId, number>>;
  /** date de la première course comptée (AAAA-MM-JJ) */
  depuis: string | null;
}

export function statistiquesVides(): Statistiques {
  return { distanceCourse: 0, distanceZen: 0, tempsGlisse: 0, plusLongDrift: 0, meilleurDrift: 0, drifts: 0, courses: 0, parVoiture: {}, depuis: null };
}

const positif = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/** Relit des statistiques enregistrées (valeurs absurdes remises à zéro). */
export function lireStatistiques(v: unknown): Statistiques {
  const o = typeof v === 'object' && v !== null && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const pv = typeof o.parVoiture === 'object' && o.parVoiture !== null ? o.parVoiture as Record<string, unknown> : {};
  const parVoiture: Partial<Record<CarId, number>> = {};
  for (const id of CAR_IDS) { const d = positif(pv[id]); if (d > 0) parVoiture[id] = d; }
  return {
    distanceCourse: positif(o.distanceCourse), distanceZen: positif(o.distanceZen), tempsGlisse: positif(o.tempsGlisse),
    plusLongDrift: positif(o.plusLongDrift), meilleurDrift: positif(o.meilleurDrift),
    drifts: Math.floor(positif(o.drifts)), courses: Math.floor(positif(o.courses)), parVoiture,
    depuis: typeof o.depuis === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.depuis) ? o.depuis : null,
  };
}

/** Seuils du score : au-delà de 15° de dérive et 30 km/h, la voiture glisse. */
const BETA_GLISSE = 15 * Math.PI / 180;
const VITESSE_GLISSE = 30 / 3.6;

/** Compte pendant que l'on roule ; `aujourdhui` (AAAA-MM-JJ) date la première course. */
export class CompteurPilote {
  private driftEnCours = 0;
  modifie = false;

  constructor(public stats: Statistiques, private readonly aujourdhui: () => string) {}

  /** Un pas de simulation (`dt` s) : distance, glisse. */
  pas(voiture: CarId, vitesse: number, beta: number, zen: boolean, dt: number): void {
    const d = Math.max(0, vitesse) * dt;
    if (d > 0) {
      const s = this.stats;
      if (zen) s.distanceZen += d; else s.distanceCourse += d;
      s.parVoiture[voiture] = (s.parVoiture[voiture] ?? 0) + d;
      s.depuis ??= this.aujourdhui();
      this.modifie = true;
    }
    if (Math.abs(beta) > BETA_GLISSE && vitesse > VITESSE_GLISSE) {
      this.stats.tempsGlisse += dt;
      this.driftEnCours += dt;
      if (this.driftEnCours > this.stats.plusLongDrift) this.stats.plusLongDrift = this.driftEnCours;
    } else this.driftEnCours = 0;
  }

  /** Drift encaissé (points, combo compris). */
  drift(points: number): void {
    this.stats.drifts++;
    if (points > this.stats.meilleurDrift) this.stats.meilleurDrift = points;
    this.modifie = true;
  }

  courseFinie(): void {
    this.stats.courses++;
    this.modifie = true;
  }

  /** Nouvelle course ou replacement : le drift en cours s'arrête. */
  couper(): void {
    this.driftEnCours = 0;
  }
}

/** Voiture avec laquelle on a le plus roulé, ou null. */
export function voiturePreferee(s: Statistiques): CarId | null {
  let best: CarId | null = null, d = 0;
  for (const id of CAR_IDS) { const x = s.parVoiture[id] ?? 0; if (x > d) { d = x; best = id; } }
  return best;
}

/** Durée lisible : « 12 min », « 3 h 05 », « 45 s ». */
export function formatDuree(s: number): string {
  if (s < 60) return `${Math.round(s)} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
