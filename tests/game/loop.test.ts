import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FixedStepLoop } from '../../src/game/loop';
import { interpolatePose } from '../../src/game/pose';
import { ChaseCamera, CAMERA_PROCHE, desiredYaw } from '../../src/render/camera';
import { createCarState } from '../../src/core/physics/car';
import type { Ground } from '../../src/core/track/terrain';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };

describe('FixedStepLoop', () => {
  it('2 pas pour une image de 1/60 s, alpha dans [0,1[', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    const a = loop.advance(1 / 60 + 1e-9);
    expect(n).toBe(2);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
  });
  it('144 Hz : 120 pas par seconde en moyenne', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    for (let i = 0; i < 144; i++) loop.advance(1 / 144);
    expect(n).toBeGreaterThanOrEqual(119);
    expect(n).toBeLessThanOrEqual(120);
  });
  it('grand saut de temps : borné à 0,25 s (30 pas), temps négatif ignoré', () => {
    let n = 0;
    const loop = new FixedStepLoop(() => n++);
    loop.advance(10);
    expect(n).toBe(30);
    loop.advance(-5);
    expect(n).toBe(30);
  });
});

describe('interpolatePose', () => {
  it('interpole position et cap (en passant par ±π)', () => {
    const a = createCarState(0, 0, 3.1), b = createCarState(2, 4, -3.1);
    const p = interpolatePose(a, b, 0.5, flat);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.z).toBeCloseTo(2, 9);
    expect(Math.abs(Math.abs(p.heading) - Math.PI)).toBeLessThan(0.01);
    expect(p.groundPitch).toBeCloseTo(0, 9);
  });
  it('pente : nez vers le haut en montée', () => {
    const slope: Ground = { heightAt: (_x, z) => 0.1 * z, gradientAt: () => ({ gx: 0, gz: 0.1 }) };
    const c = createCarState(0, 10, 0, 1);
    expect(interpolatePose(c, c, 0, slope).groundPitch).toBeCloseTo(Math.atan(0.1), 3);
  });
});

describe('ChaseCamera', () => {
  it('se place derrière la voiture et au-dessus', () => {
    const cam = new ChaseCamera(new THREE.PerspectiveCamera(60, 1.5, 0.1, 2500));
    const t = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 20, speed: 20 };
    cam.reset(t, CAMERA_PROCHE, flat);
    for (let i = 0; i < 120; i++) cam.update(t, CAMERA_PROCHE, 1 / 60, flat);
    expect(cam.camera.position.z).toBeCloseTo(-7, 0);
    expect(cam.camera.position.y).toBeGreaterThan(3.5);
    expect(cam.camera.fov).toBeGreaterThan(60);
  });
  it('suit la direction de la vitesse (drift), le cap à l\'arrêt', () => {
    expect(desiredYaw({ x: 0, y: 0, z: 0, heading: 1, vx: 0, vz: 10, speed: 10 })).toBeCloseTo(0, 9);
    expect(desiredYaw({ x: 0, y: 0, z: 0, heading: 1, vx: 0, vz: 1, speed: 1 })).toBe(1);
  });
});
