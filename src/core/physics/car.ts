import type { InputState } from '../input';
import { clamp, lerp, smoothstep, wrapAngle, DEG } from '../math/vec';
import type { CarState, StepContext } from './types';
import * as dm from '../math/dmath';

const G = 9.81;
const GEAR_STEPS = [0, 0.2, 0.38, 0.56, 0.76];
/** Part minimale de force latérale conservée sous pleine patinage (cercle d'adhérence adouci) */
const LAT_MIN = 0.35;
/** Idem essieu arrière : plein gaz clavier (0/1) ne doit pas supprimer tout le guidage latéral en glisse */
const REAR_LAT_MIN = 0.5;

export function createCarState(x: number, z: number, heading: number, y = 0): CarState {
  return {
    x, y, z, heading, vx: 0, vz: 0, yawRate: 0, steer: 0, steerInput: 0, ax: 0, beta: 0, speed: 0,
    vLong: 0, vLat: 0, rearSlip: 0, wheelSpin: 0, rpm: 900, gear: 1, reverse: false, throttle: 0, throttleSmooth: 0, prevVelAngle: heading,
  };
}

export function copyCarState(src: CarState, dst?: CarState): CarState {
  return Object.assign(dst ?? ({} as CarState), src);
}

function tireForce(alpha: number, load: number, mu: number, B: number, C: number): number {
  return -mu * load * dm.sin(C * dm.atan(B * alpha));
}

