import type { Ground } from '../track/terrain';

export type CarId = 'equilibree' | 'legere' | 'turbo';
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
  steerSpeed: number;    // rad/s
  steerSpeedReduction: number; // braquage max / (1 + v × k)
  length: number;        // m
  width: number;         // m
}

export interface AssistParams {
  counterSteer: number;          // 0..1
  counterSteerDeadzone: number;  // rad
  betaMax: number | null;        // rad, null = pas de limiteur
  spinStiffness: number;         // (rad/s²)/rad
  speedRetention: number;        // 0..1
  arcadeDrift: boolean;
  arcadeBeta: number;            // rad
  arcadeRearGrip: number;        // multiplicateur de μ arrière
  arcadePathRate: number;        // rad/s à direction pleine
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
  prevVelAngle: number;
}

export interface StepContext {
  params: CarParams;
  assists: AssistParams;
  ground: Ground;
  onRoad: boolean;
}
