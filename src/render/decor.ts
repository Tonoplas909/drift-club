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
/**
 * Un modèle du décor : ses InstancedMesh (le modèle et son contour partagent le même tampon de matrices), toutes
 * ses matrices, et la sphère englobante de chaque objet (x, y, z, rayon).
 */
interface LotDecor { meshes: THREE.InstancedMesh[]; attr: THREE.InstancedBufferAttribute; matrices: Float32Array; spheres: Float32Array; visibles: number }

/** Les objets proches de la voiture restent toujours dessinés : leurs ombres tombent dans le champ même s'ils sont hors cadre. */
export const RAYON_TOUJOURS_VISIBLE = 40;

/**
 * Objets du décor réellement dessinés. Chaque modèle est un seul InstancedMesh pour tout le niveau : sans tri, tout
 * le décor (contours et ombres compris) serait dessiné à chaque image, même derrière la caméra ou dans le brouillard.
 * À chaque image, on ne garde au début du tampon que les objets dans le champ et en deçà du brouillard (plus ceux
 * proches de la voiture), et on n'envoie que ceux-là : un appel de dessin par modèle, seulement les triangles utiles.
 */
export class DecorVisible {
  private readonly lots: LotDecor[] = [];
  private readonly frustum = new THREE.Frustum();
  private readonly pm = new THREE.Matrix4();

  constructor(groupe: THREE.Object3D) {
    for (const lot of (groupe.userData.lots ?? []) as LotDecor[]) {
      // instances colorées une à une (néons qui clignotent) : leur ordre doit rester fixe, on ne les trie pas
      if (lot.meshes.some((m) => m.instanceColor)) continue;
      this.lots.push(lot);
    }
  }

  /** Nombre d'objets dessinés / total (mesure). */
  compte(): { visibles: number; total: number } {
    let v = 0, t = 0;
    for (const l of this.lots) { v += l.visibles; t += l.spheres.length / 4; }
    return { visibles: v, total: t };
  }

  /** `brume` : distance au-delà de laquelle tout est fondu dans le brouillard ; `tout` : caméra libre, rien n'est écarté. */
  mettreAJour(camera: THREE.Camera, brume: number, voitureX: number, voitureZ: number, tout = false): void {
    camera.updateMatrixWorld();
    this.pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pm);
    const plans = this.frustum.planes;
    const cx = camera.position.x, cz = camera.position.z, proche2 = RAYON_TOUJOURS_VISIBLE * RAYON_TOUJOURS_VISIBLE;
    for (const lot of this.lots) {
      const sp = lot.spheres, n = sp.length / 4, src = lot.matrices, dst = lot.attr.array as Float32Array;
      let k = 0;
      for (let i = 0; i < n; i++) {
        const x = sp[4 * i], y = sp[4 * i + 1], z = sp[4 * i + 2], r = sp[4 * i + 3];
        let garde = tout || (x - voitureX) ** 2 + (z - voitureZ) ** 2 < proche2;
        if (!garde) {
          const lim = brume + r;
          garde = (x - cx) ** 2 + (z - cz) ** 2 < lim * lim;
          for (let j = 0; garde && j < 6; j++) {
            const pl = plans[j];
            if (pl.normal.x * x + pl.normal.y * y + pl.normal.z * z + pl.constant < -r) garde = false;
          }
        }
        if (!garde) continue;
        if (k !== i) for (let c = 0; c < 16; c++) dst[16 * k + c] = src[16 * i + c];
        k++;
      }
      lot.visibles = k;
      for (const m of lot.meshes) m.count = k;
      if (k > 0) {
        lot.attr.clearUpdateRanges();
        lot.attr.addUpdateRange(0, 16 * k);
        lot.attr.needsUpdate = true;
      }
    }
  }
}

export function buildDecor(env: Environment, assets: Assets, q: QualityLevel, shadows: boolean, decor: Record<string, THREE.BufferGeometry> = assets.decor, materiaux?: MateriauxDecor): THREE.Group {
  const root = new THREE.Group();
  root.name = 'decor';
  const lots: LotDecor[] = [];
  root.userData.lots = lots;
  /** enregistre un modèle pour DecorVisible : matrices complètes et sphère englobante de chaque objet */
  const enregistrer = (meshes: THREE.InstancedMesh[], geo: THREE.BufferGeometry, echelles: number[]): void => {
    const attr = meshes[0].instanceMatrix, n = meshes[0].count;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    const bs = geo.boundingSphere!, spheres = new Float32Array(4 * n), mm = new THREE.Matrix4(), c = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      meshes[0].getMatrixAt(i, mm);
      c.copy(bs.center).applyMatrix4(mm);
      spheres.set([c.x, c.y, c.z, bs.radius * echelles[i]], 4 * i);
    }
    lots.push({ meshes, attr, matrices: (attr.array as Float32Array).slice(), spheres, visibles: n });
  };
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
      mesh.name = far ? `${key}:loin` : key;
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
      const meshes = [mesh];
      if (q === 'haute' || !far) {
        const og = contourDe(geo);
        const ol = new THREE.InstancedMesh(og, geo.userData.contour ? outlineGros : outline, list.length);
        ol.instanceMatrix = mesh.instanceMatrix;
        ol.computeBoundingSphere();
        root.add(ol);
        meshes.push(ol);
      }
      // échelle maximale de la matrice : celle de l'objet (uniforme)
      enregistrer(meshes, geo, list.map((it) => it.scale));
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
    // barrières étirées en longueur : rayon à la taille du tronçon
    enregistrer([mesh, ol], geo, env.barriers.map((b) => Math.max(1, b.len)));
  }
  return root;
}
