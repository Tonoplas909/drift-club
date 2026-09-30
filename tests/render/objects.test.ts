import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ParticlePool, SkidTrail } from '../../src/render/effects';
import { buildDecor } from '../../src/render/decor';
import { CarView } from '../../src/render/carView';
import { coloredBox } from '../../src/render/procedural';
import type { Assets, CarModel } from '../../src/render/assets';
import type { Environment } from '../../src/core/env/types';

const box = () => coloredBox(1, 1, 1, 0, 0.5, 0, 0x33aa33);
const carModel = (): CarModel => ({
  body: coloredBox(1.8, 1, 4, 0, 0.8, 0, 0xff0000),
  wheels: [
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(0.8, 0.35, 1.3), front: true, left: true },
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(-0.8, 0.35, 1.3), front: true, left: false },
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(0.8, 0.35, -1.3), front: false, left: true },
    { geometry: coloredBox(0.3, 0.7, 0.7, 0, 0, 0, 0x111111), position: new THREE.Vector3(-0.8, 0.35, -1.3), front: false, left: false },
  ],
  paint: new THREE.Color(0xff0000),
});
const fakeAssets = (): Assets => ({
  cars: { equilibree: carModel(), legere: carModel(), turbo: carModel(), kei: carModel(), muscle: carModel(), rotative: carModel(), break: carModel() },
  decor: { sapin0: box(), sapin1: box(), sapin2: box(), feuillu0: box(), feuillu1: box(), feuillu2: box(), rocher0: box(), rocher1: box(), rocherHaut0: box(), panneau0: box(), pneus0: box(), chevron0: box(), borne0: box(), barriere: box() },
});

describe('ParticlePool', () => {
  it('émet, vieillit puis disparaît', () => {
    const pool = new ParticlePool(4, 1);
    pool.emit(0, 0, 0, 10, 0);
    expect(pool.alive()).toBe(1);
    pool.update(0.2);
    expect(ParticlePool.scaleOf(pool.items[0])).toBeGreaterThan(0);
    for (let i = 0; i < 100; i++) pool.update(0.05);
    expect(pool.alive()).toBe(0);
    expect(ParticlePool.scaleOf(pool.items[0])).toBe(0);
  });
  it('anneau de capacité fixe', () => {
    const pool = new ParticlePool(3, 1);
    for (let i = 0; i < 10; i++) pool.emit(i, 0, 0, 0, 0);
    expect(pool.items.length).toBe(3);
    expect(pool.alive()).toBe(3);
  });
});

describe('SkidTrail', () => {
  it('trace des quadrilatères quand la roue glisse et se déplace', () => {
    const t = new SkidTrail(3, 0.28);
    expect(t.add(0, 0, 0, 0, true)).toBe(-1);
    expect(t.add(0, 0, 0, 1, true)).toBe(0);
    const d = t.data;
    expect(Math.hypot(d[0] - d[3], d[2] - d[5])).toBeCloseTo(0.28, 5);
    expect(t.add(0, 0, 0, 1.1, true)).toBe(-1);
    expect(t.add(0, 0, 0, 3, false)).toBe(-1);
    expect(t.add(0, 0, 0, 4, true)).toBe(-1);
    for (let i = 5; i < 12; i++) t.add(0, 0, 0, i, true);
    expect(t.count).toBe(3);
  });
});

describe('décor et voiture', () => {
  it('buildDecor crée des maillages instanciés avec le bon nombre d\'instances', () => {
    const env: Environment = {
      items: [
        { kind: 'sapin', variant: 0, x: 0, y: 0, z: 0, rot: 0, scale: 1, solid: true, manual: false },
        { kind: 'sapin', variant: 0, x: 10, y: 0, z: 0, rot: 1, scale: 1.2, solid: true, manual: false },
        { kind: 'rocher', variant: 1, x: 100, y: 0, z: 0, rot: 0, scale: 1, solid: false, manual: false },
      ],
      circles: [], segments: [], barriers: [{ x: 0, y: 0, z: 5, rot: 0, len: 2 }],
    };
    const g = buildDecor(env, fakeAssets(), 'haute', false);
    const inst = g.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
    const total = inst.filter((m) => !(m.material as THREE.Material).side || (m.material as THREE.Material).side !== THREE.BackSide).reduce((s, m) => s + m.count, 0);
    expect(total).toBe(4);
  });
  it('CarView suit la pose, les roues avant braquent', () => {
    const v = new CarView(carModel(), '#3a6ff0', false);
    v.update({ x: 5, y: 1, z: -3, heading: 0.5, steer: 0.3, wheelSpin: 1, groundPitch: 0, groundRoll: 0, pitch: 0, roll: 0 });
    expect(v.root.position.x).toBe(5);
    expect(v.root.rotation.y).toBeCloseTo(0.5, 9);
    const rear: THREE.Vector3[] = [new THREE.Vector3(), new THREE.Vector3()];
    v.rearWheels(rear);
    expect(rear[0].distanceTo(new THREE.Vector3(5, 1, -3))).toBeGreaterThan(1);
    v.setColor('#ffffff');
    v.dispose();
  });
});
