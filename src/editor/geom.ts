import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import { nearestSampleWithin } from '../core/track/projection';
import { coteExterieur } from '../core/env/generate';
import { nearestSegment } from '../core/editor/ops';
import { clamp } from '../core/math/vec';

/** Vue de dessus : (cx, cz) est le point monde au centre de l'écran, `scale` en pixels par mètre. */
export interface Vue2D { cx: number; cz: number; scale: number }

export const ECHELLE_MIN = 0.08;
export const ECHELLE_MAX = 40;

/** x vers la droite, z vers le bas de l'écran (vue depuis le dessus, sans miroir). */
export function mondeVersEcran(v: Vue2D, w: number, h: number, x: number, z: number): { sx: number; sy: number } {
  return { sx: (x - v.cx) * v.scale + w / 2, sy: (z - v.cz) * v.scale + h / 2 };
}

export function ecranVersMonde(v: Vue2D, w: number, h: number, sx: number, sy: number): { x: number; z: number } {
  return { x: (sx - w / 2) / v.scale + v.cx, z: (sy - h / 2) / v.scale + v.cz };
}

/** Zoom qui garde fixe le point monde situé sous (sx, sy). */
export function zoomAutour(v: Vue2D, w: number, h: number, sx: number, sy: number, facteur: number): Vue2D {
  const scale = clamp(v.scale * facteur, ECHELLE_MIN, ECHELLE_MAX);
  const m = ecranVersMonde(v, w, h, sx, sy);
  return { scale, cx: m.x - (sx - w / 2) / scale, cz: m.z - (sy - h / 2) / scale };
}

/** Déplace la vue de (dsx, dsy) pixels (la scène suit le doigt). */
export function deplacer(v: Vue2D, dsx: number, dsy: number): Vue2D {
  return { ...v, cx: v.cx - dsx / v.scale, cz: v.cz - dsy / v.scale };
}

export interface Bornes { minX: number; maxX: number; minZ: number; maxZ: number }

