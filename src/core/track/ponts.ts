import type { TrackData, TrackSample } from './buildTrack';
import type { Ground } from './terrain';
import * as dm from '../math/dmath';

/**
 * Croisements de route et ponts. Deux portions de la route (éloignées le long de la route) peuvent se croiser ou passer
 * tout près l'une de l'autre si elles sont à des hauteurs assez différentes : la plus haute devient un PONT (tablier,
 * garde-corps, piliers) et la plus basse passe dessous. À moins de HAUTEUR_PONT d'écart, c'est un croisement à la même
 * hauteur : refusé par l'éditeur (voir checkGeometry). Pur et déterministe (rejoué par le serveur).
 */

/** Écart de hauteur minimal (m) entre deux routes qui se croisent : de quoi passer dessous. */
export const HAUTEUR_PONT = 6;
/** Le tablier déborde de cette longueur (m) de part et d'autre de la zone de croisement (culées). */
const DEBORD = 10;

/** Deux portions de route trop proches à la même hauteur. */
export interface CroisementBas { s: number; s2: number; x: number; z: number; ecart: number }

/**
 * Appelle `f` pour chaque paire d'échantillons de deux portions de route (éloignées le long de la route) trop proches
 * en plan. Un échantillon sur deux pour la première portion, avec le même critère que l'ancienne détection des
 * croisements : un niveau qui était valide n'a ni pont ni croisement (sa course est inchangée).
 */
function parcourir(track: TrackData, f: (a: TrackSample, b: TrackSample, i: number, j: number) => void): void {
  const S = track.samples, scratch: number[] = [];
  for (let i = 0; i < S.length; i += 2) {
    const a = S[i];
    track.grid.query(a.x, a.z, a.w + 14, scratch);
    for (const j of scratch) {
      if (j <= i) continue;
      const b = S[j];
      const seuil = a.w + b.w + 4;
      if (b.s - a.s <= 2 * seuil) continue;
      if (dm.hypot(a.x - b.x, a.z - b.z) < seuil) f(a, b, i, j);
    }
  }
}

/**
 * Échantillons qui sont sur un pont (1) : la portion la plus haute de chaque croisement à au moins HAUTEUR_PONT
 * d'écart, prolongée de DEBORD m de chaque côté. null s'il n'y a aucun pont (le cas de presque tous les niveaux).
 */
export function detecterPonts(track: TrackData): Uint8Array | null {
  const p = new Uint8Array(track.samples.length);
  let trouve = false;
  parcourir(track, (a, b, i, j) => {
    if (Math.abs(a.y - b.y) < HAUTEUR_PONT) return;
    p[a.y > b.y ? i : j] = 1;
    trouve = true;
  });
  if (!trouve) return null;
  // culées : le tablier commence et finit un peu avant et après la zone de croisement
  const n = p.length, out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!p[i]) continue;
    for (let k = Math.max(0, i - DEBORD); k <= Math.min(n - 1, i + DEBORD); k++) out[k] = 1;
  }
  return out;
}

/** Croisements à la même hauteur (moins de HAUTEUR_PONT d'écart), un par croisement. */
export function croisementsBas(track: TrackData): CroisementBas[] {
  const out: CroisementBas[] = [];
  let dernier = -Infinity;
  parcourir(track, (a, b) => {
    const ecart = Math.abs(a.y - b.y);
    if (ecart >= HAUTEUR_PONT || a.s - dernier <= 30) return;
    dernier = a.s;
    out.push({ s: a.s, s2: b.s, x: a.x, z: a.z, ecart });
  });
  return out;
}

/** Plages d'échantillons [de, a] de chaque pont. */
export function plagesPonts(pont: Uint8Array | null): { de: number; a: number }[] {
  const out: { de: number; a: number }[] = [];
  if (!pont) return out;
  for (let i = 0; i < pont.length; i++) {
    if (!pont[i]) continue;
    const de = i;
    while (i + 1 < pont.length && pont[i + 1]) i++;
    out.push({ de, a: i });
  }
  return out;
}

/**
 * Sol de la voiture : le terrain, sauf sur un pont où c'est le tablier. On sait sur quelle portion de route est la
 * voiture grâce à `indice` (sa progression) : sous un pont, elle reste sur la route du dessous. Sans pont, c'est
 * exactement le terrain.
 */
export class SolPiste implements Ground {
  /** échantillon de la route où se trouve la voiture (sa progression) */
  indice = 0;

  constructor(private readonly terrain: Ground, private readonly track: TrackData) {}

  /** Hauteur du tablier sous (x, z) s'il y a un pont sur la portion de la voiture, sinon null. */
  private tablier(x: number, z: number): number | null {
    const pont = this.track.pont;
    if (!pont) return null;
    const S = this.track.samples;
    const i0 = Math.max(0, this.indice - 25), i1 = Math.min(S.length - 1, this.indice + 35);
    let best = -1, bestD = Infinity;
    for (let i = i0; i <= i1; i++) {
      const dx = S[i].x - x, dz = S[i].z - z, d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0 || !pont[best]) return null;
    const sp = S[best];
    const dx = x - sp.x, dz = z - sp.z;
    if (Math.abs(dx * sp.nx + dz * sp.nz) > sp.w + 1.5) return null;
    return sp.y + sp.grade * (dx * sp.tx + dz * sp.tz);
  }

  heightAt(x: number, z: number): number {
    if (!this.track.pont) return this.terrain.heightAt(x, z);
    return this.tablier(x, z) ?? this.terrain.heightAt(x, z);
  }

  gradientAt(x: number, z: number): { gx: number; gz: number } {
    if (!this.track.pont) return this.terrain.gradientAt(x, z);
    const e = 0.5;
    return {
      gx: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      gz: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    };
  }
}
