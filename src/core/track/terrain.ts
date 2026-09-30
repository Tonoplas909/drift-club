import type { TrackData, TrackSample } from './buildTrack';
import { Lac, type PlanEau } from '../env/eau';
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
  h: Float32Array; d: Float32Array;
  seed: number; relief: Relief;
}

const FINE_CELL = 4, FINE_R = 64;
const COARSE_CELL = 16, COARSE_R_DEFAUT = 420;
/** Pente maximale (dénivelé / distance) du terrain à partir de l'accotement d'un tronçon de route : talus de déblai ou de remblai. */
const PENTE_TALUS = 1.2;
/** Fenêtre (m) autour de la distance au tronçon le plus proche où les tronçons comptent dans la hauteur « naturelle » du versant. */
const FENETRE = 45;
/** Rayon (m) de recherche des tronçons dont le talus borne la hauteur (au-delà, la grille les respecte déjà). */
const RAYON_CHAUSSEE = 14.5;
/** Deux tronçons à plus de 25 m d'abscisse l'un de l'autre sont deux « branches » de route distinctes (épingles empilées). */
const ECART_BRANCHES = 25;

const scratchTerrain: number[] = [];

/** Multiplicateur du relief : constant, ou variable dans l'espace (transitions du mode Zen). */
export type Relief = number | ((x: number, z: number) => number);

function makeGrid(ox: number, oz: number, cell: number, width: number, depth: number, seed: number, relief: Relief): Grid {
  const nx = Math.ceil(width / cell) + 1;
  const nz = Math.ceil(depth / cell) + 1;
  const h = new Float32Array(nx * nz).fill(Infinity);
  const d = new Float32Array(nx * nz).fill(Infinity);
  return { ox, oz, cell, nx, nz, h, d, seed, relief };
}

/** Facteur de bruit des collines de la case `i` (calculé seulement pour les cases proches de la route). */
function bruitCase(g: Grid, i: number): number {
  const wx = g.ox + (i % g.nx) * g.cell, wz = g.oz + Math.floor(i / g.nx) * g.cell;
  const r = typeof g.relief === 'number' ? g.relief : g.relief(wx, wz);
  return Math.fround((0.35 + 0.65 * fbm(wx / 140, wz / 140, g.seed + 77)) * r);
}

/** Appelle `f(idx, distance)` pour chaque case de la grille à moins de `radius` m du tronçon `sp`. */
function surCases(g: Grid, sp: TrackSample, radius: number, f: (idx: number, dd: number) => void): void {
  const cx0 = Math.max(0, Math.floor((sp.x - radius - g.ox) / g.cell));
  const cx1 = Math.min(g.nx - 1, Math.ceil((sp.x + radius - g.ox) / g.cell));
  const cz0 = Math.max(0, Math.floor((sp.z - radius - g.oz) / g.cell));
  const cz1 = Math.min(g.nz - 1, Math.ceil((sp.z + radius - g.oz) / g.cell));
  for (let cz = cz0; cz <= cz1; cz++) {
    const dz = g.oz + cz * g.cell - sp.z;
    for (let cx = cx0; cx <= cx1; cx++) {
      const dx = g.ox + cx * g.cell - sp.x;
      const dd = Math.sqrt(dx * dx + dz * dz);
      if (dd <= radius) f(cz * g.nx + cx, dd);
    }
  }
}

function surTronçons(track: TrackData, every: number, f: (sp: TrackSample) => void): void {
  const S = track.samples;
  for (let i = 0; i < S.length; i += every) f(S[i]);
  if ((S.length - 1) % every !== 0) f(S[S.length - 1]);
}

/**
 * Hauteur du terrain sur une grille : versant « naturel » (moyenne des hauteurs de route voisines, pondérée par
 * l'inverse du carré de la distance, plus les collines qui montent avec l'éloignement), borné par les talus de CHAQUE
 * tronçon proche (|h − y| ≤ pente × distance). Deux branches de route à des hauteurs différentes se raccordent donc
 * en rampe continue au lieu de falaises ; si l'écart est trop grand pour la pente, on prend le milieu des bornes.
 */
