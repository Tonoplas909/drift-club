import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildDecor, DecorVisible, RAYON_TOUJOURS_VISIBLE } from '../../src/render/decor';
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
    expect(dv.compte()).toEqual({ visibles: 3, total: 7 });
    for (const m of meshes) expect(m.count).toBe(3); // modèle et contour partagent le tampon
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
