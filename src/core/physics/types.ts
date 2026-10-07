import type { Ground } from '../track/terrain';

export type CarId = 'equilibree' | 'legere' | 'turbo' | 'kei' | 'muscle' | 'rotative' | 'break';
export type ModeId = 'arcade' | 'semi' | 'exigeant';

export interface CarParams {
  id: CarId;
  nom: string;
  mass: number;          // kg
  wheelbase: number;     // m
  cgToFront: number;     // m, centre de gravité → essieu avant
  cgHeight: number;      // m
  gyration: number;      // m, rayon de giration (inertie = masse × gyration²)
  engineForce: number;   // N, force motrice à l'arrêt
  maxSpeed: number;      // m/s
  brakeForce: number;    // N
  handbrakeForce: number;// N
  dragCoef: number;      // N/(m/s)²
  rollResist: number;    // N/(m/s)
  muFront: number;
  muRear: number;
  tireB: number;
  tireC: number;
  maxSteer: number;      // rad, braquage max à l'arrêt
  steerLock: number;     // rad, butée (aide au contre-braquage comprise)
  steerSpeed: number;    // rad/s, vitesse d'entrée de braquage (à l'arrêt ; plus douce à haute vitesse)
  steerReturn: number;   // rad/s, retour au centre (rapide)
  steerCounter: number;  // multiplicateur de steerSpeed pour inversion / contre-braquage
  steerSpeedReduction: number; // braquage max / (1 + v × k)
  length: number;        // m
  width: number;         // m
  yawDamp: number;       // 1/s, amortissement de lacet en travers (β > 15°)
  throttleRise: number;  // 1/s, montée de l'accélérateur lissé
  throttleFall: number;  // 1/s, descente de l'accélérateur lissé
  rpmMax: number;        // tr/min, régime au rupteur (son et compte-tours ; sans effet sur la dynamique)
}

export interface AssistParams {
  counterSteer: number;          // 0..1
  counterSteerDeadzone: number;  // rad
  speedRetention: number;        // 0..1
  arcadeDrift: boolean;
  arcadeBeta: number;            // rad
  arcadeRearGrip: number;        // multiplicateur de μ arrière
  arcadePathRate: number;        // rad/s à direction pleine
  arcadeYawAccel: number;        // rad/s², autorité max de l'aide Drift sur le lacet
}

export interface CarState {
  x: number; y: number; z: number;
  heading: number;
  vx: number; vz: number;
  yawRate: number;
  steer: number;
  steerInput: number;
  /** accélération longitudinale lissée (transfert de masse) */
  ax: number;
  beta: number;
  speed: number;
  vLong: number;
  vLat: number;
  /** 0..1, intensité de glisse arrière (fumée, son) */
  rearSlip: number;
  wheelSpin: number;
  rpm: number;
  gear: number;
  reverse: boolean;
  /** accélérateur effectif (−1..1, négatif = marche arrière) */
  throttle: number;
  /** accélérateur lissé (−1..1) : c'est lui qui pilote la force motrice */
  throttleSmooth: number;
  prevVelAngle: number;
}

export interface StepContext {
  params: CarParams;
  assists: AssistParams;
  ground: Ground;
  onRoad: boolean;
  /** adhérence de la route (1 : sec, ADHERENCE_PLUIE sous la pluie) */
  adherence?: number;
}
