import type { CarId, CarParams } from './types';

export const CAR_IDS: CarId[] = ['equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break'];

/** Valeurs de départ, à régler avec le panneau ?debug. */
export const CARS: Record<CarId, CarParams> = {
  equilibree: {
    id: 'equilibree', nom: "L'Équilibrée",
    mass: 1250, wheelbase: 2.6, cgToFront: 1.25, cgHeight: 0.5, gyration: 1.5,
    engineForce: 6500, maxSpeed: 55, brakeForce: 11000, handbrakeForce: 5000,
    dragCoef: 0.42, rollResist: 12, muFront: 1.0, muRear: 1.05, tireB: 8, tireC: 1.4,
    maxSteer: 0.62, steerLock: 0.85, steerSpeed: 2.2, steerReturn: 6, steerCounter: 2.2, steerSpeedReduction: 0.05,
    length: 4.4, width: 1.74, yawDamp: 1, throttleRise: 4, throttleFall: 8, rpmMax: 7500,
  },
  legere: {
    id: 'legere', nom: 'La Légère',
    mass: 950, wheelbase: 2.45, cgToFront: 1.15, cgHeight: 0.48, gyration: 1.35,
    engineForce: 4800, maxSpeed: 48, brakeForce: 9000, handbrakeForce: 4200,
    dragCoef: 0.38, rollResist: 10, muFront: 1.03, muRear: 1.02, tireB: 9, tireC: 1.4,
    maxSteer: 0.66, steerLock: 0.9, steerSpeed: 2.6, steerReturn: 7, steerCounter: 2.2, steerSpeedReduction: 0.045,
    length: 4.1, width: 1.68, yawDamp: 0.8, throttleRise: 5, throttleFall: 9, rpmMax: 7500,
  },
  turbo: {
    id: 'turbo', nom: 'La Turbo',
    mass: 1650, wheelbase: 2.8, cgToFront: 1.45, cgHeight: 0.62, gyration: 1.65,
    engineForce: 12250, maxSpeed: 58, brakeForce: 14000, handbrakeForce: 6000,
    dragCoef: 0.5, rollResist: 14, muFront: 1.02, muRear: 0.95, tireB: 7, tireC: 1.5,
    maxSteer: 0.58, steerLock: 0.82, steerSpeed: 2.0, steerReturn: 5.5, steerCounter: 2, steerSpeedReduction: 0.055,
    length: 4.6, width: 1.82, yawDamp: 0.7, throttleRise: 3.5, throttleFall: 8, rpmMax: 7500,
  },
  kei: {
    id: 'kei', nom: 'La Kei',
    mass: 720, wheelbase: 2.2, cgToFront: 1.02, cgHeight: 0.52, gyration: 1.1,
    engineForce: 3400, maxSpeed: 40, brakeForce: 7000, handbrakeForce: 3400,
    dragCoef: 0.3, rollResist: 8, muFront: 1.0, muRear: 1.0, tireB: 9, tireC: 1.4,
    maxSteer: 0.7, steerLock: 0.95, steerSpeed: 2.8, steerReturn: 8, steerCounter: 2.4, steerSpeedReduction: 0.04,
    length: 3.5, width: 1.6, yawDamp: 0.9, throttleRise: 5.5, throttleFall: 9, rpmMax: 8200,
  },
  muscle: {
    id: 'muscle', nom: 'La Muscle',
    mass: 1750, wheelbase: 2.9, cgToFront: 1.3, cgHeight: 0.58, gyration: 1.8,
    engineForce: 14000, maxSpeed: 56, brakeForce: 13000, handbrakeForce: 5800,
    dragCoef: 0.55, rollResist: 15, muFront: 1.0, muRear: 1.0, tireB: 6.5, tireC: 1.5,
    maxSteer: 0.52, steerLock: 0.78, steerSpeed: 1.9, steerReturn: 4.8, steerCounter: 2.2, steerSpeedReduction: 0.06,
    length: 4.9, width: 1.95, yawDamp: 0.7, throttleRise: 3, throttleFall: 7, rpmMax: 6200,
  },
  rotative: {
    id: 'rotative', nom: 'La Rotative',
    mass: 1080, wheelbase: 2.5, cgToFront: 1.25, cgHeight: 0.44, gyration: 1.3,
    engineForce: 5900, maxSpeed: 52, brakeForce: 10000, handbrakeForce: 4600,
    dragCoef: 0.36, rollResist: 10, muFront: 1.02, muRear: 1.02, tireB: 8.5, tireC: 1.4,
    maxSteer: 0.64, steerLock: 0.88, steerSpeed: 2.5, steerReturn: 6.5, steerCounter: 2.3, steerSpeedReduction: 0.048,
    length: 4.25, width: 1.72, yawDamp: 0.9, throttleRise: 6, throttleFall: 10, rpmMax: 9000,
  },
  break: {
    id: 'break', nom: 'Le Break',
    mass: 1350, wheelbase: 2.7, cgToFront: 1.3, cgHeight: 0.56, gyration: 1.6,
    engineForce: 6300, maxSpeed: 50, brakeForce: 10500, handbrakeForce: 4800,
    dragCoef: 0.46, rollResist: 13, muFront: 1.0, muRear: 1.03, tireB: 7.5, tireC: 1.4,
    maxSteer: 0.58, steerLock: 0.84, steerSpeed: 2.1, steerReturn: 5.5, steerCounter: 2.1, steerSpeedReduction: 0.05,
    length: 4.7, width: 1.78, yawDamp: 1, throttleRise: 4, throttleFall: 8, rpmMax: 6800,
  },
};
