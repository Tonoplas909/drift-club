import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain, rise } from '../../../src/core/track/terrain';
import { makeLevel, straightLevel } from '../../fixtures/levels';

describe('rise', () => {
  it('nul sur l\'accotement, croissant ensuite, plafonné', () => {
    expect(rise(-3, 1)).toBe(0);
    expect(rise(0, 1)).toBe(0);
    expect(rise(5, 1)).toBeCloseTo(0.5, 6);
    expect(rise(50, 1)).toBeGreaterThan(rise(20, 1));
    expect(rise(5000, 1)).toBe(250);
  });
});

describe('Terrain', () => {
  const track = buildTrack(straightLevel(300));
  const terrain = new Terrain(track, 1234);

  it('hauteur exacte sur la route et sur l\'accotement', () => {
    expect(terrain.heightAt(0, 150)).toBeCloseTo(0, 6);
    expect(terrain.heightAt(3, 150)).toBeCloseTo(0, 6);
    expect(terrain.heightAt(-5.9, 150)).toBeCloseTo(0, 6);
  });
  it('les collines montent en s\'éloignant', () => {
    expect(terrain.heightAt(40, 150)).toBeGreaterThan(1);
    expect(terrain.heightAt(200, 150)).toBeGreaterThan(20);
  });
  it('continu de la route jusqu\'à 150 m (pas de marche)', () => {
    let prev = terrain.heightAt(0, 150);
    for (let x = 0.1; x <= 150; x += 0.1) {
      const h = terrain.heightAt(x, 150);
      expect(Math.abs(h - prev)).toBeLessThan(0.25);
      prev = h;
    }
  });
  it('définie partout, même loin (bord de grille)', () => {
    expect(Number.isFinite(terrain.heightAt(5000, -5000))).toBe(true);
    expect(Number.isFinite(terrain.heightAt(-800, 150))).toBe(true);
  });
  it('distance à la route approximative', () => {
    expect(terrain.distanceToRoad(30, 150)).toBeGreaterThan(27);
    expect(terrain.distanceToRoad(30, 150)).toBeLessThan(33);
    expect(terrain.distanceToRoad(0, 150)).toBeLessThan(2);
    expect(terrain.distanceToRoad(300, 150)).toBeGreaterThan(250);
  });
  it('route en pente : hauteur et gradient', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [0, 100, 10, 10], [0, 200, 20, 10]]));
    const ter = new Terrain(t, 1);
    expect(ter.heightAt(0, 100)).toBeCloseTo(10, 0);
    const g = ter.gradientAt(0, 100);
    expect(g.gz).toBeCloseTo(0.1, 1);
    expect(Math.abs(g.gx)).toBeLessThan(0.02);
  });
  it('déterministe', () => {
    const t2 = new Terrain(track, 1234);
    expect(t2.heightAt(77.7, 33.3)).toBe(terrain.heightAt(77.7, 33.3));
  });
});
