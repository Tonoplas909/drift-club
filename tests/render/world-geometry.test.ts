import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { PALETTES } from '../../src/render/palettes';
import { QualityManager, QUALITY } from '../../src/render/quality';
import { createSky } from '../../src/render/sky';
import { buildRoad } from '../../src/render/road';
import { buildTerrain, buildMountains, chunkStep } from '../../src/render/terrainMesh';
import { buildTrack } from '../../src/core/track/buildTrack';
import { Terrain } from '../../src/core/track/terrain';
import { straightLevel, hairpinLevel } from '../fixtures/levels';

const fakeTex = () => ({ road: new THREE.Texture(), curb: new THREE.Texture(), checker: new THREE.Texture() });
const allFinite = (o: THREE.Object3D) => {
  let ok = true;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) ok = ok && Array.from(m.geometry.getAttribute('position').array as Float32Array).every(Number.isFinite);
  });
  return ok;
};

describe('palettes et qualité', () => {
  it('deux ambiances complètes', () => {
    expect(Object.keys(PALETTES.jour).sort()).toEqual(Object.keys(PALETTES.coucher).sort());
  });
  it('qualité auto : Haute sur PC, Basse au tactile, passe en Basse sous 50 i/s pendant 3 s', () => {
    expect(new QualityManager('auto', true).level).toBe('basse');
    const q = new QualityManager('auto', false);
    expect(q.level).toBe('haute');
    let changed = false;
    for (let i = 0; i < 40 * 2.9; i++) changed = q.sample(1 / 40) || changed;
    expect(changed).toBe(false);
    for (let i = 0; i < 40 * 0.7; i++) changed = q.sample(1 / 40) || changed;
    expect(changed).toBe(true);
    expect(q.level).toBe('basse');
  });
  it('qualité fixe : jamais de changement ; 60 i/s : pas de baisse', () => {
    const fixed = new QualityManager('haute', false);
    for (let i = 0; i < 400; i++) expect(fixed.sample(1 / 20)).toBe(false);
    const good = new QualityManager('auto', false);
    for (let i = 0; i < 600; i++) good.sample(1 / 60);
    expect(good.level).toBe('haute');
    expect(QUALITY.basse.shadows).toBe(false);
  });
});

describe('géométrie du monde', () => {
  const track = buildTrack(hairpinLevel());
  it('ciel', () => {
    const sky = createSky(PALETTES.jour);
    expect(sky.material).toBeInstanceOf(THREE.ShaderMaterial);
  });
  it('route : 2 sommets par échantillon, normales vers le haut, vibreurs', () => {
    const g = buildRoad(track, PALETTES.jour, fakeTex());
    const surface = g.getObjectByName('surface') as THREE.Mesh;
    expect(surface.geometry.getAttribute('position').count).toBe(track.samples.length * 2);
    const n = surface.geometry.getAttribute('normal');
    for (let i = 0; i < n.count; i += 37) expect(n.getY(i)).toBeGreaterThan(0.9);
    expect(g.getObjectByName('vibreurs')).toBeDefined();
    expect(g.getObjectByName('arche')).toBeDefined();
    expect(allFinite(g)).toBe(true);
  });
  it('pas du terrain selon la distance et la qualité', () => {
    expect(chunkStep(0, 'haute')).toBe(2);
    expect(chunkStep(100, 'haute')).toBe(4);
    expect(chunkStep(300, 'haute')).toBe(8);
    expect(chunkStep(0, 'basse')).toBe(4);
  });
  it('terrain en morceaux, positions finies, centres renseignés', () => {
    const lv = straightLevel(200);
    const t = buildTrack(lv);
    const terrain = new Terrain(t, lv.decor.graine);
    const g = buildTerrain(lv, t, terrain, PALETTES.jour, 'basse');
    expect(g.children.length).toBeGreaterThan(4);
    for (const c of g.children) expect(c.userData.center).toBeInstanceOf(THREE.Vector3);
    expect(allFinite(g)).toBe(true);
    const m = buildMountains(t, PALETTES.coucher, 3);
    expect(allFinite(m)).toBe(true);
  });
});
