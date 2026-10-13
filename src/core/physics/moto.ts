import type { CarParams, CarState } from './types';
import { CRASH_IMPACT } from './collision';

/** En dessous de cette vitesse (m/s, 20 km/h), une moto en travers ne tombe pas : elle pivote sur place. */
export const VITESSE_CHUTE = 20 / 3.6;

/**
 * La moto tombe-t-elle ? Trop en travers (dérive au-delà de `betaChute`) au-dessus de 20 km/h en marche avant,
 * wheelie au-delà de `cabrageChute` (elle bascule en arrière), ou gros choc
 * (deux fois le seuil d'un choc). Toujours faux pour une voiture. Pur et déterministe.
 */
export function chute(p: CarParams, car: CarState, impact: number): boolean {
  if (p.genre !== 'moto') return false;
  if (impact > 2 * CRASH_IMPACT) return true;
  // wheelie trop haut : elle passe par-dessus et tombe en arrière
  if (car.cabrage > (p.cabrageChute ?? Infinity)) return true;
  // en marche arrière, la dérive vaut ~180° sans que la moto soit en travers : pas de chute
  return !car.reverse && car.speed > VITESSE_CHUTE && Math.abs(car.beta) > (p.betaChute ?? Infinity);
}