/** Avance la voiture d'un pas `dt` (modifie `car`). Déterministe. */
export function stepCar(car: CarState, input: InputState, ctx: StepContext, dt: number): void {
  const p = ctx.params, as = ctx.assists;
  const m = p.mass, L = p.wheelbase, a = p.cgToFront, b = L - a;
  const sinH = dm.sin(car.heading), cosH = dm.cos(car.heading);
  const vLong0 = car.vx * sinH + car.vz * cosH;
  const vLat0 = car.vx * cosH - car.vz * sinH;
  const speed0 = dm.hypot(car.vx, car.vz);
  const beta0 = speed0 > 1 ? dm.atan2(vLat0, vLong0) : 0;

  // Direction : butée dépendante de la vitesse (relâchée en glisse pour pouvoir contre-braquer), rampe asymétrique
  const dirIn = clamp(input.direction, -1, 1);
  const speedRed = 1 / (1 + speed0 * p.steerSpeedReduction);
  const slideRelax = smoothstep(10 * DEG, 35 * DEG, Math.abs(beta0));
  const maxSteer = p.maxSteer * lerp(speedRed, 1, slideRelax);
  const target = dirIn * maxSteer;
  const cur = car.steerInput;
  // contre-braquage vers la glisse : même côté que beta (repère voiture, +gauche)
  const versGlisse = vLong0 > 2 && Math.abs(beta0) > 8 * DEG && target * beta0 > 0;
  let rate: number;
  if (target * cur >= 0 && Math.abs(target) < Math.abs(cur)) rate = p.steerReturn;       // retour au centre : rapide
  else if (target * cur < 0 || versGlisse) rate = p.steerSpeed * p.steerCounter;         // inversion / contre-braquage : vif
  else rate = p.steerSpeed * (0.4 + 0.6 * (maxSteer / p.maxSteer));                      // entrée : progressive, plus douce à vitesse
  car.steerInput += clamp(target - cur, -rate * dt, rate * dt);
  let steer = car.steerInput;
  if (as.counterSteer > 0 && vLong0 > 2 && Math.abs(beta0) > as.counterSteerDeadzone) {
    const b0 = clamp(beta0, -1.2, 1.2);
    // l'aide s'efface si le joueur braque dans la glisse (elle ne doit pas verrouiller la voiture)
    const oppose = clamp(-dirIn * Math.sign(b0), 0, 1);
    steer += as.counterSteer * (1 - 0.85 * oppose) * (b0 - Math.sign(b0) * as.counterSteerDeadzone);
  }
  steer = clamp(steer, -p.steerLock, p.steerLock);
  car.steer = steer;

  // Marche avant / arrière
  if (!car.reverse) {
    if (input.frein > 0 && vLong0 <= 0.5 && input.gaz === 0) car.reverse = true;
  } else if (input.gaz > 0 && vLong0 >= -0.5) {
    car.reverse = false;
  }
  const throttle = car.reverse ? -input.frein : input.gaz;
  const brake = car.reverse ? input.gaz : input.frein;
  car.throttle = throttle;
  // Accélérateur lissé (clavier 0/1) : monte doucement, retombe plus vite
  const tsRate = Math.abs(throttle) > Math.abs(car.throttleSmooth) ? p.throttleRise : p.throttleFall;
  car.throttleSmooth += clamp(throttle - car.throttleSmooth, -tsRate * dt, tsRate * dt);
  const drive = car.throttleSmooth;

  // Charges par essieu (transfert de masse longitudinal)
  const Fzf = Math.max(0.1 * m * G, (m * G * b) / L - (m * car.ax * p.cgHeight) / L);
  const Fzr = Math.max(0.1 * m * G, (m * G * a) / L + (m * car.ax * p.cgHeight) / L);

  // Adhérence
  // × 1 par temps sec : exactement les mêmes forces qu'avant la pluie
  const surface = (ctx.onRoad ? 1 : 0.7) * (ctx.adherence ?? 1);
  const muF = p.muFront * surface;
  let muR = p.muRear * surface;
  const arcadeDrift = as.arcadeDrift && input.freinAMain && speed0 > 8.3;
  const handbrake = input.freinAMain && !as.arcadeDrift;
  if (arcadeDrift) muR *= as.arcadeRearGrip;
  if (handbrake) muR *= 0.5;

  // Forces longitudinales
  let Fdrive = 0;
  if (drive > 0) {
    const r = clamp(vLong0 / p.maxSpeed, 0, 1);
    Fdrive = drive * p.engineForce * (1 - r * r);
  } else if (drive < 0 && vLong0 > -8) {
    Fdrive = drive * p.engineForce * 0.4;
  }
  let FbrakeF = 0, FbrakeR = 0;
  if (brake > 0 && Math.abs(vLong0) > 0.3) {
    const dir = Math.sign(vLong0);
    FbrakeF = -dir * brake * p.brakeForce * 0.6;
    FbrakeR = -dir * brake * p.brakeForce * 0.4;
  }
  if (handbrake && Math.abs(vLong0) > 0.3) FbrakeR -= Math.sign(vLong0) * p.handbrakeForce;

  // Cercle d'adhérence
  const maxRx = muR * Fzr;
  const rearUse = clamp(Math.abs(Fdrive + FbrakeR) / maxRx, 0, 1);
  const Frx = clamp(Fdrive + FbrakeR, -maxRx, maxRx);
  const maxFx = muF * Fzf;
  const frontUse = clamp(Math.abs(FbrakeF) / maxFx, 0, 1);
  const Ffx = clamp(FbrakeF, -maxFx, maxFx);
  const rearLat = Math.max(REAR_LAT_MIN, Math.sqrt(1 - rearUse * rearUse));
  const frontLat = Math.max(LAT_MIN, Math.sqrt(1 - frontUse * frontUse));

  // Forces latérales
  const vAbs = Math.max(Math.abs(vLong0), 0.5);
  const dirSign = vLong0 >= 0 ? 1 : -1;
  const alphaF = dm.atan2(vLat0 + car.yawRate * a, vAbs) - steer * dirSign;
  const alphaR = dm.atan2(vLat0 - car.yawRate * b, vAbs);
  const Fyf = tireForce(alphaF, Fzf, muF, p.tireB, p.tireC) * frontLat;
  const Fyr = tireForce(alphaR, Fzr, muR, p.tireB, p.tireC) * rearLat;

  // Somme des forces (repère voiture : x = avant, y = gauche) et couple
  const cosD = dm.cos(steer), sinD = dm.sin(steer);
  const rolling = p.rollResist * (ctx.onRoad ? 1 : 4);
  const Fx = Frx + Ffx * cosD - Fyf * sinD - p.dragCoef * vLong0 * Math.abs(vLong0) - rolling * vLong0;
  const Fy = Fyr + Fyf * cosD + Ffx * sinD;
  const torque = a * (Fyf * cosD + Ffx * sinD) - b * Fyr;

  // Intégration (Euler semi-implicite) ; monde = avant·Fx + gauche·Fy ; gravité sur la pente
  const grad = ctx.ground.gradientAt(car.x, car.z);
  car.vx += ((Fx * sinH + Fy * cosH) / m - G * grad.gx) * dt;
  car.vz += ((Fx * cosH - Fy * sinH) / m - G * grad.gz) * dt;
  car.yawRate += (torque / (m * p.gyration * p.gyration)) * dt;

  // Basse vitesse : transition vers un modèle cinématique
  const sp1 = dm.hypot(car.vx, car.vz);
  if (sp1 < 3) {
    const t = smoothstep(0.5, 3, sp1);
    const vl = car.vx * sinH + car.vz * cosH;
    const vt = car.vx * cosH - car.vz * sinH;
    car.yawRate = lerp((vl * dm.tan(steer)) / L, car.yawRate, t);
    const damp = (1 - t) * Math.min(1, 10 * dt);
    car.vx -= cosH * vt * damp;
    car.vz += sinH * vt * damp;
    const flatGround = dm.hypot(grad.gx, grad.gz) < 0.03;
    if (flatGround && sp1 < 0.3 && input.gaz === 0 && input.frein === 0) { car.vx *= 0.9; car.vz *= 0.9; }
  }

  // Amortissement de lacet en travers (frottement des pneus) : adoucit l'entrée/sortie de glisse, sans plafonner
  const vl2 = car.vx * sinH + car.vz * cosH;
  const vt2 = car.vx * cosH - car.vz * sinH;
  const sp2 = dm.hypot(car.vx, car.vz);
  const beta2 = sp2 > 2 ? dm.atan2(vt2, vl2) : 0;
  car.yawRate -= car.yawRate * p.yawDamp * smoothstep(15 * DEG, 70 * DEG, Math.abs(beta2)) * dt;

  // Aide Arcade : le bouton Drift vise un angle de dérive et courbe la trajectoire.
  // Autorité bornée (pas de recalage forcé du lacet) et effacée au-delà de la cible : le joueur peut la déborder et partir en tête-à-queue.
  const velAngle = sp2 > 0.5 ? dm.atan2(car.vx, car.vz) : car.heading;
  const pathRate = wrapAngle(velAngle - car.prevVelAngle) / dt;
  car.prevVelAngle = velAngle;
  if (arcadeDrift && vl2 > 5) {
    const dirIn = clamp(input.direction, -1, 1);
    const dir = dirIn !== 0 ? Math.sign(dirIn) : beta2 !== 0 ? -Math.sign(beta2) : 0;
    const amount = dirIn !== 0 ? Math.abs(dirIn) : 0.6;
    const betaTarget = -dir * as.arcadeBeta * amount;
    // au-delà de la cible dans le sens de la rotation : l'aide lâche prise (pleine à la cible, nulle à cible + 25°)
    const over = Math.max(0, Math.abs(beta2) - Math.abs(betaTarget)) * (Math.sign(beta2) === Math.sign(betaTarget) || betaTarget === 0 ? 1 : 0);
    const authority = 1 - smoothstep(0, 25 * DEG, over);
    const rDesired = pathRate + 3 * (beta2 - betaTarget);
    const dYaw = clamp((rDesired - car.yawRate) * Math.min(1, 10 * dt) * authority, -as.arcadeYawAccel * dt, as.arcadeYawAccel * dt);
    car.yawRate += dYaw;
    const turn = dirIn * as.arcadePathRate * dt * authority;
    const c = dm.cos(turn), s = dm.sin(turn);
    const nvx = car.vx * c + car.vz * s;
    const nvz = car.vz * c - car.vx * s;
    car.vx = nvx;
    car.vz = nvz;
  }

  // Aide : vitesse conservée en drift
  if (as.speedRetention > 0 && Math.abs(beta2) > 15 * DEG && brake === 0) {
    const ns = dm.hypot(car.vx, car.vz);
    if (ns < speed0 && ns > 0.1) {
      const k = (ns + (speed0 - ns) * as.speedRetention) / ns;
      car.vx *= k;
      car.vz *= k;
    }
  }

  // Borne de sécurité numérique uniquement (jamais atteinte par un vrai tête-à-queue)
  car.yawRate = clamp(car.yawRate, -12, 12);

  // Position
  car.heading = wrapAngle(car.heading + car.yawRate * dt);
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  car.y = ctx.ground.heightAt(car.x, car.z);

  // Valeurs dérivées
  const s2 = dm.sin(car.heading), c2 = dm.cos(car.heading);
  car.vLong = car.vx * s2 + car.vz * c2;
  car.vLat = car.vx * c2 - car.vz * s2;
  car.speed = dm.hypot(car.vx, car.vz);
  car.beta = car.speed > 1 ? dm.atan2(car.vLat, car.vLong) : 0;
  // accélération issue des forces (pas de la dérivée de vLong : la rotation du cap simulerait un freinage et fausserait le transfert de masse)
  const axNow = clamp(Fx / m, -15, 15);
  car.ax += (axNow - car.ax) * Math.min(1, 8 * dt);
  const slide = clamp((Math.abs(alphaR) - 0.12) / 0.35, 0, 1) * smoothstep(3, 8, car.speed);
  const spin = rearUse > 0.98 && throttle > 0 && car.speed < 15 ? 0.6 : 0;
  car.rearSlip = clamp(Math.max(slide, spin, handbrake && car.speed > 3 ? 0.8 : 0), 0, 1);
  car.wheelSpin = (car.wheelSpin + (car.vLong / 0.34) * dt) % (Math.PI * 2);

  // Boîte automatique et régime (pour le son)
  const f = Math.abs(car.vLong) / p.maxSpeed;
  let gear = 1;
  for (let g = 1; g < GEAR_STEPS.length; g++) if (f >= GEAR_STEPS[g]) gear = g + 1;
  car.gear = car.reverse ? -1 : gear;
  const lo = GEAR_STEPS[gear - 1];
  const hi = gear < GEAR_STEPS.length ? GEAR_STEPS[gear] : 1;
  const inGear = clamp((f - lo) / Math.max(1e-6, hi - lo), 0, 1);
  const targetRpm = car.speed < 0.5 && throttle <= 0 ? 900 : 1500 + inGear * (p.rpmMax - 2000) + (spin > 0 ? 1200 : 0);
  car.rpm += (clamp(targetRpm, 900, p.rpmMax) - car.rpm) * Math.min(1, 12 * dt);
}
