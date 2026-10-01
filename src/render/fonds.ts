import * as THREE from 'three';
import type { TrackData } from '../core/track/buildTrack';
import { mulberry32, type Rng } from '../core/math/rng';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toonMaterial } from './materials';
import type { Palette } from './palettes';

/**
 * Fonds lointains des thèmes (sans brouillard, couleurs déjà noyées dans la brume) : îles et galion (pirate), panneaux de murs
 * sans fin (backrooms), collines lunaires (espace), collines et volcan enneigé (japon).
 */

interface Cadre { cx: number; cz: number; R: number; base: number; fog: THREE.Color }

function cadre(track: TrackData, p: Palette, marge: number): Cadre {
  const b = track.bounds;
  return {
    cx: (b.minX + b.maxX) / 2, cz: (b.minZ + b.maxZ) / 2,
    R: Math.max(b.maxX - b.minX, b.maxZ - b.minZ) / 2 + marge,
    base: track.samples.reduce((m, s) => Math.min(m, s.y), Infinity) - 30,
    fog: new THREE.Color(p.fog),
  };
}

/** Géométrie non indexée sans uv dont chaque sommet reçoit la couleur donnée par `f(x, y, z, nx, ny, nz)` (coordonnées monde). */
function coloree(g: THREE.BufferGeometry, f: (x: number, y: number, z: number, ny: number, nx: number) => THREE.Color): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out.getAttribute('uv')) out.deleteAttribute('uv');
  out.computeVertexNormals();
  const pos = out.getAttribute('position'), nor = out.getAttribute('normal');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const c = f(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getY(i), nor.getX(i));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}

function finir(parts: THREE.BufferGeometry[], nom = 'montagnes'): THREE.Mesh {
  const mat = toonMaterial({ vertexColors: true });
  mat.fog = false;
  (mat as any).flatShading = true;
  const mesh = new THREE.Mesh(mergeGeometries(parts)!, mat);
  mesh.name = nom;
  return mesh;
}

/** Galion de profil, en boîtes : coque sombre, château arrière, trois mâts, voiles crème, pavillon noir. Centré, longueur ≈ 70 m le long de z, quille à y = 0. */
function galion(couleur: (hex: number, k: number) => THREE.Color, at: THREE.Vector3, echelle: number, cap: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const boite = (w: number, h: number, d: number, x: number, y: number, z: number, hex: number, rotX = 0): void => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rotX) g.rotateX(rotX);
    g.translate(x, y + h / 2, z);
    g.rotateY(cap).scale(echelle, echelle, echelle).translate(at.x, at.y, at.z);
    parts.push(coloree(g, () => couleur(hex, 1)));
  };
  boite(11, 7, 58, 0, -1, 0, 0x3a2a24);
  boite(9, 2, 10, 0, 3, 32, 0x3a2a24, -0.4); // étrave relevée
  boite(11.5, 5, 18, 0, 6, -21, 0x4a342a); // château arrière
  boite(10, 2, 14, 0, 6, 22, 0x4a342a); // gaillard avant
  for (const [z, h] of [[-16, 50], [3, 60], [21, 42]] as [number, number][]) {
    boite(1.3, h, 1.3, 0, 6, z, 0x2a1c16);
    for (const [y, w, hh] of [[14, 30, 15], [32, 24, 14], [46, 16, 10]] as [number, number, number][]) {
      if (y + hh > h + 4) continue;
      boite(w, hh, 0.9, 0, 6 + y, z + 1.4, 0xe9dfc4);
    }
    boite(9, 3.5, 0.4, 0, 6 + h - 1, z, 0x1a1a22); // pavillon
  }
  return parts;
}

/** Îles basses (dômes verts à liseré de sable) sur la mer et un galion à l'horizon. `niveau` : altitude de la mer. */
export function buildIles(track: TrackData, p: Palette, seed: number, niveau: number | undefined): THREE.Mesh {
  const c = cadre(track, p, 650);
  const rng = mulberry32(seed + 13);
  const mer = niveau ?? c.base + 30;
  const vert = new THREE.Color(p.reliefs.roche).lerp(c.fog, 0.5), sable = new THREE.Color(p.reliefs.cime).lerp(c.fog, 0.4);
  const parts: THREE.BufferGeometry[] = [];
  const nb = 16;
  for (let i = 0; i < nb; i++) {
    if (rng() < 0.35) continue;
    const a = ((i + rng() * 0.6) / nb) * Math.PI * 2, r = c.R + 80 + rng() * 380;
    const rad = 70 + rng() * 120, h = 22 + rng() * 55;
    const g = new THREE.SphereGeometry(rad, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / rad, 1).translate(c.cx + Math.sin(a) * r, mer - 4, c.cz + Math.cos(a) * r);
    parts.push(coloree(g, (_x, y, _z, ny) => (y < mer + 2.5 || ny < 0.3 ? sable : vert).clone().multiplyScalar(0.94 + 0.12 * ((y - mer) / h))));
  }
  // galion : à l'écart des îles, cap tangent à l'anneau
  const as = rng() * Math.PI * 2, rs = c.R + 90;
  const teinte = (hex: number, k: number): THREE.Color => new THREE.Color(hex).lerp(c.fog, hex === 0xe9dfc4 ? 0.3 : 0.42).multiplyScalar(k);
  const pos = new THREE.Vector3(c.cx + Math.sin(as) * rs, mer - 2.5, c.cz + Math.cos(as) * rs);
  parts.push(...galion(teinte, pos, 2.4, as + 0.7));
  const mesh = finir(parts);
  mesh.userData.galion = { x: pos.x, y: pos.y, z: pos.z };
  return mesh;
}

