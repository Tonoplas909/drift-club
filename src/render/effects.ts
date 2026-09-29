import * as THREE from 'three';
import { mulberry32, type Rng } from '../core/math/rng';
import { toonMaterial } from './materials';

export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number }

/** Réserve circulaire de particules (logique pure, sans three.js). */
export class ParticlePool {
  readonly items: Particle[];
  private next = 0;
  private readonly rng: Rng;

  constructor(readonly capacity: number, seed = 1) {
    this.items = Array.from({ length: capacity }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, size: 1 }));
    this.rng = mulberry32(seed);
  }

  emit(x: number, y: number, z: number, vx: number, vz: number): void {
    const p = this.items[this.next];
    this.next = (this.next + 1) % this.capacity;
    const r = this.rng;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx * 0.3 + (r() - 0.5) * 1.2;
    p.vy = 0.6 + r() * 0.8;
    p.vz = vz * 0.3 + (r() - 0.5) * 1.2;
    p.age = 0;
    p.life = 0.9 + r() * 0.5;
    p.size = 0.7 + r() * 0.5;
  }

  update(dt: number): void {
    const damp = Math.exp(-2.5 * dt);
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.vx *= damp; p.vz *= damp;
      p.vy += 0.4 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }

  alive(): number {
    return this.items.filter((p) => p.age < p.life).length;
  }

  /** Taille affichée : grossit puis se résorbe (bouffées toon opaques, sans transparence). */
  static scaleOf(p: Particle): number {
    if (p.age >= p.life) return 0;
    const t = p.age / p.life;
    return p.size * (0.6 + 2.2 * t) * Math.pow(Math.sin(Math.PI * t), 0.6);
  }
}

export class SmokeSystem {
  readonly mesh: THREE.InstancedMesh;
  private readonly pool: ParticlePool;
  private readonly acc: number[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();

  constructor(capacity: number, color: THREE.ColorRepresentation) {
    this.pool = new ParticlePool(capacity, 11);
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), toonMaterial({ color }), capacity);
    this.mesh.frustumCulled = false;
    this.update(0);
  }

  /** Émet `rate` bouffées par seconde et par point. */
  emit(points: THREE.Vector3[], rate: number, dt: number, vx: number, vz: number): void {
    points.forEach((pt, k) => {
      this.acc[k] = (this.acc[k] ?? 0) + rate * dt;
      while (this.acc[k] >= 1) {
        this.pool.emit(pt.x, pt.y + 0.2, pt.z, vx, vz);
        this.acc[k] -= 1;
      }
    });
  }

  update(dt: number): void {
    this.pool.update(dt);
    this.pool.items.forEach((it, i) => {
      const sc = ParticlePool.scaleOf(it);
      this.s.setScalar(sc);
      this.p.set(it.x, it.y, it.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/** Traces de gomme : anneau de quadrilatères (logique pure). */
export class SkidTrail {
  readonly data: Float32Array;
  count = 0;
  private next = 0;
  private readonly last: ({ x: number; y: number; z: number } | null)[] = [null, null];

  constructor(readonly capacity: number, private readonly width = 0.28) {
    this.data = new Float32Array(capacity * 4 * 3);
  }

  add(wheel: number, x: number, y: number, z: number, active: boolean): number {
    if (!active) { this.last[wheel] = null; return -1; }
    const prev = this.last[wheel];
    if (!prev) { this.last[wheel] = { x, y, z }; return -1; }
    const dx = x - prev.x, dz = z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return -1;
    const hx = (-dz / len) * (this.width / 2), hz = (dx / len) * (this.width / 2);
    const i = this.next;
    const o = i * 12;
    const yA = prev.y + 0.03, yB = y + 0.03;
    this.data.set([prev.x + hx, yA, prev.z + hz, prev.x - hx, yA, prev.z - hz, x + hx, yB, z + hz, x - hx, yB, z - hz], o);
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    this.last[wheel] = { x, y, z };
    return i;
  }

  reset(): void {
    this.data.fill(0);
    this.count = 0;
    this.next = 0;
    this.last[0] = null;
    this.last[1] = null;
  }
}

export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly trail: SkidTrail;
  private readonly attr: THREE.BufferAttribute;

  constructor(capacity: number) {
    this.trail = new SkidTrail(capacity);
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.trail.data, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const idx: number[] = [];
    for (let q = 0; q < capacity; q++) {
      const b = q * 4;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x1a1a1a, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
  }

  add(wheel: number, p: THREE.Vector3, active: boolean): void {
    if (this.trail.add(wheel, p.x, p.y, p.z, active) >= 0) this.attr.needsUpdate = true;
  }

  reset(): void {
    this.trail.reset();
    this.attr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
