import * as THREE from 'three';
import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Terrain } from '../core/track/terrain';
import { nearestSampleWithin } from '../core/track/projection';
import { forestMask, forestThreshold } from '../core/env/generate';
import { fbm } from '../core/math/noise';
import { mulberry32 } from '../core/math/rng';
import { smoothstep } from '../core/math/vec';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMaterial } from './materials';
import { epauleDe, type Palette } from './palettes';
import { THEMES } from '../core/env/themes';
import type { QualityLevel } from './quality';

const CHUNK = 128;
const SKIRT = 4;

/** Pas de maille (m) d'un morceau selon sa distance minimale à la route. */
export function chunkStep(dmin: number, q: QualityLevel): number {
  const base = dmin < 40 ? 2 : dmin < 150 ? 4 : 8;
  return q === 'haute' ? base : base * 2;
}

export function buildTerrain(level: Level, track: TrackData, terrain: Terrain, p: Palette, q: QualityLevel): THREE.Group {
  const group = new THREE.Group();
  group.name = 'terrain';
  const mat = toonMaterial({ vertexColors: true });
  mat.side = THREE.DoubleSide;
  const seed = level.decor.graine;
  const thr = forestThreshold(level.decor.densite, THEMES[level.environnement].arbres.seuilMin);
  const cA = new THREE.Color(p.grassA), cB = new THREE.Color(p.grassB), cF = new THREE.Color(p.forestFloor);
  const cR = new THREE.Color(p.rock), cS = epauleDe(p);
  const cT = p.trottoir !== undefined ? new THREE.Color(p.trottoir) : null;
  const c = new THREE.Color();

  for (let z0 = terrain.minZ; z0 < terrain.maxZ; z0 += CHUNK) {
    for (let x0 = terrain.minX; x0 < terrain.maxX; x0 += CHUNK) {
      const dmin = Math.max(0, terrain.distanceToRoad(x0 + CHUNK / 2, z0 + CHUNK / 2) - CHUNK * 0.71);
      const step = chunkStep(dmin, q);
      const n = Math.round(CHUNK / step);
      const N = n + 1;
      const heights = new Float32Array(N * N);
      const roadDist = new Float32Array(N * N).fill(1e9);
      const roadW = new Float32Array(N * N);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const x = x0 + i * step, z = z0 + j * step;
          const k = j * N + i;
          let h = terrain.heightAt(x, z);
          const near = nearestSampleWithin(track, x, z, 14);
          if (near) {
            const w = track.samples[near.index].w;
            roadDist[k] = near.dist;
            roadW[k] = w;
            h -= 0.15 * (1 - smoothstep(w + 0.5, w + 2, near.dist));
          }
          heights[k] = h;
        }
      }
      const vCount = N * N + 4 * N * 2;
      const pos = new Float32Array(vCount * 3);
      const col = new Float32Array(vCount * 3);
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const k = j * N + i;
          const x = x0 + i * step, z = z0 + j * step;
          pos[k * 3] = x; pos[k * 3 + 1] = heights[k]; pos[k * 3 + 2] = z;
          const hx = heights[j * N + Math.min(n, i + 1)] - heights[j * N + Math.max(0, i - 1)];
          const hz = heights[Math.min(n, j + 1) * N + i] - heights[Math.max(0, j - 1) * N + i];
          const slope = Math.max(Math.abs(hx), Math.abs(hz)) / (2 * step);
          c.copy(cA).lerp(cB, fbm(x / 30, z / 30, seed + 5));
          c.lerp(cF, smoothstep(thr, thr + 0.08, forestMask(x, z, seed)) * 0.85);
          c.lerp(cR, smoothstep(0.6, 1.0, slope));
          // trottoir (ville) : bande claire le long de la route, là où se posent lampadaires et mobilier
          if (cT && roadDist[k] < 1e8) c.lerp(cT, 1 - smoothstep(roadW[k] + 3.6, roadW[k] + 4.8, roadDist[k]));
          if (roadDist[k] < 1e8) c.lerp(cS, 1 - smoothstep(roadW[k] + 0.5, roadW[k] + 1.5, roadDist[k]));
          col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
        }
      }
      const idx: number[] = [];
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const a = j * N + i, b = a + 1, cc = a + N, d = cc + 1;
          idx.push(a, cc, b, b, cc, d);
        }
      }
      // Jupes (bords qui descendent de 4 m) : cachent les fentes entre morceaux de mailles différentes
      let v = N * N;
      const edges: number[][] = [
        Array.from({ length: N }, (_, i) => i),
        Array.from({ length: N }, (_, i) => n * N + i),
        Array.from({ length: N }, (_, j) => j * N),
        Array.from({ length: N }, (_, j) => j * N + n),
      ];
      for (const e of edges) {
        const top0 = v;
        for (const k of e) {
          pos.set([pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]], v * 3);
          col.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], v * 3);
          pos.set([pos[k * 3], pos[k * 3 + 1] - SKIRT, pos[k * 3 + 2]], (v + N) * 3);
          col.set([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], (v + N) * 3);
          v++;
        }
        for (let t = 0; t < N - 1; t++) {
          const a = top0 + t, b = top0 + t + 1, a2 = a + N, b2 = b + N;
          idx.push(a, a2, b, b, a2, b2);
        }
        v += N;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      mesh.userData.center = new THREE.Vector3(x0 + CHUNK / 2, 0, z0 + CHUNK / 2);
      group.add(mesh);
    }
  }
  return group;
}

