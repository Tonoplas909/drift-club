import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { toonGradient, toonMaterial, outlineGeometry, outlineMaterial } from '../../src/render/materials';
import { coloredBox, wheelGeometry, borneGeometry, chevronGeometry, barrierGeometry, tireStack } from '../../src/render/procedural';
import { buildJdmCar, CAR_SHAPES, PAINT, bodyProfile } from '../../src/render/jdmCars';
import { bakeMesh, normalizeGeometry, paintGeometry, decorKey } from '../../src/render/assets';
import { CARS, CAR_IDS } from '../../src/core/physics/cars';

const finite = (g: THREE.BufferGeometry) => Array.from(g.getAttribute('position').array as Float32Array).every(Number.isFinite);
const bbox = (g: THREE.BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!; };
const countColor = (g: THREE.BufferGeometry, c: THREE.Color) => {
  const col = g.getAttribute('color');
  let n = 0;
  for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - c.r) + Math.abs(col.getY(i) - c.g) + Math.abs(col.getZ(i) - c.b) < 1e-3) n++;
  return n;
};

describe('matériaux', () => {
  it('rampe toon 3 tons', () => {
    const t = toonGradient();
    expect(t.image.width).toBe(3);
    expect(t.minFilter).toBe(THREE.NearestFilter);
    expect(toonMaterial({ vertexColors: true }).gradientMap).toBe(t);
  });
  it('contour : normales lissées (moyennes par position)', () => {
    const g = outlineGeometry(new THREE.BoxGeometry(1, 1, 1));
    const n = g.getAttribute('normal');
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(n.getX(i))).toBeCloseTo(1 / Math.sqrt(3), 4);
      expect(Math.sign(n.getX(i))).toBe(Math.sign(p.getX(i)));
    }
    expect(outlineMaterial(0.05).side).toBe(THREE.BackSide);
  });
});

describe('géométries procédurales', () => {
  it('ont des couleurs, pas d\'UV, des positions finies', () => {
    for (const g of [coloredBox(1, 2, 3, 0, 0, 0, 0xff0000), wheelGeometry(0.32, 0.24), borneGeometry(), chevronGeometry(), barrierGeometry()]) {
      expect(g.getAttribute('color')).toBeDefined();
      expect(g.getAttribute('uv')).toBeUndefined();
      expect(finite(g)).toBe(true);
    }
  });
  it('roue : diamètre 2r, axe selon x', () => {
    const b = bbox(wheelGeometry(0.32, 0.24));
    expect(b.max.y - b.min.y).toBeGreaterThan(0.6);
    expect(b.max.y - b.min.y).toBeLessThan(0.66);
    expect(b.max.x - b.min.x).toBeLessThan(0.35);
  });
  it('borne ≈ 0,9 m de haut, barrière d\'1 m de long sur z', () => {
    expect(bbox(borneGeometry()).max.y).toBeGreaterThan(0.85);
    const r = bbox(barrierGeometry());
    expect(r.max.z - r.min.z).toBeCloseTo(1, 2);
  });
  it('pile de 3 pneus couchés, posée au sol', () => {
    const b = bbox(tireStack(wheelGeometry(0.375, 0.3)));
    expect(b.max.y - b.min.y).toBeGreaterThan(0.85);
    expect(b.max.y - b.min.y).toBeLessThan(1.1);
    expect(b.min.y).toBeCloseTo(0, 5);
  });
});

describe('voitures JDM', () => {
  for (const id of CAR_IDS) {
    it(`${id} : dimensions, peinture, roues aux essieux de la physique`, () => {
      const s = CAR_SHAPES[id];
      const car = buildJdmCar(s);
      expect(finite(car.body)).toBe(true);
      const b = bbox(car.body);
      expect(b.max.z - b.min.z).toBeGreaterThan(s.length - 0.05);
      expect(b.max.z - b.min.z).toBeLessThan(s.length + 0.2);
      expect(b.max.x - b.min.x).toBeLessThan(s.width + 0.1);
      expect(b.min.y).toBeGreaterThan(0.1);
      expect(b.max.y).toBeGreaterThan(s.roofY);
      expect(countColor(car.body, PAINT)).toBeGreaterThan(20);
      expect(car.wheels.length).toBe(4);
      const fl = car.wheels.find((w) => w.front && w.left)!;
      expect(fl.position.z).toBeCloseTo(CARS[id].cgToFront, 5);
      expect(fl.position.x).toBeGreaterThan(0);
      const rear = car.wheels.find((w) => !w.front)!;
      expect(rear.position.z).toBeCloseTo(CARS[id].cgToFront - CARS[id].wheelbase, 5);
      expect(Math.abs(s.length - CARS[id].length)).toBeLessThan(1e-9);
    });
  }
  it('profil de caisse fermé et fini', () => {
    const p = bodyProfile(CAR_SHAPES.turbo);
    expect(p.length).toBeGreaterThan(15);
    expect(p.every(([z, y]) => Number.isFinite(z) && Number.isFinite(y))).toBe(true);
  });
  it('paintGeometry : repeint seulement la peinture, sans toucher l\'original', () => {
    const car = buildJdmCar(CAR_SHAPES.equilibree);
    const blue = new THREE.Color(0x3a6ff0);
    const before = countColor(car.body, PAINT);
    const out = paintGeometry(car.body, PAINT, blue);
    expect(countColor(out, PAINT)).toBe(0);
    expect(countColor(out, blue)).toBe(before);
    expect(countColor(car.body, PAINT)).toBe(before);
  });
});

describe('préparation des modèles de décor', () => {
  it('bakeMesh : couleur du matériau et matrice appliquées', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    const g = bakeMesh(mesh, new THREE.Matrix4().makeTranslation(0, 5, 0));
    const c = g.getAttribute('color');
    expect(c.getX(0)).toBeCloseTo(1, 5);
    expect(c.getY(0)).toBeCloseTo(0, 5);
    expect(bbox(g).min.y).toBeCloseTo(4.5, 5);
    expect(g.index).toBeNull();
  });
  it('normalizeGeometry : taille visée, base au sol, centrée', () => {
    const bb = bbox(normalizeGeometry(new THREE.BoxGeometry(2, 4, 2).translate(10, 3, -7), 8, 'y'));
    expect(bb.max.y - bb.min.y).toBeCloseTo(8, 5);
    expect(bb.min.y).toBeCloseTo(0, 5);
    expect((bb.min.x + bb.max.x) / 2).toBeCloseTo(0, 5);
    expect((bb.min.z + bb.max.z) / 2).toBeCloseTo(0, 5);
  });
  it('decorKey', () => {
    expect(decorKey('sapin', 2)).toBe('sapin2');
  });
});
