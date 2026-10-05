import type { Level } from '../level/types';
import { clamp, wrapAngle } from '../math/vec';
import { sampleRoute, type P4 } from './spline';
import { SampleGrid } from './grid';
import * as dm from '../math/dmath';

export interface TrackSample {
  x: number; y: number; z: number;
  /** tangente horizontale unitaire */
  tx: number; tz: number;
  /** normale gauche unitaire = (tz, −tx) */
  nx: number; nz: number;
  /** demi-largeur de la route (m) */
  w: number;
  /** abscisse curviligne (m) */
  s: number;
  /** courbure signée (1/m), + = virage à gauche */
  k: number;
  /** pente dy/ds */
  grade: number;
}

export interface CurbRange { from: number; to: number }

export interface TrackData {
  samples: TrackSample[];
  length: number;
  targetTime: number;
  curbs: CurbRange[];
  pointSample: number[];
  grid: SampleGrid;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

const STEP = 1;
const A_LAT = 8;
const V_MIN = 12;
const V_MAX = 30;
const CURB_K = 1 / 40;

export function buildTrack(level: Level): TrackData {
  const pts: P4[] = level.route.map((p) => ({ x: p.x, y: p.y, z: p.z, l: p.l }));
  const { samples: raw, pointS } = sampleRoute(pts, STEP);
  const n = raw.length;
  const samples: TrackSample[] = raw.map((r) => ({
    x: r.x, y: r.y, z: r.z, tx: 0, tz: 1, nx: 1, nz: 0, w: clamp(r.l, 6, 20) / 2, s: r.s, k: 0, grade: 0,
  }));

  // Tangentes, normales, pente
  for (let i = 0; i < n; i++) {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dz = b.z - a.z;
    const len = dm.hypot(dx, dz) || 1;
    const sp = samples[i];
    sp.tx = dx / len; sp.tz = dz / len;
    sp.nx = sp.tz; sp.nz = -sp.tx;
    const ds = b.s - a.s;
    sp.grade = ds > 1e-9 ? (b.y - a.y) / ds : 0;
  }

  // Courbure : variation de cap sur ±2 échantillons, puis moyenne glissante sur 5
  const heading = samples.map((sp) => dm.atan2(sp.tx, sp.tz));
  const rawK = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 2), i1 = Math.min(n - 1, i + 2);
    const ds = samples[i1].s - samples[i0].s;
    rawK[i] = ds > 1e-9 ? wrapAngle(heading[i1] - heading[i0]) / ds : 0;
  }
  for (let i = 0; i < n; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(n - 1, i + 2); j++) { sum += rawK[j]; cnt++; }
    samples[i].k = sum / cnt;
  }

  return finirPiste(samples, pointS.map((s) => Math.min(n - 1, Math.round(s / STEP))));
}

/**
 * Complète une piste à partir d'échantillons déjà calculés (position, tangente, largeur, courbure, pente ; `s` croissant
 * depuis 0, pas de 1 m) : temps cible, vibreurs, grille spatiale, emprise. Sert aussi aux tronçons du mode Zen.
 */
export function finirPiste(samples: TrackSample[], pointSample: number[] = []): TrackData {
  const n = samples.length;
  // Temps cible (spec §5.2)
  let targetTime = 0;
  for (let i = 1; i < n; i++) {
    const k = Math.abs(samples[i].k);
    const vref = k > 1e-9 ? clamp(Math.sqrt(A_LAT / k), V_MIN, V_MAX) : V_MAX;
    targetTime += (samples[i].s - samples[i - 1].s) / vref;
  }

  // Vibreurs : zones de rayon < 40 m d'au moins 5 m, prolongées de 3 m, fusionnées
  const curbs: CurbRange[] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const tight = i < n && Math.abs(samples[i].k) > CURB_K;
    if (tight && start < 0) start = i;
    if (!tight && start >= 0) {
      if (i - start >= 5) {
        const from = Math.max(0, start - 3), to = Math.min(n - 1, i - 1 + 3);
        const last = curbs[curbs.length - 1];
        if (last && from <= last.to) last.to = to;
        else curbs.push({ from, to });
      }
      start = -1;
    }
  }

  const grid = new SampleGrid(16);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  samples.forEach((sp, i) => {
    grid.add(i, sp.x, sp.z);
    minX = Math.min(minX, sp.x); maxX = Math.max(maxX, sp.x);
    minZ = Math.min(minZ, sp.z); maxZ = Math.max(maxZ, sp.z);
  });

  return { samples, length: samples[n - 1].s, targetTime, curbs, pointSample, grid, bounds: { minX, maxX, minZ, maxZ } };
}