/** Anneau de reliefs lointains (sans brouillard, couleurs déjà « noyées » dans la brume) : montagnes ou mesas selon la palette. */
export function buildMountains(track: TrackData, p: Palette, seed: number): THREE.Mesh {
  if (p.reliefs.forme === 'ville') return buildSkyline(track, p, seed);
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 700;
  const lowest = track.samples.reduce((m, s) => Math.min(m, s.y), Infinity);
  const rng = mulberry32(seed + 3);
  const fog = new THREE.Color(p.fog);
  const rel = p.reliefs;
  const rock = new THREE.Color(rel.roche).lerp(fog, 0.55);
  const snow = new THREE.Color(rel.cime).lerp(fog, 0.35);
  const mesas = rel.forme === 'mesas';
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + rng() * 0.1;
    const r = R + rng() * 250;
    const h = mesas ? 90 + rng() * 130 : 180 + rng() * 260;
    const rad = 160 + rng() * 140;
    const sides = 6 + Math.floor(rng() * 3);
    // mesa : flancs raides et sommet plat ; montagne : cône pointu
    const g = (mesas ? new THREE.CylinderGeometry(rad * 0.5, rad * 0.9, h, sides, 1) : new THREE.ConeGeometry(rad, h, sides, 1)).toNonIndexed();
    g.deleteAttribute('uv');
    const base = lowest - 30;
    g.translate(cx + Math.sin(a) * r, base + h / 2, cz + Math.cos(a) * r);
    const pos = g.getAttribute('position');
    const col = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      const cc = pos.getY(k) > base + h * rel.ligne ? snow : rock;
      col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  const mat = toonMaterial({ vertexColors: true });
  mat.fog = false;
  (mat as any).flatShading = true;
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = 'montagnes';
  return mesh;
}

/** Silhouettes d'immeubles et de tours en anneau (fond de la ville, sans brouillard, couleurs noyées dans la brume) : deux rangs de blocs. */
export function buildSkyline(track: TrackData, p: Palette, seed: number): THREE.Mesh {
  const b = track.bounds;
  const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
  const R = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + 520;
  const lowest = track.samples.reduce((m, s) => Math.min(m, s.y), Infinity);
  const rng = mulberry32(seed + 5);
  const fog = new THREE.Color(p.fog);
  const mur = new THREE.Color(p.reliefs.roche).lerp(fog, 0.5);
  const clair = new THREE.Color(p.reliefs.cime).lerp(fog, 0.4);
  const parts: THREE.BufferGeometry[] = [];
  const bloc = (x: number, z: number, w: number, d: number, h: number, base: number, teinte: number): void => {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    g.deleteAttribute('uv');
    g.translate(x, base + h / 2, z);
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      // toit et bande haute plus clairs, faces alternées pour le relief
      const haut = nor.getY(k) > 0.5 || pos.getY(k) > base + h - 4;
      c.copy(haut ? clair : mur).multiplyScalar(teinte * (Math.abs(nor.getX(k)) > 0.5 ? 0.9 : 1));
      col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  };
  const base = lowest - 30;
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + rng() * 0.08, r = R + rng() * 120;
    bloc(cx + Math.sin(a) * r, cz + Math.cos(a) * r, 40 + rng() * 60, 40 + rng() * 60, 60 + rng() * 120, base, 0.92 + rng() * 0.1);
  }
  for (let i = 0; i < 52; i++) {
    const a = ((i + 0.5) / 52) * Math.PI * 2 + rng() * 0.08, r = R + 260 + rng() * 200;
    bloc(cx + Math.sin(a) * r, cz + Math.cos(a) * r, 60 + rng() * 90, 60 + rng() * 90, 110 + rng() * 210, base, 0.86 + rng() * 0.1);
  }
  const mat = toonMaterial({ vertexColors: true });
  mat.fog = false;
  (mat as any).flatShading = true;
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = 'montagnes';
  return mesh;
}
