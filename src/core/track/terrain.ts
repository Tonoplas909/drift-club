import type { TrackData, TrackSample } from './buildTrack';
import { nearestSampleWithin } from './projection';
import { fbm } from '../math/noise';
import { clamp, lerp, smoothstep } from '../math/vec';

export interface Ground {
  heightAt(x: number, z: number): number;
  gradientAt(x: number, z: number): { gx: number; gz: number };
}

/** Élévation du terrain à `e` mètres au-delà de l'accotement ; `n` = facteur de bruit (0,35..1). */
export function rise(e: number, n: number): number {
  if (e <= 0) return 0;
  const a = Math.min(e, 10);
  const b = Math.max(0, e - 10);
  return Math.min(250, (0.02 * a * a + 0.4 * b + 0.0015 * b * b) * n);
}

interface Grid {
  ox: number; oz: number; cell: number; nx: number; nz: number;
  h: Float32Array; d: Float32Array; noise: Float32Array;
}

const FINE_CELL = 4, FINE_R = 64;
const COARSE_CELL = 16, COARSE_R = 420, MARGIN = 440;

function makeGrid(ox: number, oz: number, cell: number, width: number, depth: number, seed: number, relief: number): Grid {
  const nx = Math.ceil(width / cell) + 1;
  const nz = Math.ceil(depth / cell) + 1;
  const h = new Float32Array(nx * nz).fill(Infinity);
  const d = new Float32Array(nx * nz).fill(Infinity);
  const noise = new Float32Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const wx = ox + ix * cell, wz = oz + iz * cell;
      noise[iz * nx + ix] = (0.35 + 0.65 * fbm(wx / 140, wz / 140, seed + 77)) * relief;
    }
  }
  return { ox, oz, cell, nx, nz, h, d, noise };
}

function stampOne(g: Grid, sp: TrackSample, radius: number): void {
  const shoulder = sp.w + 1.5;
  const cx0 = Math.max(0, Math.floor((sp.x - radius - g.ox) / g.cell));
  const cx1 = Math.min(g.nx - 1, Math.ceil((sp.x + radius - g.ox) / g.cell));
  const cz0 = Math.max(0, Math.floor((sp.z - radius - g.oz) / g.cell));
  const cz1 = Math.min(g.nz - 1, Math.ceil((sp.z + radius - g.oz) / g.cell));
  for (let cz = cz0; cz <= cz1; cz++) {
    const dz = g.oz + cz * g.cell - sp.z;
    for (let cx = cx0; cx <= cx1; cx++) {
      const dx = g.ox + cx * g.cell - sp.x;
      const dd = Math.sqrt(dx * dx + dz * dz);
      if (dd > radius) continue;
      const idx = cz * g.nx + cx;
      if (dd < g.d[idx]) g.d[idx] = dd;
      const hh = sp.y + rise(dd - shoulder, g.noise[idx]);
      if (hh < g.h[idx]) g.h[idx] = hh;
    }
  }
}

function stamp(g: Grid, track: TrackData, every: number, radius: number): void {
  const S = track.samples;
  for (let i = 0; i < S.length; i += every) stampOne(g, S[i], radius);
  if ((S.length - 1) % every !== 0) stampOne(g, S[S.length - 1], radius);
}

/** Interpolation bilinéaire ; NaN hors grille ou si un coin n'a pas de valeur. */
function bilinear(g: Grid, arr: Float32Array, x: number, z: number): number {
  const fx = (x - g.ox) / g.cell, fz = (z - g.oz) / g.cell;
  const ix = Math.floor(fx), iz = Math.floor(fz);
  if (ix < 0 || iz < 0 || ix >= g.nx - 1 || iz >= g.nz - 1) return NaN;
  const tx = fx - ix, tz = fz - iz;
  const i00 = iz * g.nx + ix;
  const a = arr[i00], b = arr[i00 + 1], c = arr[i00 + g.nx], d = arr[i00 + g.nx + 1];
  if (!(a < Infinity && b < Infinity && c < Infinity && d < Infinity)) return NaN;
  return (a + (b - a) * tx) * (1 - tz) + (c + (d - c) * tx) * tz;
}

export class Terrain implements Ground {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  private readonly fine: Grid;
  private readonly coarse: Grid;

  /** `relief` : multiplicateur des reliefs autour de la route (1 = montagne ; < 1 = plaine, thème ville). */
  constructor(private readonly track: TrackData, seed: number, relief = 1) {
    const b = track.bounds;
    this.fine = makeGrid(b.minX - FINE_R, b.minZ - FINE_R, FINE_CELL, b.maxX - b.minX + 2 * FINE_R, b.maxZ - b.minZ + 2 * FINE_R, seed, relief);
    this.coarse = makeGrid(b.minX - MARGIN, b.minZ - MARGIN, COARSE_CELL, b.maxX - b.minX + 2 * MARGIN, b.maxZ - b.minZ + 2 * MARGIN, seed, relief);
    stamp(this.fine, track, 2, FINE_R);
    stamp(this.coarse, track, 8, COARSE_R);
    let maxH = -Infinity;
    for (const h of this.coarse.h) if (h < Infinity && h > maxH) maxH = h;
    for (let i = 0; i < this.coarse.h.length; i++) {
      if (this.coarse.h[i] === Infinity) { this.coarse.h[i] = maxH; this.coarse.d[i] = 1000; }
    }
    this.minX = this.coarse.ox;
    this.minZ = this.coarse.oz;
    this.maxX = this.coarse.ox + (this.coarse.nx - 1) * COARSE_CELL;
    this.maxZ = this.coarse.oz + (this.coarse.nz - 1) * COARSE_CELL;
  }

  private coarseAt(arr: Float32Array, x: number, z: number): number {
    const cx = clamp(x, this.minX, this.maxX - 1e-3);
    const cz = clamp(z, this.minZ, this.maxZ - 1e-3);
    return bilinear(this.coarse, arr, cx, cz);
  }

  private gridHeight(x: number, z: number): number {
    const coarse = this.coarseAt(this.coarse.h, x, z);
    const f = bilinear(this.fine, this.fine.h, x, z);
    if (Number.isNaN(f)) return coarse;
    const fd = bilinear(this.fine, this.fine.d, x, z);
    return lerp(f, coarse, smoothstep(44, 60, fd));
  }

  heightAt(x: number, z: number): number {
    const g = this.gridHeight(x, z);
    const near = nearestSampleWithin(this.track, x, z, 14);
    if (!near) return g;
    const sp = this.track.samples[near.index];
    const along = (x - sp.x) * sp.tx + (z - sp.z) * sp.tz;
    const roadY = sp.y + sp.grade * along;
    return lerp(roadY, g, smoothstep(sp.w + 1, sp.w + 3, near.dist));
  }

  gradientAt(x: number, z: number): { gx: number; gz: number } {
    const e = 0.5;
    return {
      gx: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      gz: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    };
  }

  /** Distance approximative (±2 m) à l'axe de la route. */
  distanceToRoad(x: number, z: number): number {
    const f = bilinear(this.fine, this.fine.d, x, z);
    if (!Number.isNaN(f)) return f;
    return this.coarseAt(this.coarse.d, x, z);
  }
}