/** Panneaux de murs sans fin : deux rangs de grands panneaux beiges (bande sombre en bas, liseré clair en haut). */
export function buildMurs(track: TrackData, p: Palette, seed: number): THREE.Mesh {
  const c = cadre(track, p, 420);
  const rng = mulberry32(seed + 17);
  const mur = new THREE.Color(p.reliefs.roche).lerp(c.fog, 0.45), clair = new THREE.Color(p.reliefs.cime).lerp(c.fog, 0.35);
  const parts: THREE.BufferGeometry[] = [];
  const panneau = (a: number, r: number, w: number, h: number, t: number, teinte: number): void => {
    const g = new THREE.BoxGeometry(w, h, t).rotateY(a + Math.PI / 2);
    g.translate(c.cx + Math.sin(a) * r, c.base + h / 2, c.cz + Math.cos(a) * r);
    parts.push(coloree(g, (_x, y, _z, ny) => ((ny > 0.5 || y > c.base + h - 5) ? clair : mur).clone().multiplyScalar(teinte * (y < c.base + 18 ? 0.88 : 1))));
  };
  for (const [rang, n, dr] of [[0, 30, 0], [1, 36, 260]] as [number, number, number][]) {
    for (let i = 0; i < n; i++) {
      const a = ((i + rng() * 0.3) / n) * Math.PI * 2, r = c.R + dr + rng() * 90;
      const w = (Math.PI * 2 * r) / n * (0.7 + rng() * 0.3);
      panneau(a, r, w, 55 + rng() * 55 + rang * 40, 14, 0.9 + rng() * 0.12);
    }
  }
  return finir(parts);
}

/** Collines lunaires : troncs de cône bas et ébréchés, et quelques pics, dans les gris-violets de la palette. */
export function buildLune(track: TrackData, p: Palette, seed: number): THREE.Mesh {
  const c = cadre(track, p, 520);
  const rng = mulberry32(seed + 19);
  const roche = new THREE.Color(p.reliefs.roche).lerp(c.fog, 0.4), clair = new THREE.Color(p.reliefs.cime).lerp(c.fog, 0.3);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2 + rng() * 0.1, r = c.R + rng() * 260;
    const h = 40 + rng() * 90, rad = 140 + rng() * 160, pic = rng() < 0.25;
    const g = new THREE.CylinderGeometry(pic ? rad * 0.05 : rad * 0.35, rad, h, 5 + Math.floor(rng() * 3), 1).translate(c.cx + Math.sin(a) * r, c.base + h / 2, c.cz + Math.cos(a) * r);
    parts.push(coloree(g, (x, y, _z, ny) => (ny > 0.6 ? clair : roche).clone().multiplyScalar(0.85 + 0.25 * Math.sin(x * 0.02 + i) * 0.5 + (y - c.base) / h * 0.1)));
  }
  return finir(parts);
}

/** Jitter de la ligne de neige selon l'azimut (crête dentelée). */
const dentelure = (rng: Rng): number[] => Array.from({ length: 16 }, () => (rng() - 0.5) * 0.14);

/** Collines vertes arrondies en anneau et un grand volcan conique enneigé (forme de Fuji-yama) à l'horizon. */
export function buildFuji(track: TrackData, p: Palette, seed: number): THREE.Mesh {
  const c = cadre(track, p, 560);
  const rng = mulberry32(seed + 23);
  const roche = new THREE.Color(p.reliefs.roche).lerp(c.fog, 0.4), neige = new THREE.Color(p.reliefs.cime).lerp(c.fog, 0.15);
  const colline = new THREE.Color(p.grassB).lerp(c.fog, 0.55), sombre = new THREE.Color(p.forestFloor).lerp(new THREE.Color(p.grassB), 0.5).lerp(c.fog, 0.55);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2 + rng() * 0.08, r = c.R + rng() * 240;
    const rad = 120 + rng() * 140, h = 35 + rng() * 75;
    const g = new THREE.SphereGeometry(rad, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / rad, 1).translate(c.cx + Math.sin(a) * r, c.base, c.cz + Math.cos(a) * r);
    parts.push(coloree(g, (x, y) => (((x * 0.013 + i) % 2 + 2) % 2 < 1 ? colline : sombre).clone().multiplyScalar(0.92 + 0.14 * (y - c.base) / h)));
  }
  // le volcan : cône tronqué, neige au-dessus d'une ligne dentelée
  const a0 = rng() * Math.PI * 2, r0 = c.R + 420;
  const H = 380, rb = 430, rt = 40;
  const dent = dentelure(rng);
  const v = new THREE.CylinderGeometry(rt, rb, H, 16, 4).translate(c.cx + Math.sin(a0) * r0, c.base + H / 2, c.cz + Math.cos(a0) * r0);
  parts.push(coloree(v, (x, y, z) => {
    const az = Math.atan2(z - (c.cz + Math.cos(a0) * r0), x - (c.cx + Math.sin(a0) * r0));
    const k = Math.floor(((az + Math.PI) / (Math.PI * 2)) * 16) % 16;
    return ((y - c.base) / H > p.reliefs.ligne + dent[k] ? neige : roche).clone();
  }));
  return finir(parts);
}
