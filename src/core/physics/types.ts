import type { Ground } from '../track/terrain';

export type VoitureId = 'equilibree' | 'legere' | 'turbo' | 'kei' | 'muscle' | 'rotative' | 'break';
export type MotoId = 'supermotard';
/** Identifiant d'un véhicule (voiture ou moto) : c'est lui qui voyage dans les replays, les scores et la base. */
export type CarId = VoitureId | MotoId;
/** Genre de véhicule : les motos penchent en virage et peuvent chuter (voir stepCar). */
export type GenreVehicule = 'voiture' | 'moto';
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
  /** genre (absent : voiture) */
  genre?: GenreVehicule;
  /** moto : inclinaison maximale (rad) ; l'adhérence latérale est plafonnée à g × tan(leanMax) */
  leanMax?: number;
  /** moto : pulsation propre du roulis (rad/s) : plus elle est haute, plus la moto bascule vite d'un côté à l'autre */
  leanFreq?: number;
  /** moto : amortissement du roulis (1 = juste sans rebond) */
  leanAmort?: number;
  /** moto : accélération latérale (en g) que les pneus tiennent sans que la moto soit penchée ; au-delà, il faut pencher */
  leanMarge?: number;
  /** moto : élan de cabrage (N·m·s) d'un coup d'embrayage pleinement chargé : c'est lui qui lève l'avant */
  wheeliePop?: number;
  /** moto : rayon de giration en tangage (m), autour du centre de gravité */
  gyrationTangage?: number;
  /** moto : amortissement du tangage (1/s), le pilote et les suspensions absorbent le mouvement */
  amortiTangage?: number;
  /** moto : inclinaison (rad) que le pilote donne au corps en wheelie pour tourner (roue avant en l'air) */
  leanWheelie?: number;
  /** moto : cabrage (rad) au-delà duquel elle bascule en arrière et tombe */
  cabrageChute?: number;
  /** moto : dérive (rad) au-delà de laquelle elle chute */
  betaChute?: number;
  /** moto : angle de dérive maximal visé par l'aide Drift du mode Arcade (rad) */
  arcadeBetaMax?: number;
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
  antiCabrage: number;           // rad, moto : cabrage au-delà duquel l'aide coupe les gaz (0 : pas d'aide)
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
  /** inclinaison (rad, + à gauche) : toujours 0 pour une voiture */
  lean: number;
  /** vitesse de roulis (rad/s) */
  leanVel: number;
  /** cabrage d'une moto en wheelie (rad, avant levé = +, 0 : les deux roues au sol) */
  cabrage: number;
  /** vitesse de cabrage (rad/s) */
  cabrageVel: number;
  /** charge du coup d'embrayage (0 à 1) : frein et gaz tenus ensemble sur une moto */
  embrayage: number;
  /** énergie de la fourche écrasée par des coups de guidon rapides (pompage), qui peut lever l'avant */
  fourche: number;
  /** côté du dernier coup de guidon (−1, 0, 1), pour compter les changements de côté */
  coteBraquage: number;
}

export interface StepContext {
  params: CarParams;
  assists: AssistParams;
  ground: Ground;
  onRoad: boolean;
  /** adhérence de la route (1 : sec, ADHERENCE_PLUIE sous la pluie) */
  adherence?: number;
}
