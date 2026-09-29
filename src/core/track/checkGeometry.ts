import type { TrackData } from './buildTrack';

const MAX_PAR_TYPE = 5;

/** Erreurs de géométrie : croisements / passages trop proches, virages de rayon < 8 m. */
export function checkGeometry(track: TrackData): string[] {
  const errs: string[] = [];
  const S = track.samples;
  const scratch: number[] = [];

  let crossings = 0;
  let lastFlag = -Infinity;
  for (let i = 0; i < S.length && crossings < MAX_PAR_TYPE; i += 2) {
    const a = S[i];
    track.grid.query(a.x, a.z, a.w + 14, scratch);
    for (const j of scratch) {
      if (j <= i) continue;
      const b = S[j];
      const thr = a.w + b.w + 4;
      if (b.s - a.s <= 2 * thr) continue;
      if (Math.hypot(a.x - b.x, a.z - b.z) < thr) {
        if (a.s - lastFlag > 30) {
          errs.push(`La route se croise ou passe trop près d'elle-même (vers ${Math.round(a.s)} m et ${Math.round(b.s)} m).`);
          crossings++;
          lastFlag = a.s;
        }
        break;
      }
    }
  }

  let inTight = false;
  let tight = 0;
  for (const sp of S) {
    const r = Math.abs(sp.k) > 1e-9 ? 1 / Math.abs(sp.k) : Infinity;
    if (r < 8) {
      if (!inTight && tight < MAX_PAR_TYPE) {
        errs.push(`Virage trop serré vers ${Math.round(sp.s)} m (rayon ${r.toFixed(1)} m, minimum 8 m).`);
        tight++;
      }
      inTight = true;
    } else {
      inTight = false;
    }
  }
  return errs;
}
