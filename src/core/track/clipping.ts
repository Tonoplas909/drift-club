import type { Level, ZoneClipping } from '../level/types';
import type { TrackData } from './buildTrack';

/**
 * Zones de clipping : des bords de route à frôler en glisse. Dans une zone, plus le flanc de la voiture passe près
 * du bord, plus le drift rapporte (jusqu'à 1 + `bonusClipping` fois plus au ras du bord, voir scoring/score.ts).
 * Règle de score : pure et déterministe (rejouée par le serveur).
 */
/** au-delà de cette distance (m) entre le flanc de la voiture et le bord, la zone ne rapporte rien */
export const PORTEE_CLIPPING = 2.5;

/** Zone sur la piste : échantillons [i0, i1] et côté (+1 gauche, −1 droite). */
export interface ZonePiste { i0: number; i1: number; cote: 1 | -1 }

export function zonesPiste(level: Level, track: TrackData): ZonePiste[] {
  const n = track.samples.length - 1;
  return (level.clipping ?? []).map((z) => ({
    i0: Math.max(0, Math.min(n, track.pointSample[z.de] ?? 0)),
    i1: Math.max(0, Math.min(n, track.pointSample[z.a] ?? n)),
    cote: z.cote === 'gauche' ? 1 : -1,
  }));
}

/**
 * Proximité du bord dans une zone (0 hors zone ou trop loin, 1 au ras du bord ou au-delà) pour une voiture à
 * l'échantillon `index`, à `lateral` m de l'axe (+ à gauche), sur une route de demi-largeur `w`.
 */
export function proximiteClipping(zones: readonly ZonePiste[], index: number, lateral: number, w: number, demiLargeur: number): number {
  let best = 0;
  for (const z of zones) {
    if (index < z.i0 || index > z.i1) continue;
    const bord = w - z.cote * lateral - demiLargeur;
    const p = bord <= 0 ? 1 : 1 - bord / PORTEE_CLIPPING;
    if (p > best) best = p;
  }
  return best;
}

/**
 * Zones placées automatiquement : à l'extérieur des `nb` plus grands virages (tronçons consécutifs qui tournent du
 * même côté avec un rayon moyen < 90 m), en évitant les 40 premiers mètres. Sert aux niveaux officiels et au défi
 * du jour.
 */
export function zonesAutomatiques(level: Level, track: TrackData, nb: number): ZoneClipping[] {
  const ps = track.pointSample, S = track.samples;
  const virages: { de: number; a: number; ang: number }[] = [];
  let cur: { de: number; a: number; ang: number } | null = null;
  for (let i = 0; i < level.route.length - 1; i++) {
    let ang = 0, len = 0;
    for (let j = ps[i]; j < ps[i + 1]; j++) { const ds = S[j + 1].s - S[j].s; ang += S[j].k * ds; len += ds; }
    const tourne = len > 0 && Math.abs(ang / len) > 1 / 90;
    if (tourne && cur && (cur.ang > 0) === (ang > 0)) { cur.a = i + 1; cur.ang += ang; continue; }
    cur = tourne ? { de: i, a: i + 1, ang } : null;
    if (cur) virages.push(cur);
  }
  return virages
    .filter((v) => S[ps[v.de]].s > 40)
    .sort((a, b) => Math.abs(b.ang) - Math.abs(a.ang) || a.de - b.de)
    .slice(0, nb)
    .sort((a, b) => a.de - b.de)
    // extérieur : virage à gauche (angle > 0) → bord droit
    .map((v) => ({ de: v.de, a: v.a, cote: v.ang > 0 ? 'droite' : 'gauche' }));
}
