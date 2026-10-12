import type { TrackData } from './buildTrack';
import { croisementsBas, HAUTEUR_PONT } from './ponts';

const MAX_PAR_TYPE = 5;

export interface ProblemeGeometrie {
  type: 'croisement' | 'virage';
  s: number;
  x: number;
  z: number;
  x2?: number;
  z2?: number;
  s2?: number;
  message: string;
}

/** Détecte les problèmes de géométrie : croisements à la même hauteur, virages serrés. */
export function geometryProblems(track: TrackData): ProblemeGeometrie[] {
  const problems: ProblemeGeometrie[] = [];
  const S = track.samples;

  // croisements : permis à HAUTEUR_PONT d'écart ou plus (la route du dessus devient un pont), refusés en dessous
  for (const c of croisementsBas(track).slice(0, MAX_PAR_TYPE)) {
    const b = S[Math.min(S.length - 1, Math.round(c.s2))];
    problems.push({
      type: 'croisement', s: c.s, x: c.x, z: c.z, s2: c.s2, x2: b.x, z2: b.z,
      message: `La route se croise à la même hauteur vers ${Math.round(c.s)} m et ${Math.round(c.s2)} m (${(Math.floor(c.ecart * 10) / 10).toFixed(1).replace('.', ',')} m d'écart de hauteur) : écarte-les ou mets au moins ${HAUTEUR_PONT} m de différence pour faire un pont.`,
    });
  }

  let inTight = false;
  let tight = 0;
  for (const sp of S) {
    const r = Math.abs(sp.k) > 1e-9 ? 1 / Math.abs(sp.k) : Infinity;
    if (r < 8) {
      if (!inTight && tight < MAX_PAR_TYPE) {
        const msg = `Virage trop serré vers ${Math.round(sp.s)} m (rayon ${r.toFixed(1)} m, minimum 8 m).`;
        problems.push({
          type: 'virage',
          s: sp.s,
          x: sp.x,
          z: sp.z,
          message: msg,
        });
        tight++;
      }
      inTight = true;
    } else {
      inTight = false;
    }
  }
  return problems;
}

/** Erreurs de géométrie : croisements ou passages trop proches à la même hauteur, virages de rayon < 8 m. */
export function checkGeometry(track: TrackData): string[] {
  return geometryProblems(track).map((p) => p.message);
}
