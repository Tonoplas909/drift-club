import type { Level } from '../level/types';
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
