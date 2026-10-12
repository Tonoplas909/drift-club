import type { TrackData } from '../track/buildTrack';
import type { Environment } from './types';
import { plagesPonts } from '../track/ponts';
import * as dm from '../math/dmath';

/**
 * Obstacle d'un niveau avec des ponts : il ne gêne que les voitures dont la hauteur est dans
 * [y − HAUTEUR_OBSTACLE[0], y + HAUTEUR_OBSTACLE[1]] (y : sol de l'obstacle). Une voiture sur un pont (au moins 6 m
 * au-dessus) passe donc par-dessus les barrières de la route du dessous, et inversement.
 */
export const HAUTEUR_OBSTACLE: readonly [number, number] = [2.5, 3];

/** Espacement (m) des piliers sous un tablier. */
const PAS_PILIERS = 9;

/**
 * Ponts d'un niveau : garde-corps des deux côtés du tablier (on ne peut pas en tomber) et piliers dessous, placés hors
 * de la route du dessous. Les garde-corps sont aussi dessinés (`barriers`), les piliers sont dans `env.piliers`.
 */
export function ajouterPonts(env: Environment, track: TrackData, terrain: { heightAt(x: number, z: number): number }): void {
  const S = track.samples, pont = track.pont;
  if (!pont) return;
  const piliers: NonNullable<Environment['piliers']> = (env.piliers ??= []);
  const voisins: number[] = [];
  for (const p of plagesPonts(pont)) {
    // garde-corps : tronçons de 2 m à w + 0,6 m de l'axe, de chaque côté
    for (let i = p.de; i < p.a; i += 2) {
      const j = Math.min(i + 2, p.a);
      const a = S[i], c = S[j];
      const y = (a.y + c.y) / 2;
      for (const side of [1, -1]) {
        const ax = a.x + a.nx * side * (a.w + 0.6), az = a.z + a.nz * side * (a.w + 0.6);
        const bx = c.x + c.nx * side * (c.w + 0.6), bz = c.z + c.nz * side * (c.w + 0.6);
        env.segments.push({ ax, az, bx, bz, hauteur: [y - HAUTEUR_OBSTACLE[0], y + HAUTEUR_OBSTACLE[1]] });
        env.barriers.push({ x: (ax + bx) / 2, y, z: (az + bz) / 2, rot: dm.atan2(bx - ax, bz - az), len: dm.hypot(bx - ax, bz - az) });
      }
    }
    // piliers : sous l'axe du tablier, là où le sol est assez bas et loin de toute autre route
    for (let i = p.de + 4; i <= p.a - 4; i += PAS_PILIERS) {
      const sp = S[i];
      const sol = terrain.heightAt(sp.x, sp.z);
      if (sp.y - sol < 3) continue;
      track.grid.query(sp.x, sp.z, 24, voisins);
      let libre = true;
      for (const k of voisins) {
        if (Math.abs(S[k].s - sp.s) < 30 || pont[k]) continue;
        const o = S[k], r = o.w + 2.5;
        if ((o.x - sp.x) * (o.x - sp.x) + (o.z - sp.z) * (o.z - sp.z) < r * r) { libre = false; break; }
      }
      if (!libre) continue;
      piliers.push({ x: sp.x, z: sp.z, bas: sol, haut: sp.y - 0.7 });
      env.circles.push({ x: sp.x, z: sp.z, r: 0.8, hauteur: [sol - HAUTEUR_OBSTACLE[0], sp.y - 2.5] });
    }
  }
}
