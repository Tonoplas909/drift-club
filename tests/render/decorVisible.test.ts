import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildDecor, DecorVisible, RAYON_TOUJOURS_VISIBLE, PROFONDEUR_CONTOUR, profondeur } from '../../src/render/decor';
import type { Environment, EnvItem } from '../../src/core/env/types';
import { decorKey, type Assets } from '../../src/render/assets';

const item = (x: number, z: number): EnvItem => ({ kind: 'arbre', variant: 0, x, y: 0, z, rot: 0, scale: 1, solid: true, manual: false } as unknown as EnvItem);

function monter(items: EnvItem[]) {
  const geo = new THREE.BoxGeometry(2, 4, 2);
  const env = { items, barriers: [], circles: [], boxes: [] } as unknown as Environment;
  const assets = { decor: { [decorKey('arbre' as never, 0)]: geo } } as unknown as Assets;
  const groupe = buildDecor(env, assets, 'haute', false, assets.decor);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 2500);
  camera.position.set(0, 2, 0);
  camera.lookAt(0, 2, 10); // regarde vers +z
  const meshes = groupe.children.filter((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh[];
  return { groupe, camera, meshes, dv: new DecorVisible(groupe) };
}

describe('DecorVisible : seuls les objets visibles sont dessinés', () => {
  it('devant la caméra : gardés ; derrière, sur les côtés ou dans le brouillard : écartés ; le contour suit', () => {
    const devant = [item(0, 60), item(5, 120), item(-8, 200)];
    const derriere = [item(0, -80), item(10, -150)];
    const cote = [item(150, 5)];
    const brouillard = [item(0, 900)];
    const { camera, meshes, dv } = monter([...devant, ...derriere, ...cote, ...brouillard]);
    // la voiture est loin de tout (pas de zone « toujours visible » ici)
    dv.mettreAJour(camera, 350, 0, -5000);
    // à 60 m : avec contour ; à 120 et 200 m (au-delà de PROFONDEUR_CONTOUR) : sans
    expect(dv.compte()).toEqual({ visibles: 3, total: 7, contours: 1 });
    expect(meshes.map((m) => m.count)).toEqual([3, 1]); // modèle et contour partagent le tampon : les plus proches en tête
    // les matrices gardées sont celles des objets devant, en tête du tampon
    const p = new THREE.Vector3(), mm = new THREE.Matrix4();
    const zs = [0, 1, 2].map((i) => { meshes[0].getMatrixAt(i, mm); return p.setFromMatrixPosition(mm).z; });
    expect(zs).toEqual([60, 120, 200]);
  });
  it('les objets proches de la voiture restent dessinés même hors cadre (leurs ombres)', () => {
    const { camera, dv } = monter([item(0, -20), item(0, -RAYON_TOUJOURS_VISIBLE - 30)]);
    dv.mettreAJour(camera, 350, 0, -5);
    expect(dv.compte().visibles).toBe(1);
  });
  it('brouillard mesuré en profondeur, comme three.js : un objet sur le bord de l\'écran, plus loin que la brume en distance mais pas en profondeur, reste dessiné', () => {
    // à 30° de l'axe (dans le champ de 60° × 16/9), profondeur 300 m, distance 346 m ; brume à 320 m
    const bord = item(300 * Math.tan(Math.PI / 6), 300);
    const { camera, dv } = monter([bord, item(0, 340)]);
    dv.mettreAJour(camera, 320, 0, -5000);
    expect(dv.compte().visibles).toBe(1);
    const p = new THREE.Vector3(), mm = new THREE.Matrix4();
    const meshes = dv as unknown as { lots: { meshes: THREE.InstancedMesh[] }[] };
    meshes.lots[0].meshes[0].getMatrixAt(0, mm);
    expect(p.setFromMatrixPosition(mm).z).toBe(300);
  });
  it('contours : seulement en deçà de PROFONDEUR_CONTOUR, objets proches d\'abord dans le tampon ; tous en caméra libre', () => {
    const { camera, meshes, dv } = monter([item(0, PROFONDEUR_CONTOUR + 60), item(3, 30), item(-3, PROFONDEUR_CONTOUR + 20), item(0, 80)]);
    dv.mettreAJour(camera, 350, 0, -5000);
    expect(meshes.map((m) => m.count)).toEqual([4, 2]);
    const p = new THREE.Vector3(), mm = new THREE.Matrix4();
    const zs = [0, 1, 2, 3].map((i) => { meshes[0].getMatrixAt(i, mm); return p.setFromMatrixPosition(mm).z; });
    expect(zs.slice(0, 2)).toEqual([30, 80]);
    dv.mettreAJour(camera, 350, 0, -5000, true);
    expect(meshes.map((m) => m.count)).toEqual([4, 4]);
    // profondeur : le long de l'axe de visée (la caméra regarde vers +z depuis (0, 2, 0))
    camera.updateMatrixWorld();
    expect(profondeur(camera, 50, 2, 100)).toBeCloseTo(100, 6);
  });
  it('caméra libre : tout est dessiné ; et le tri suit la caméra quand elle tourne', () => {
    const items = [item(0, 60), item(0, -60)];
    const { camera, dv } = monter(items);
    dv.mettreAJour(camera, 350, 0, -5000, true);
    expect(dv.compte().visibles).toBe(2);
    dv.mettreAJour(camera, 350, 0, -5000);
    expect(dv.compte().visibles).toBe(1);
    camera.lookAt(0, 2, -10);
    dv.mettreAJour(camera, 350, 0, -5000);
    expect(dv.compte().visibles).toBe(1);
  });
});
