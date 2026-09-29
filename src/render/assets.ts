import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarId } from '../core/physics/types';
import type { DecorKind } from '../core/env/types';
import { CAR_IDS } from '../core/physics/cars';
import { borneGeometry, chevronGeometry, barrierGeometry, tireStack, wheelGeometry } from './procedural';
import { buildJdmCar, CAR_SHAPES } from './jdmCars';

export interface WheelModel { geometry: THREE.BufferGeometry; position: THREE.Vector3; front: boolean; left: boolean }
export interface CarModel { body: THREE.BufferGeometry; wheels: WheelModel[]; paint: THREE.Color }
export interface Assets { cars: Record<CarId, CarModel>; decor: Record<string, THREE.BufferGeometry> }

export const decorKey = (kind: DecorKind, variant: number): string => `${kind}${variant}`;

/** Modèles de décor Kenney : fichier, taille visée (m) et axe mesuré. */
export const DECOR_FILES: Record<string, { file: string; size: number; axis: 'x' | 'y' }> = {
  sapin0: { file: 'nature/tree_pineTallA.glb', size: 11, axis: 'y' },
  sapin1: { file: 'nature/tree_pineDefaultA.glb', size: 10, axis: 'y' },
  sapin2: { file: 'nature/tree_pineRoundA.glb', size: 9, axis: 'y' },
  feuillu0: { file: 'nature/tree_default.glb', size: 8, axis: 'y' },
  feuillu1: { file: 'nature/tree_oak.glb', size: 7.5, axis: 'y' },
  feuillu2: { file: 'nature/tree_fat.glb', size: 7, axis: 'y' },
  rocher0: { file: 'nature/rock_largeA.glb', size: 3.2, axis: 'x' },
  rocher1: { file: 'nature/rock_largeB.glb', size: 3.2, axis: 'x' },
  rocherHaut0: { file: 'nature/rock_tallA.glb', size: 3.5, axis: 'y' },
  panneau0: { file: 'nature/sign.glb', size: 1.8, axis: 'y' },
};

/** Géométrie non indexée (position, normal, color) transformée par `matrix` ; couleur = couleur du matériau. */
export function bakeMesh(mesh: THREE.Mesh, matrix: THREE.Matrix4): THREE.BufferGeometry {
  let geo = mesh.geometry.clone();
  if (geo.index) geo = geo.toNonIndexed();
  geo.applyMatrix4(matrix);
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
  const pos = geo.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    colors[i * 3] = mat.color.r; colors[i * 3 + 1] = mat.color.g; colors[i * 3 + 2] = mat.color.b;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', pos);
  out.setAttribute('normal', geo.getAttribute('normal'));
  out.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return out;
}

export function normalizeGeometry(geo: THREE.BufferGeometry, size: number, axis: 'x' | 'y'): THREE.BufferGeometry {
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const extent = axis === 'y' ? bb.max.y - bb.min.y : bb.max.x - bb.min.x;
  const s = size / Math.max(1e-6, extent);
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(s, s, s);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return geo;
}

/** Copie de la carrosserie où la couleur `paint` est remplacée par `color`. */
export function paintGeometry(src: THREE.BufferGeometry, paint: THREE.Color, color: THREE.Color): THREE.BufferGeometry {
  const geo = src.clone();
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) {
    const dr = col.getX(i) - paint.r, dg = col.getY(i) - paint.g, db = col.getZ(i) - paint.b;
    if (dr * dr + dg * dg + db * db < 0.0009) col.setXYZ(i, color.r, color.g, color.b);
  }
  col.needsUpdate = true;
  return geo;
}

function bakeScene(scene: THREE.Object3D): THREE.BufferGeometry {
  scene.updateMatrixWorld(true);
  const parts: THREE.BufferGeometry[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.isMesh) parts.push(bakeMesh(mesh, mesh.matrixWorld));
  });
  const g = mergeGeometries(parts);
  if (!g) throw new Error('modèle vide');
  return g;
}

/** Construit les voitures et charge le décor. `baseUrl` se termine par « / » (ex. `${import.meta.env.BASE_URL}models/`). */
export async function loadAssets(baseUrl: string, onProgress?: (p: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const entries = Object.entries(DECOR_FILES);
  let done = 0;
  const decorList = await Promise.all(entries.map(async ([key, def]) => {
    const gltf = await loader.loadAsync(baseUrl + def.file);
    const geo = normalizeGeometry(bakeScene(gltf.scene), def.size, def.axis);
    onProgress?.(++done / entries.length);
    return [key, geo] as const;
  }));
  const decor: Record<string, THREE.BufferGeometry> = Object.fromEntries(decorList);
  decor.pneus0 = tireStack(wheelGeometry(0.375, 0.3));
  decor.chevron0 = chevronGeometry();
  decor.borne0 = borneGeometry();
  decor.barriere = barrierGeometry();
  for (const g of Object.values(decor)) g.computeBoundingSphere();
  const cars = Object.fromEntries(CAR_IDS.map((id) => [id, buildJdmCar(CAR_SHAPES[id])])) as Record<CarId, CarModel>;
  return { cars, decor };
}
