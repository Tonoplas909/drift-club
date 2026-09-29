import type { CarId, CarParams } from './types';

export const CAR_IDS: CarId[] = ['equilibree', 'legere', 'turbo'];

/** Valeurs de départ, à régler avec le panneau ?debug. */
export const CARS: Record<CarId, CarParams> = {
  equilibree: {
    id: 'equilibree', nom: "L'Équilibrée",
    mass: 1250, wheelbase: 2.6, cgToFront: 1.25, cgHeight: 0.5, gyration: 1.5,
    engineForce: 5200, maxSpeed: 55, brakeForce: 11000, handbrakeForce: 5000,
    dragCoef: 0.42, rollResist: 12, muFront: 1.05, muRear: 1.0, tireB: 8, tireC: 1.5,
    maxSteer: 0.62, steerLock: 0.85, steerSpeed: 3.2, steerSpeedReduction: 0.035,
    length: 4.4, width: 1.74,
  },
  legere: {
    id: 'legere', nom: 'La Légère',
    mass: 950, wheelbase: 2.45, cgToFront: 1.15, cgHeight: 0.48, gyration: 1.35,
    engineForce: 3800, maxSpeed: 48, brakeForce: 9000, handbrakeForce: 4200,
    dragCoef: 0.38, rollResist: 10, muFront: 1.08, muRear: 0.98, tireB: 9, tireC: 1.5,
    maxSteer: 0.66, steerLock: 0.9, steerSpeed: 3.6, steerSpeedReduction: 0.03,
    length: 4.1, width: 1.68,
  },
  turbo: {
    id: 'turbo', nom: 'La Turbo',
    mass: 1650, wheelbase: 2.8, cgToFront: 1.45, cgHeight: 0.62, gyration: 1.65,
    engineForce: 10500, maxSpeed: 58, brakeForce: 14000, handbrakeForce: 6000,
    dragCoef: 0.5, rollResist: 14, muFront: 1.02, muRear: 0.92, tireB: 7, tireC: 1.6,
    maxSteer: 0.58, steerLock: 0.82, steerSpeed: 2.8, steerSpeedReduction: 0.04,
    length: 4.6, width: 1.82,
  },
};
