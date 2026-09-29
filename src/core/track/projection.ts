import { clamp } from '../math/vec';
import type { TrackData } from './buildTrack';

export interface Projection { index: number; s: number; lateral: number; dist: number }

const scratch: number[] = [];

/** Échantillon le plus proche dans un rayon donné (une seule recherche dans la grille). */
export function nearestSampleWithin(track: TrackData, x: number, z: number, radius: number): { index: number; dist: number } | null {
  track.grid.query(x, z, radius, scratch);
  let best = -1;
  let bestD2 = radius * radius;
  for (const i of scratch) {
    const sp = track.samples[i];
    const dx = sp.x - x, dz = sp.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2 || (d2 === bestD2 && best < 0)) { bestD2 = d2; best = i; }
  }
  return best < 0 ? null : { index: best, dist: Math.sqrt(bestD2) };
}

/** Échantillon le plus proche, cherché jusqu'à 64 m (null au-delà). */
export function nearestSample(track: TrackData, x: number, z: number): { index: number; dist: number } | null {
  for (const r of [16, 32, 64]) {
    const res = nearestSampleWithin(track, x, z, r);
    if (res) return res;
  }
  return null;
}

/** Projection sur la route en ne cherchant qu'autour de l'indice `hint` (anti-raccourci). */
export function projectOnTrack(track: TrackData, x: number, z: number, hint: number, back = 20, fwd = 30): Projection {
  const S = track.samples;
  const i0 = Math.max(0, Math.min(S.length - 1, hint - back));
  const i1 = Math.max(0, Math.min(S.length - 1, hint + fwd));
  let best = i0, bestD2 = Infinity;
  for (let i = i0; i <= i1; i++) {
    const dx = S[i].x - x, dz = S[i].z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  const sp = S[best];
  const dx = x - sp.x, dz = z - sp.z;
  const along = dx * sp.tx + dz * sp.tz;
  const lateral = dx * sp.nx + dz * sp.nz;
  return { index: best, s: clamp(sp.s + along, 0, track.length), lateral, dist: Math.sqrt(bestD2) };
}
