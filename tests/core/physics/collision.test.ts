import { describe, it, expect } from 'vitest';
import { buildCollisionWorld, resolveCollisions, CRASH_IMPACT } from '../../../src/core/physics/collision';
import { createCarState, stepCar, copyCarState } from '../../../src/core/physics/car';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import type { Ground } from '../../../src/core/track/terrain';
import { SIM_DT } from '../../../src/core/constants';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };
const P = CARS.equilibree;
const idle = { gaz: 0, frein: 0, direction: 0, freinAMain: false };

describe('collisions', () => {
  it('percute un arbre : choc détecté, voiture arrêtée devant', () => {
    const world = buildCollisionWorld({ circles: [{ x: 0, z: 6, r: 0.5 }], segments: [] });
    const car = createCarState(0, 0, 0);
    car.vz = 10;
    let maxImpact = 0;
    for (let i = 0; i < 120; i++) {
      stepCar(car, idle, { params: P, assists: MODES.semi, ground: flat, onRoad: true }, SIM_DT);
      maxImpact = Math.max(maxImpact, resolveCollisions(car, P, world));
    }
    expect(maxImpact).toBeGreaterThan(CRASH_IMPACT);
    expect(car.z).toBeLessThan(3.5);
    expect(car.vz).toBeLessThan(3);
  });
  it('barrière à gauche : repoussée à la bonne distance, freinée et tournée vers la droite', () => {
    const world = buildCollisionWorld({ circles: [], segments: [{ ax: 3, az: -50, bx: 3, bz: 50 }] });
    const car = createCarState(2.5, 0, 0);
    car.vx = 5; car.vz = 10;
    const impact = resolveCollisions(car, P, world);
    expect(impact).toBeGreaterThan(CRASH_IMPACT);
    expect(car.x).toBeLessThanOrEqual(3 - P.width / 2 + 1e-6);
    expect(car.vx).toBeLessThan(2.5);
    expect(car.yawRate).toBeLessThan(0);
  });
  it('frottement léger le long d’une barrière : pas un choc', () => {
    const world = buildCollisionWorld({ circles: [], segments: [{ ax: 3, az: -50, bx: 3, bz: 50 }] });
    const car = createCarState(3 - P.width / 2 + 0.05, 0, 0);
    car.vx = 0.5; car.vz = 20;
    const impact = resolveCollisions(car, P, world);
    expect(impact).toBeLessThan(CRASH_IMPACT);
    expect(car.x).toBeLessThanOrEqual(3 - P.width / 2 + 1e-6);
  });
  it('aucun contact : état inchangé, impact nul', () => {
    const world = buildCollisionWorld({ circles: [{ x: 50, z: 50, r: 1 }], segments: [{ ax: 40, az: 0, bx: 40, bz: 10 }] });
    const car = createCarState(0, 0, 0.3);
    car.vx = 3; car.vz = 7; car.yawRate = 0.2;
    const before = copyCarState(car);
    expect(resolveCollisions(car, P, world)).toBe(0);
    expect(car).toEqual(before);
  });
  it('obstacle à cheval sur deux cases de la grille', () => {
    const world = buildCollisionWorld({ circles: [{ x: 7.9, z: 8.1, r: 1 }], segments: [] });
    // cercle avant à (length/2 − width/2) devant le centre ; 0,1 m d'interpénétration
    const off = P.length / 2 - P.width / 2;
    const car = createCarState(7.9, 8.1 - 1 - P.width / 2 - off + 0.1, 0);
    car.vz = 5;
    expect(resolveCollisions(car, P, world)).toBeGreaterThan(0);
  });
  it('arrière de la voiture : un obstacle derrière est aussi détecté', () => {
    const world = buildCollisionWorld({ circles: [{ x: 0, z: -2.5, r: 0.5 }], segments: [] });
    const car = createCarState(0, 0, 0);
    car.vz = -4;
    expect(resolveCollisions(car, P, world)).toBeGreaterThan(0);
  });
});
