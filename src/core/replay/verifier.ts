import { SIM_DT } from '../constants';
import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import type { Terrain } from '../track/terrain';
import type { Environment } from '../env/types';
import type { CarId, ModeId } from '../physics/types';
import { CARS, CAR_IDS } from '../physics/cars';
import { MODES, MODE_IDS } from '../physics/assists';
import { RaceSim } from '../race/race';
import { lireReplay } from './replay';

/** Course la plus longue que le serveur accepte de rejouer (temps de calcul borné). */
export const DUREE_MAX_VERIFIEE = 600;
/** Décompte de départ (le même que le jeu) + marge. */
export const PAS_MAX = Math.ceil((DUREE_MAX_VERIFIEE + 5) / SIM_DT);

/**
 * Écart toléré entre le score annoncé par le jeu et le score rejoué par le serveur. En dessous, on garde le score
 * annoncé (le joueur voit exactement le score affiché à l'arrivée) ; au-dessus, c'est le score rejoué qui compte.
 */
export const TOLERANCE = { scoreRelatif: 0.01, scoreAbsolu: 100, temps: 0.5 } as const;

export interface CourseAnnoncee {
  score: number;
  temps: number;
  meilleurDrift: number;
}

export interface NiveauPrepare { level: Level; track: TrackData; terrain: Terrain; env: Environment }

export type Verdict =
  /** rejoué et proche de l'annonce : on garde les valeurs annoncées */
  | { statut: 'conforme'; score: number; temps: number; meilleurDrift: number; scoreRejoue: number; tempsRejoue: number }
  /** rejoué mais trop loin de l'annonce : on garde les valeurs du serveur */
  | { statut: 'corrige'; score: number; temps: number; meilleurDrift: number; scoreRejoue: number; tempsRejoue: number }
  /** impossible à rejouer jusqu'à l'arrivée : rien n'est enregistré */
  | { statut: 'refuse'; raison: string };

/** L'annonce est-elle assez proche de la course rejouée pour être gardée ? */
export function annonceProche(annonce: CourseAnnoncee, rejoue: CourseAnnoncee): boolean {
  const tolScore = Math.max(TOLERANCE.scoreAbsolu, TOLERANCE.scoreRelatif * rejoue.score);
  return Math.abs(annonce.score - rejoue.score) <= tolScore
    && Math.abs(annonce.temps - rejoue.temps) <= TOLERANCE.temps
    && annonce.meilleurDrift >= 0 && annonce.meilleurDrift <= annonce.score
    && Math.abs(annonce.meilleurDrift - rejoue.meilleurDrift) <= tolScore;
}

/** Rejoue la course enregistrée sur le niveau préparé et compare avec l'annonce du jeu. */
export function verifierCourse(n: NiveauPrepare, voiture: CarId, mode: ModeId, replay: Uint8Array, annonce: CourseAnnoncee): Verdict {
  if (!CAR_IDS.includes(voiture)) return { statut: 'refuse', raison: 'Voiture inconnue.' };
  if (!MODE_IDS.includes(mode)) return { statut: 'refuse', raison: 'Mode inconnu.' };
  const sim = new RaceSim({ level: n.level, track: n.track, terrain: n.terrain, env: n.env, car: CARS[voiture], assists: MODES[mode] });
  const lu = lireReplay(replay, PAS_MAX, (p) => {
    sim.step(p.input, p.replacer);
    return sim.phase !== 'arrivee';
  });
  if (typeof lu === 'string') return { statut: 'refuse', raison: lu };
  const r = sim.result;
  if (!r) return { statut: 'refuse', raison: "La course rejouée n'atteint pas l'arrivée." };
  if (r.time > DUREE_MAX_VERIFIEE) return { statut: 'refuse', raison: 'Course trop longue pour le classement.' };
  const rejoue: CourseAnnoncee = { score: r.score, temps: r.time, meilleurDrift: r.bestDrift };
  const base = { scoreRejoue: r.score, tempsRejoue: r.time };
  if (annonceProche(annonce, rejoue)) {
    return { statut: 'conforme', score: Math.round(annonce.score), temps: annonce.temps, meilleurDrift: Math.round(annonce.meilleurDrift), ...base };
  }
  return { statut: 'corrige', score: r.score, temps: r.time, meilleurDrift: r.bestDrift, ...base };
}
