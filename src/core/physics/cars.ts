import type { CarId, CarParams } from './types';

export const CAR_IDS: CarId[] = ['equilibree', 'legere', 'turbo'];

/** Valeurs de départ, à régler avec le panneau ?debug. */
export const CARS: Record<CarId, CarParams> = {
  equilibree: {
    id: 'equilibree', nom: "L'Équilibrée",
    mass: 1250, wheelbase: 2.6, cgToFront: 1.25, cgHeight: 0.5, gyration: 1.5,
    engineForce: 6500, maxSpeed: 55, brakeForce: 11000, handbrakeForce: 5000,
    dragCoef: 0.42, rollResist: 12, muFront: 1.0, muRear: 1.05, tireB: 8, tireC: 1.4,
    maxSteer: 0.62, steerLock: 0.85, steerSpeed: 2.2, steerReturn: 6, steerCounter: 2.2, steerSpeedReduction: 0.05,
    length: 4.4, width: 1.74, yawDamp: 1, throttleRise: 4, throttleFall: 8,
  },
  legere: {
    id: 'legere', nom: 'La Légère',
    mass: 950, wheelbase: 2.45, cgToFront: 1.15, cgHeight: 0.48, gyration: 1.35,
    engineForce: 4800, maxSpeed: 48, brakeForce: 9000, handbrakeForce: 4200,
    dragCoef: 0.38, rollResist: 10, muFront: 1.03, muRear: 1.02, tireB: 9, tireC: 1.4,
    maxSteer: 0.66, steerLock: 0.9, steerSpeed: 2.6, steerReturn: 7, steerCounter: 2.2, steerSpeedReduction: 0.045,
    length: 4.1, width: 1.68, yawDamp: 0.8, throttleRise: 5, throttleFall: 9,
  },
  turbo: {
    id: 'turbo', nom: 'La Turbo',
    mass: 1650, wheelbase: 2.8, cgToFront: 1.45, cgHeight: 0.62, gyration: 1.65,
    engineForce: 12250, maxSpeed: 58, brakeForce: 14000, handbrakeForce: 6000,
    dragCoef: 0.5, rollResist: 14, muFront: 1.02, muRear: 0.95, tireB: 7, tireC: 1.5,
    maxSteer: 0.58, steerLock: 0.82, steerSpeed: 2.0, steerReturn: 5.5, steerCounter: 2, steerSpeedReduction: 0.055,
    length: 4.6, width: 1.82, yawDamp: 0.7, throttleRise: 3.5, throttleFall: 8,
  },
};
