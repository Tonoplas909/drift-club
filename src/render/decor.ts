import * as THREE from 'three';
import type { EnvItem, Environment } from '../core/env/types';
import { decorKey, type Assets } from './assets';
import { toonMaterial, outlineMaterial, outlineGeometry } from './materials';
import type { QualityLevel } from './quality';

/** Matériaux du décor, partageables entre plusieurs groupes (mode Zen : un groupe par tronçon). */
export interface MateriauxDecor { mat: THREE.Material; outline: THREE.Material; outlineGros: THREE.Material }

export function materiauxDecor(): MateriauxDecor {
  return { mat: toonMaterial({ vertexColors: true }), outline: outlineMaterial(0.05), outlineGros: outlineMaterial(0.13) };
}

/** Contours déjà calculés, par modèle (le calcul parcourt tous les sommets : on ne le refait pas à chaque groupe). */
const contours = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
export function contourDe(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const c = geo.userData.contour as THREE.BufferGeometry | undefined;
  if (c) return c;
  let og = contours.get(geo);
  if (!og) { og = outlineGeometry(geo); contours.set(geo, og); }
  return og;
}

/**
 * Un InstancedMesh par modèle et par distance (proche = solide, lointain = visuel).
 * Qualité Basse : un objet lointain sur trois, contours seulement sur les objets proches.
 */
export function buildDecor(env: Environment, assets: Assets, q: QualityLevel, shadows: boolean, decor: Record<string, THREE.BufferGeometry> = assets.decor, materiaux?: MateriauxDecor): THREE.Group {
  const root = new THREE.Group();
  root.name = 'decor';
  // bâtiments : grandes façades, trait plus épais (outlineGros)
  const { mat, outline, outlineGros } = materiaux ?? materiauxDecor();
  const groups = new Map<string, [EnvItem[], EnvItem[]]>();
  env.items.forEach((it, i) => {
    const far = !it.solid;
    if (q === 'basse' && far && i % 3 !== 0) return;
    const key = decorKey(it.kind, it.variant);
    let g = groups.get(key);
    if (!g) { g = [[], []]; groups.set(key, g); }
    g[far ? 1 : 0].push(it);
  });

  const m = new THREE.Matrix4(), qt = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [key, lists] of groups) {
    const geo = decor[key];
    if (!geo) continue;
    lists.forEach((list, li) => {
      if (list.length === 0) return;
      const far = li === 1;
      const mesh = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => {
        qt.setFromAxisAngle(up, it.rot);
        s.setScalar(it.scale);
        p.set(it.x, it.y, it.z);
        mesh.setMatrixAt(i, m.compose(p, qt, s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = shadows && !far;
      mesh.computeBoundingSphere();
      root.add(mesh);
      if (q === 'haute' || !far) {
        const og = contourDe(geo);
        const ol = new THREE.InstancedMesh(og, geo.userData.contour ? outlineGros : outline, list.length);
        ol.instanceMatrix = mesh.instanceMatrix;
        ol.computeBoundingSphere();
        root.add(ol);
      }
    });
  }

  if (env.barriers.length > 0 && decor.barriere) {
    const geo = decor.barriere;
    const mesh = new THREE.InstancedMesh(geo, mat, env.barriers.length);
    env.barriers.forEach((b, i) => {
      qt.setFromAxisAngle(up, b.rot);
      s.set(1, 1, b.len);
      p.set(b.x, b.y, b.z);
      mesh.setMatrixAt(i, m.compose(p, qt, s));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadows;
    mesh.computeBoundingSphere();
    const ol = new THREE.InstancedMesh(contourDe(geo), outline, env.barriers.length);
    ol.instanceMatrix = mesh.instanceMatrix;
    ol.computeBoundingSphere();
    root.add(mesh, ol);
  }
  return root;
}