/** Bornes de tout ce qui se voit : route (échantillons et points) et objets. */
export function bornesNiveau(level: Level, track: TrackData | null): Bornes {
  let b: Bornes = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
  const add = (x: number, z: number, r = 0): void => {
    b = { minX: Math.min(b.minX, x - r), maxX: Math.max(b.maxX, x + r), minZ: Math.min(b.minZ, z - r), maxZ: Math.max(b.maxZ, z + r) };
  };
  for (const p of level.route) add(p.x, p.z, p.l / 2);
  for (const o of level.objets) add(o.x, o.z, 2);
  if (track) add(track.bounds.minX, track.bounds.minZ), add(track.bounds.maxX, track.bounds.maxZ);
  if (!Number.isFinite(b.minX)) return { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
  return b;
}

/** Vue qui montre les bornes entières avec une marge en pixels. */
export function cadrer(b: Bornes, w: number, h: number, marge = 60): Vue2D {
  const bw = Math.max(40, b.maxX - b.minX), bh = Math.max(40, b.maxZ - b.minZ);
  const scale = clamp(Math.min(Math.max(50, w - 2 * marge) / bw, Math.max(50, h - 2 * marge) / bh), ECHELLE_MIN, ECHELLE_MAX);
  return { scale, cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2 };
}

/** Pas de grille (1, 2, 5 × 10^n mètres) pour que deux lignes soient espacées d'au moins `minPx`. */
export function pasGrille(scale: number, minPx = 48): number {
  const raw = minPx / scale;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

/** Longueur ronde (en m) de l'échelle et sa largeur en pixels. */
export function echelleGraphique(scale: number, cibleMax = 120): { metres: number; px: number } {
  const metres = nice(cibleMax / scale);
  return { metres, px: metres * scale };
}

/** Plus grande valeur 1, 2, 5 × 10^n inférieure ou égale à x. */
function nice(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p;
}

/** Pas d'échantillonnage pour le dessin (échantillons de 1 m) : pas plus fin que ~2 px. */
export function pasEchantillons(scale: number): number {
  return Math.max(1, Math.floor(2 / scale));
}

/** Numéro de tronçon (point i → i+1) auquel appartient l'échantillon d'indice `idx`. */
export function segmentDeEchantillon(track: TrackData, idx: number): number {
  const ps = track.pointSample;
  let seg = 0;
  for (let i = 0; i < ps.length - 1; i++) if (ps[i] <= idx) seg = i;
  return seg;
}

export interface ChoixRoute { seg: number; x: number; z: number; cote: 'gauche' | 'droite'; dist: number }

/**
 * Tronçon de route sous (x, z) : d'après la vraie courbe si elle existe (largeur/2 + marge),
 * sinon d'après le polygone des points de contrôle.
 */
export function choisirRoute(level: Level, track: TrackData | null, x: number, z: number, marge: number): ChoixRoute | null {
  if (track) {
    const ns = nearestSampleWithin(track, x, z, 60);
    if (!ns) return null;
    const sp = track.samples[ns.index];
    if (ns.dist > sp.w + marge) return null;
    const lateral = (x - sp.x) * sp.nx + (z - sp.z) * sp.nz;
    return { seg: segmentDeEchantillon(track, ns.index), x: sp.x, z: sp.z, cote: lateral < 0 ? 'droite' : 'gauche', dist: ns.dist };
  }
  const r = nearestSegment(level, x, z, marge + 10);
  if (!r) return null;
  const a = level.route[r.seg], b = level.route[r.seg + 1];
  return { seg: r.seg, x: a.x + (b.x - a.x) * r.t, z: a.z + (b.z - a.z) * r.t, cote: r.cote, dist: r.dist };
}

/** Ramène (x, z) à une distance de `prev` comprise entre `min` et `max` (même direction). */
export function limiterDistance(prev: { x: number; z: number }, x: number, z: number, min: number, max: number): { x: number; z: number } {
  let dx = x - prev.x, dz = z - prev.z;
  let d = Math.hypot(dx, dz);
  if (d < 1e-6) { dx = 0; dz = 1; d = 1; }
  const k = clamp(d, min, max) / d;
  return { x: prev.x + dx * k, z: prev.z + dz * k };
}

export interface TronconBarriere { side: number; from: number; to: number }

/**
 * Bords où se trouve une barrière : mêmes règles que la génération du décor
 * (les côtés « ext » suivent l'extérieur du virage via `coteExterieur`).
 * Chaque tronçon renvoyé va des échantillons `from` à `to`, sur le côté `side` (+1 gauche, −1 droite).
 */
export function troncons(track: TrackData, b: { de: number; a: number; cote: string }): TronconBarriere[] {
  const S = track.samples;
  const i0 = track.pointSample[b.de], i1 = track.pointSample[b.a];
  const out: TronconBarriere[] = [];
  let extSide = 1;
  const push = (side: number, from: number, to: number): void => {
    const last = [...out].reverse().find((t) => t.side === side);
    if (last && last.to === from) last.to = to;
    else out.push({ side, from, to });
  };
  for (let i = i0; i < i1; i += 2) {
    const j = Math.min(i + 2, i1);
    let sides: number[];
    if (b.cote === 'gauche') sides = [1];
    else if (b.cote === 'droite') sides = [-1];
    else if (b.cote === 'deux') sides = [1, -1];
    else { extSide = coteExterieur(S[i].k, extSide); sides = [extSide]; }
    for (const s of sides) push(s, i, j);
  }
  return out;
}

/** Cap (rot en degrés) → vecteur unitaire (x, z), comme dans le décor : (sin, cos). */
export function directionRot(rotDeg: number): { x: number; z: number } {
  const r = (rotDeg * Math.PI) / 180;
  return { x: Math.sin(r), z: Math.cos(r) };
}
