import { lerp } from '../math/vec';

export interface P4 { x: number; y: number; z: number; l: number }

function knot(t: number, a: P4, b: P4): number {
  const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  return t + Math.max(Math.sqrt(d), 1e-4);
}

function mix(a: P4, b: P4, ta: number, tb: number, t: number): P4 {
  const wa = (tb - t) / (tb - ta);
  const wb = (t - ta) / (tb - ta);
  return { x: a.x * wa + b.x * wb, y: a.y * wa + b.y * wb, z: a.z * wa + b.z * wb, l: a.l * wa + b.l * wb };
}

/** Catmull-Rom centripète (alpha = 0,5) sur le segment p1 → p2, u dans [0, 1]. */
export function catmullRomCentripetal(p0: P4, p1: P4, p2: P4, p3: P4, u: number): P4 {
  const t0 = 0;
  const t1 = knot(t0, p0, p1);
  const t2 = knot(t1, p1, p2);
  const t3 = knot(t2, p2, p3);
  const t = t1 + (t2 - t1) * u;
  const a1 = mix(p0, p1, t0, t1, t);
  const a2 = mix(p1, p2, t1, t2, t);
  const a3 = mix(p2, p3, t2, t3, t);
  const b1 = mix(a1, a2, t0, t2, t);
  const b2 = mix(a2, a3, t1, t3, t);
  return mix(b1, b2, t1, t2, t);
}

const extrapolate = (a: P4, b: P4): P4 => ({ x: 2 * a.x - b.x, y: 2 * a.y - b.y, z: 2 * a.z - b.z, l: a.l });

/**
 * Échantillonne la courbe passant par tous les points, à pas constant (longueur 3D).
 * pointS[i] = abscisse du point de passage i.
 */
export function sampleRoute(points: P4[], step: number): { samples: (P4 & { s: number })[]; pointS: number[] } {
  const n = points.length;
  const ext = [extrapolate(points[0], points[1]), ...points, extrapolate(points[n - 1], points[n - 2])];
  const SUB = 32;
  const dense: P4[] = [];
  const pointDense: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    pointDense.push(dense.length);
    for (let k = 0; k < SUB; k++) dense.push(catmullRomCentripetal(ext[i], ext[i + 1], ext[i + 2], ext[i + 3], k / SUB));
  }
  pointDense.push(dense.length);
  dense.push({ ...points[n - 1] });

  const cum = new Float64Array(dense.length);
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i];
    cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }
  const total = cum[dense.length - 1];
  const pointS = pointDense.map((i) => cum[i]);

  const targets: number[] = [];
  const count = Math.floor(total / step + 1e-9);
  for (let k = 0; k <= count; k++) targets.push(k * step);
  if (total - count * step > 0.01) targets.push(total);

  const samples: (P4 & { s: number })[] = [];
  let j = 0;
  for (const t of targets) {
    while (j < dense.length - 2 && cum[j + 1] < t) j++;
    const seg = cum[j + 1] - cum[j];
    const u = seg > 1e-9 ? Math.min(1, Math.max(0, (t - cum[j]) / seg)) : 0;
    const a = dense[j], b = dense[j + 1];
    samples.push({ x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), z: lerp(a.z, b.z, u), l: lerp(a.l, b.l, u), s: t });
  }
  return { samples, pointS };
}
