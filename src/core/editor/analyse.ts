import type { Level } from '../level/types';
import { validateLevel } from '../level/validate';
import { buildTrack, type TrackData } from '../track/buildTrack';
import { geometryProblems, type ProblemeGeometrie } from '../track/checkGeometry';

export interface AnalyseNiveau {
  ok: boolean;
  erreurs: string[];
  problemes: ProblemeGeometrie[];
  track: TrackData | null;
  stats: {
    points: number;
    objets: number;
    longueur: number;
    tempsCible: number;
  };
}

/** Analyse complète d'un niveau : validation, construction de piste, géométrie. */
export function analyseLevel(level: Level): AnalyseNiveau {
  const stats = {
    points: level.route.length,
    objets: level.objets.length,
    longueur: 0,
    tempsCible: 0,
  };

  // Valide la structure
  const validation = validateLevel(level);
  if (!validation.ok) {
    return {
      ok: false,
      erreurs: validation.erreurs,
      problemes: [],
      track: null,
      stats,
    };
  }

  // Construit la piste
  let track: TrackData;
  try {
    track = buildTrack(level);
  } catch {
    return {
      ok: false,
      erreurs: ['Erreur lors de la construction de la piste.'],
      problemes: [],
      track: null,
      stats,
    };
  }

  // Vérifie la géométrie
  const problemes = geometryProblems(track);

  // Calcule les stats
  stats.longueur = track.length;
  stats.tempsCible = track.targetTime;

  return {
    ok: problemes.length === 0,
    erreurs: [],
    problemes,
    track,
    stats,
  };
}
