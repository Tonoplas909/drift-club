import { describe, it, expect } from 'vitest';
import { DIST_MAX, DIST_MIN, camOrbite, orbiteDepuis, type ScenePhoto } from '../../src/game/photo';
import { appliquerFiltre, nomPhoto } from '../../src/ui/photoFiltres';

const scene = (sol = 0): ScenePhoto => ({ voiture: { x: 10, y: 2, z: -5 }, camera: { x: 10, y: 4.7, z: -12 }, sol: () => sol });

describe('mode photo : caméra', () => {
  it('part de la caméra de poursuite et vise la voiture', () => {
    const s = scene();
    const c = camOrbite(s, orbiteDepuis(s));
    expect(c.pos[0]).toBeCloseTo(10);
    expect(c.pos[1]).toBeCloseTo(4.7);
    expect(c.pos[2]).toBeCloseTo(-12);
    expect(c.cible).toEqual([10, 2.7, -5]);
  });
  it('distance bornée, jamais sous le sol', () => {
    const s = scene(50);
    const c = camOrbite(s, { lacet: 0, tangage: -1, dist: 1000 });
    expect(Math.hypot(c.pos[0] - 10, c.pos[2] + 5)).toBeLessThanOrEqual(DIST_MAX);
    expect(c.pos[1]).toBeGreaterThanOrEqual(50.3);
    expect(orbiteDepuis({ ...scene(), camera: { x: 10, y: 2.7, z: -5.1 } }).dist).toBe(DIST_MIN);
  });
});

describe('mode photo : filtres', () => {
  const image = (): Uint8ClampedArray => {
    const px = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < 16; i++) px.set([200, 100, 50, 255], i * 4);
    return px;
  };
  it('noir et blanc : trois canaux égaux, alpha intact', () => {
    const px = image();
    appliquerFiltre(px, 4, 4, 'nb', () => 0.5);
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
    expect(px[3]).toBe(255);
  });
  it('vignette : bords plus sombres que le centre', () => {
    const l = 9, px = new Uint8ClampedArray(l * l * 4).fill(200);
    appliquerFiltre(px, l, l, 'vignette', () => 0.5);
    expect(px[0]).toBeLessThan(px[(4 * l + 4) * 4]);
    expect(px[(4 * l + 4) * 4]).toBe(200);
  });
  it('grain : déterministe avec le même hasard, aucun = inchangé', () => {
    const a = image(), b = image();
    let s = 1;
    const rnd = (): number => ((s = (s * 16807) % 2147483647) / 2147483647);
    appliquerFiltre(a, 4, 4, 'grain', rnd);
    s = 1;
    appliquerFiltre(b, 4, 4, 'grain', rnd);
    expect(a).toEqual(b);
    const c = image();
    appliquerFiltre(c, 4, 4, 'aucun', rnd);
    expect(c).toEqual(image());
  });
  it('nom de fichier daté', () => {
    expect(nomPhoto(new Date(2026, 9, 6, 9, 5, 3))).toBe('drift-club-20261006-090503.png');
  });
});
