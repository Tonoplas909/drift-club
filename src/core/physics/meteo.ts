import type { Level } from '../level/types';

/** Sous la pluie, les pneus accrochent 20 % de moins (sur la route comme sur le bas-côté). */
export const ADHERENCE_PLUIE = 0.8;

export function adherenceDe(level: Pick<Level, 'meteo'>): number {
  return level.meteo === 'pluie' ? ADHERENCE_PLUIE : 1;
}
