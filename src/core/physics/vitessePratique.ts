import { createCarState, stepCar } from './car';
import { MODES } from './assists';
import { SIM_DT } from '../constants';
import type { CarParams } from './types';
import type { Ground } from '../track/terrain';

const PLAT: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };

/**
 * Vitesse (m/s) réellement atteinte sur une courte ligne droite : départ à 54 km/h (sortie de virage),
 * plein gaz sur 100 m à plat. Sert d'échelle à la jauge de vitesse (la vitesse max théorique n'est
 * jamais atteinte sur les circuits).
 */
export function vitessePratique(params: CarParams, depart = 15, distance = 100): number {
  const c = createCarState(0, 0, 0);
  c.vz = depart;
  const ctx = { params, assists: MODES.semi, ground: PLAT, onRoad: true };
  const input = { gaz: 1, frein: 0, direction: 0, freinAMain: false };
  for (let t = 0; c.z < distance && t < 30; t += SIM_DT) stepCar(c, input, ctx, SIM_DT);
  return c.speed;
}
