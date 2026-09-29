import type { CircleCollider, SegmentCollider } from '../env/types';
import { SampleGrid } from '../track/grid';
import { clamp } from '../math/vec';
import type { CarParams, CarState } from './types';

export const CRASH_IMPACT = 2.5;
const RESTITUTION = 0.3;
const FRICTION_LOSS = 0.2;
const CELL = 8;

export interface CollisionWorld {
  circles: CircleCollider[];
  segments: SegmentCollider[];
  circleGrid: SampleGrid;
  segmentGrid: SampleGrid;
}

export function buildCollisionWorld(env: { circles: CircleCollider[]; segments: SegmentCollider[] }): CollisionWorld {
  const circleGrid = new SampleGrid(CELL);
  const segmentGrid = new SampleGrid(CELL);
  env.circles.forEach((c, i) => circleGrid.add(i, c.x, c.z));
  env.segments.forEach((s, i) => {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    const n = Math.max(1, Math.ceil(len / (CELL / 2)));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      segmentGrid.add(i, s.ax + (s.bx - s.ax) * t, s.az + (s.bz - s.az) * t);
    }
  });
  return { circles: env.circles, segments: env.segments, circleGrid, segmentGrid };
}

const scratch: number[] = [];
let visitStamp = 0;
let segVisited = new Int32Array(0);
let circVisited = new Int32Array(0);

/** Déplace la voiture de `pen` le long de n et applique l'impulsion au point de contact (px, pz). */
function applyContact(car: CarState, px: number, pz: number, nx: number, nz: number, pen: number, m: number, I: number): number {
  car.x += nx * pen;
  car.z += nz * pen;
  const rpx = px - car.x, rpz = pz - car.z;
  const vpx = car.vx + car.yawRate * rpz;
  const vpz = car.vz - car.yawRate * rpx;
  const vn = vpx * nx + vpz * nz;
  if (vn >= 0) return 0;
  const invM = 1 / m, invI = 1 / I;
  const rn = rpz * nx - rpx * nz;
  const j = (-(1 + RESTITUTION) * vn) / (invM + rn * rn * invI);
  car.vx += j * nx * invM;
  car.vz += j * nz * invM;
  car.yawRate += rn * j * invI;
  const tx = -nz, tz = nx;
  const vt = (car.vx + car.yawRate * rpz) * tx + (car.vz - car.yawRate * rpx) * tz;
  const rt = rpz * tx - rpx * tz;
  const jt = (-vt / (invM + rt * rt * invI)) * FRICTION_LOSS;
  car.vx += jt * tx * invM;
  car.vz += jt * tz * invM;
  car.yawRate += rt * jt * invI;
  return -vn;
}

export function resolveCollisions(car: CarState, params: CarParams, world: CollisionWorld): number {
  const rc = params.width / 2;
  const off = Math.max(0, params.length / 2 - rc);
  const m = params.mass;
  const I = m * params.gyration * params.gyration;
  if (segVisited.length < world.segments.length) segVisited = new Int32Array(world.segments.length);
  if (circVisited.length < world.circles.length) circVisited = new Int32Array(world.circles.length);
  let impact = 0;

  for (const o of [off, 0, -off]) {
    const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
    let cx = car.x + fx * o, cz = car.z + fz * o;

    visitStamp++;
    world.circleGrid.query(cx, cz, rc + 3, scratch);
    for (const i of scratch) {
      if (circVisited[i] === visitStamp) continue;
      circVisited[i] = visitStamp;
      const c = world.circles[i];
      const dx = cx - c.x, dz = cz - c.z;
      const d = Math.hypot(dx, dz);
      const pen = rc + c.r - d;
      if (pen <= 0) continue;
      const nx = d > 1e-6 ? dx / d : -fx;
      const nz = d > 1e-6 ? dz / d : -fz;
      impact = Math.max(impact, applyContact(car, cx - nx * rc, cz - nz * rc, nx, nz, pen, m, I));
      cx += nx * pen;
      cz += nz * pen;
    }

    visitStamp++;
    world.segmentGrid.query(cx, cz, rc + 3, scratch);
    for (const i of scratch) {
      if (segVisited[i] === visitStamp) continue;
      segVisited[i] = visitStamp;
      const s = world.segments[i];
      const ex = s.bx - s.ax, ez = s.bz - s.az;
      const len2 = ex * ex + ez * ez;
      const t = len2 > 1e-9 ? clamp(((cx - s.ax) * ex + (cz - s.az) * ez) / len2, 0, 1) : 0;
      const qx = s.ax + ex * t, qz = s.az + ez * t;
      const dx = cx - qx, dz = cz - qz;
      const d = Math.hypot(dx, dz);
      const pen = rc - d;
      if (pen <= 0) continue;
      let nx: number, nz: number;
      if (d > 1e-6) { nx = dx / d; nz = dz / d; }
      else { const l = Math.sqrt(len2) || 1; nx = -ez / l; nz = ex / l; }
      impact = Math.max(impact, applyContact(car, qx, qz, nx, nz, pen, m, I));
      cx += nx * pen;
      cz += nz * pen;
    }
  }
  return impact;
}