function remplir(g: Grid, track: TrackData, every: number, radius: number): void {
  const n = g.nx * g.nz;
  const ecart = new Float32Array(n).fill(Infinity);
  const bas = new Float32Array(n).fill(-Infinity);
  const haut = new Float32Array(n).fill(Infinity);
  const sw = new Float32Array(n), swy = new Float32Array(n);
  surTronçons(track, every, (sp) => {
    const epaule = sp.w + 1.5;
    surCases(g, sp, radius, (idx, dd) => {
      if (dd < g.d[idx]) g.d[idx] = dd;
      const e = Math.max(0, dd - epaule);
      if (e < ecart[idx]) ecart[idx] = e;
      const dev = PENTE_TALUS * e;
      if (sp.y + dev < haut[idx]) haut[idx] = sp.y + dev;
      if (sp.y - dev > bas[idx]) bas[idx] = sp.y - dev;
    });
  });
  surTronçons(track, every, (sp) => {
    const epaule = sp.w + 1.5;
    surCases(g, sp, radius, (idx, dd) => {
      if (dd - g.d[idx] >= FENETRE) return;
      const e = Math.max(0, dd - epaule);
      const w = (1 - smoothstep(FENETRE * 0.5, FENETRE, dd - g.d[idx])) / (e * e + 4);
      sw[idx] += w; swy[idx] += w * sp.y;
    });
  });
  for (let i = 0; i < n; i++) {
    if (g.d[i] === Infinity) continue;
    const nat = swy[i] / sw[i] + rise(ecart[i], bruitCase(g, i));
    g.h[i] = bas[i] <= haut[i] ? Math.min(haut[i], Math.max(bas[i], nat)) : (bas[i] + haut[i]) / 2;
  }
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

/** Rayon (m) dans lequel chercher les tronçons de route qui bornent le terrain (pour `appliquerTalus`). */
export const RAYON_TALUS = RAYON_CHAUSSEE;

const candTalus: TrackSample[] = [];
const sCandTalus: number[] = [];

/** Hauteur de la chaussée en (x, z) selon le tronçon `sp`, et bornes du talus : au plus `PENTE_TALUS` de dénivelé par mètre au-delà de largeur/2 + 1 m. */
function borne(sp: TrackSample, x: number, z: number, dist: number, out: { y: number; lo: number; hi: number }): void {
  const y = sp.y + sp.grade * ((x - sp.x) * sp.tx + (z - sp.z) * sp.tz);
  const dev = PENTE_TALUS * Math.max(0, dist - (sp.w + 1));
  out.y = y; out.lo = y - dev; out.hi = y + dev;
}

const b1 = { y: 0, lo: 0, hi: 0 };
const b2 = { y: 0, lo: 0, hi: 0 };

/**
 * Hauteur finale à partir de la hauteur « naturelle » `g` et des tronçons candidats (à moins de `RAYON_TALUS`, dans
 * n'importe quel ordre, doublons admis) : bornes des talus des deux branches les plus proches (si elles sont
 * incompatibles, le milieu), puis la chaussée la plus proche impose sa hauteur. `sCand[k]` = abscisse de `cand[k]`
 * dans un repère commun à tous les candidats (sert à distinguer les branches).
 */
export function appliquerTalus(g: number, x: number, z: number, cand: readonly TrackSample[], sCand: ArrayLike<number>, n: number): number {
  let k1 = -1, d1 = Infinity;
  for (let k = 0; k < n; k++) {
    const sp = cand[k];
    const d = (sp.x - x) * (sp.x - x) + (sp.z - z) * (sp.z - z);
    if (d < d1) { d1 = d; k1 = k; }
  }
  if (k1 < 0) return g;
  // 2e branche : tronçon le plus proche parmi ceux qui ne sont pas voisins du premier le long de la route
  let k2 = -1, d2 = Infinity;
  const s1 = sCand[k1];
  for (let k = 0; k < n; k++) {
    if (Math.abs(sCand[k] - s1) < ECART_BRANCHES) continue;
    const sp = cand[k];
    const d = (sp.x - x) * (sp.x - x) + (sp.z - z) * (sp.z - z);
    if (d < d2) { d2 = d; k2 = k; }
  }
  const sp1 = cand[k1];
  borne(sp1, x, z, Math.sqrt(d1), b1);
  let lo = b1.lo, hi = b1.hi;
  if (k2 >= 0) {
    borne(cand[k2], x, z, Math.sqrt(d2), b2);
    lo = Math.max(lo, b2.lo); hi = Math.min(hi, b2.hi);
  }
  const h = lo <= hi ? (g < lo ? lo : g > hi ? hi : g) : (lo + hi) / 2;
  const w = 1 - smoothstep(sp1.w + 1, sp1.w + 3, Math.sqrt(d1));
  return w > 0 ? h + (b1.y - h) * w : h;
}

/** Réglages de la taille des grilles (défaut : niveaux ; le mode Zen réduit la grille grossière). */
export interface OptionsTerrain {
  /** rayon (m) de la grille grossière autour de la route (défaut 420) */
  rayonGrossier?: number;
  /** un tronçon sur `pasGrossier` compte dans la grille grossière (défaut 4) */
  pasGrossier?: number;
}

export class Terrain implements Ground {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  private readonly fine: Grid;
  private readonly coarse: Grid;
  private readonly lacs: Lac[];

  /** `relief` : multiplicateur des reliefs autour de la route (1 = montagne ; < 1 = plaine, thème ville) ; `eau` : lacs (polygones). */
  constructor(private readonly track: TrackData, seed: number, relief: Relief = 1, eau: readonly PlanEau[] = [], opts: OptionsTerrain = {}) {
    this.lacs = eau.map((p) => new Lac(p));
    const b = track.bounds;
    const COARSE_R = opts.rayonGrossier ?? COARSE_R_DEFAUT, MARGIN = COARSE_R + 20;
    this.fine = makeGrid(b.minX - FINE_R, b.minZ - FINE_R, FINE_CELL, b.maxX - b.minX + 2 * FINE_R, b.maxZ - b.minZ + 2 * FINE_R, seed, relief);
    this.coarse = makeGrid(b.minX - MARGIN, b.minZ - MARGIN, COARSE_CELL, b.maxX - b.minX + 2 * MARGIN, b.maxZ - b.minZ + 2 * MARGIN, seed, relief);
    remplir(this.fine, track, 2, FINE_R);
    remplir(this.coarse, track, opts.pasGrossier ?? 4, COARSE_R);
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

  /** Hauteur du terrain : versant + lacs, puis les talus des tronçons voisins (la chaussée impose sa hauteur, le terrain la quitte en pente bornée). */
  heightAt(x: number, z: number): number {
    const S = this.track.samples;
    this.track.grid.query(x, z, RAYON_CHAUSSEE, scratchTerrain);
    const n = scratchTerrain.length;
    for (let k = 0; k < n; k++) {
      const sp = S[scratchTerrain[k]];
      candTalus[k] = sp;
      sCandTalus[k] = sp.s;
    }
    return appliquerTalus(this.hauteurGrille(x, z), x, z, candTalus, sCandTalus, n);
  }

  /** Hauteur « naturelle » du versant (grilles + lacs), avant les talus de la route. */
  hauteurGrille(x: number, z: number): number {
    let g = this.gridHeight(x, z);
    for (const lac of this.lacs) g = lac.hauteur(x, z, g);
    return g;
  }

  /** Hauteur de la surface AFFICHÉE : celle du terrain, 15 cm plus bas sous la chaussée et l'accotement pour ne pas affleurer la route. */
  hauteurRendue(x: number, z: number): number {
    const h = this.heightAt(x, z);
    const near = nearestSampleWithin(this.track, x, z, 14);
    if (!near) return h;
    const w = this.track.samples[near.index].w;
    return h - 0.15 * (1 - smoothstep(w + 0.5, w + 2, near.dist));
  }

  /** Distance signée (m) au lac le plus proche : > 0 dans l'eau, < 0 sur terre, −Infinity sans lac. */
  distanceEau(x: number, z: number): number {
    let best = -Infinity;
    for (const lac of this.lacs) {
      if (!lac.proche(x, z, 80)) continue;
      const d = lac.distance(x, z);
      if (d > best) best = d;
    }
    return best;
  }

  /** Plans d'eau (pour le rendu). */
  get plans(): readonly PlanEau[] { return this.lacs.map((l) => l.plan); }

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
