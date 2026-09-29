import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { projectOnTrack, nearestSample, nearestSampleWithin } from '../../../src/core/track/projection';
import { checkGeometry } from '../../../src/core/track/checkGeometry';
import { loadLevel } from '../../../src/core/loadLevel';
import { makeLevel, straightLevel, curveLevel, hairpinLevel } from '../../fixtures/levels';

describe('buildTrack', () => {
  it('ligne droite : échantillons tous les mètres, tangente +z, normale gauche +x', () => {
    const t = buildTrack(straightLevel(200));
    expect(t.samples.length).toBe(201);
    expect(t.length).toBeCloseTo(200, 1);
    const mid = t.samples[100];
    expect(mid.s).toBeCloseTo(100, 5);
    expect(mid.tx).toBeCloseTo(0, 5);
    expect(mid.tz).toBeCloseTo(1, 5);
    expect(mid.nx).toBeCloseTo(1, 5);
    expect(mid.nz).toBeCloseTo(0, 5);
    expect(mid.w).toBe(5);
    expect(mid.k).toBeCloseTo(0, 5);
    expect(t.targetTime).toBeCloseTo(200 / 30, 1);
    expect(t.curbs.length).toBe(0);
    expect(t.pointSample).toEqual([0, 50, 100, 150, 200]);
    expect(t.bounds.minZ).toBeCloseTo(0, 5);
    expect(t.bounds.maxZ).toBeCloseTo(200, 1);
  });
  it('virage à gauche de rayon 50 : courbure ≈ +0,02', () => {
    const t = buildTrack(curveLevel());
    const mid = t.samples[Math.floor(t.samples.length / 2)];
    expect(mid.k).toBeGreaterThan(0.017);
    expect(mid.k).toBeLessThan(0.023);
    expect(t.length).toBeGreaterThan(75);
    expect(t.length).toBeLessThan(82);
  });
  it('pente : grade ≈ dy/ds', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [0, 100, 10, 10], [0, 200, 20, 10]]));
    const mid = t.samples[Math.floor(t.samples.length / 2)];
    expect(mid.grade).toBeCloseTo(0.1, 2);
  });
  it('épingle : des vibreurs sont générés', () => {
    expect(buildTrack(hairpinLevel()).curbs.length).toBeGreaterThan(0);
  });
  it('niveau minimal de 2 points', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [0, 20, 0, 10]]));
    expect(t.samples.length).toBe(21);
    expect(t.length).toBeCloseTo(20, 3);
  });
});

describe('projection', () => {
  const straight = buildTrack(straightLevel(200));
  it('projette un point sur la ligne droite', () => {
    const p = projectOnTrack(straight, 3, 100, 95);
    expect(p.s).toBeCloseTo(100, 1);
    expect(p.lateral).toBeCloseTo(3, 3);
    expect(p.index).toBe(100);
  });
  it("ne saute pas sur l\'autre branche d\'une épingle", () => {
    const t = buildTrack(hairpinLevel());
    const p = projectOnTrack(t, 40, 50, 50);
    expect(p.index).toBeGreaterThanOrEqual(30);
    expect(p.index).toBeLessThanOrEqual(80);
    expect(Math.abs(p.lateral)).toBeGreaterThan(30);
  });
  it('nearestSample trouve la bonne branche', () => {
    const t = buildTrack(hairpinLevel());
    const n = nearestSample(t, 40, 50);
    expect(n).not.toBeNull();
    expect(t.samples[n!.index].s).toBeGreaterThan(150);
    expect(n!.dist).toBeLessThan(1.5);
  });
  it('nearestSampleWithin renvoie null au-delà du rayon', () => {
    expect(nearestSampleWithin(straight, 30, 100, 14)).toBeNull();
    expect(nearestSampleWithin(straight, 10, 100, 14)!.dist).toBeCloseTo(10, 3);
  });
});

describe('checkGeometry', () => {
  it('niveaux corrects : aucune erreur', () => {
    expect(checkGeometry(buildTrack(straightLevel()))).toEqual([]);
    expect(checkGeometry(buildTrack(curveLevel()))).toEqual([]);
    expect(checkGeometry(buildTrack(hairpinLevel()))).toEqual([]);
  });
  it('route qui se croise', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 10], [60, 60, 0, 10], [60, 0, 0, 10], [0, 60, 0, 10]]));
    expect(checkGeometry(t).join(' ')).toMatch(/croise/);
  });
  it('virage trop serré', () => {
    const t = buildTrack(makeLevel([[0, 0, 0, 6], [0, 40, 0, 6], [8, 40, 0, 6], [8, 0, 0, 6]]));
    expect(checkGeometry(t).join(' ')).toMatch(/serré/);
  });
});

describe('loadLevel', () => {
  it('niveau valide', () => {
    const r = loadLevel(straightLevel());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.track.samples.length).toBe(201);
  });
  it('erreurs de structure', () => {
    const r = loadLevel({ format: 1 });
    expect(r.ok).toBe(false);
  });
  it('erreurs de géométrie', () => {
    const r = loadLevel(makeLevel([[0, 0, 0, 10], [60, 60, 0, 10], [60, 0, 0, 10], [0, 60, 0, 10]]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join(' ')).toMatch(/croise/);
  });
});
