import type { CarParams, CarState } from './types';
import { CRASH_IMPACT } from './collision';

/** En dessous de cette vitesse (m/s, 20 km/h), une moto en travers ne tombe pas : elle pivote sur place. */
export const VITESSE_CHUTE = 20 / 3.6;

/**
 * La moto tombe-t-elle ? Trop en travers (dérive au-delà de `betaChute`) au-dessus de 20 km/h, ou gros choc
 * (deux fois le seuil d'un choc). Toujours faux pour une voiture. Pur et déterministe.
 */
export function chute(p: CarParams, car: CarState, impact: number): boolean {
  if (p.genre !== 'moto') return false;
  if (impact > 2 * CRASH_IMPACT) return true;
  return car.speed > VITESSE_CHUTE && Math.abs(car.beta) > (p.betaChute ?? Infinity);
}
