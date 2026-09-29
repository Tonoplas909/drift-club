import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { nearestSample } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import type { Level } from '../../../src/core/level/types';
import { straightLevel, curveLevel, hairpinLevel } from '../../fixtures/levels';

function envOf(level: Level) {
  const track = buildTrack(level);
  const terrain = new Terrain(track, level.decor.graine);
  return { track, terrain, env: generateEnvironment(level, track, terrain) };
}

describe('generateEnvironment', () => {
  it('déterministe', () => {
    const lv = straightLevel(300);
    expect(envOf(lv).env).toEqual(envOf(lv).env);
  });
  it('une autre graine donne un autre décor', () => {
    const a = envOf(straightLevel(300)).env;
    const lv = straightLevel(300);
    lv.decor.graine = 999;
    const b = envOf(lv).env;
    expect(b.items.map((i) => i.x)).not.toEqual(a.items.map((i) => i.x));
  });
  it('rien dans le couloir de la route', () => {
    const { track, env } = envOf(hairpinLevel());
    for (const it of env.items) {
      if (it.manual) continue;
      const n = nearestSample(track, it.x, it.z);
      if (!n) continue;
      const w = track.samples[n.index].w;
      const min = it.kind === 'chevron' || it.kind === 'borne' ? w + 1.5 : w + 3;
      expect(n.dist).toBeGreaterThanOrEqual(min - 0.05);
    }
  });
  it('un cercle d’obstacle par objet solide, solides seulement près de la route', () => {
    const { terrain, env } = envOf(straightLevel(300));
    expect(env.circles.length).toBe(env.items.filter((i) => i.solid).length);
    for (const it of env.items) {
      if (it.solid && !it.manual) expect(terrain.distanceToRoad(it.x, it.z)).toBeLessThan(40);
    }
    expect(env.items.some((i) => !i.solid)).toBe(true);
  });
  it('la densité change le nombre d’arbres', () => {
    const lo = straightLevel(300); lo.decor.densite = 0;
    const hi = straightLevel(300); hi.decor.densite = 1;
    const count = (lv: Level) => envOf(lv).env.items.filter((i) => i.kind === 'sapin' || i.kind === 'feuillu').length;
    expect(count(hi)).toBeGreaterThan(count(lo) * 1.5);
  });
  it('objets manuels : présents, solides, sans arbre généré à moins de 4 m', () => {
    const lv = straightLevel(300);
    lv.objets = [{ type: 'arbre', x: 20, z: 150, rot: 0 }, { type: 'barriere', x: 15, z: 100, rot: 0 }];
    const { env } = envOf(lv);
    const tree = env.items.find((i) => i.manual);
    expect(tree).toMatchObject({ kind: 'feuillu', x: 20, z: 150, solid: true });
    for (const it of env.items) {
      if (it.manual) continue;
      expect(Math.hypot(it.x - 20, it.z - 150)).toBeGreaterThanOrEqual(4);
    }
    const seg = env.segments.find((s) => Math.abs(s.ax - 15) < 1e-9);
    expect(seg).toBeDefined();
    expect(seg!.az).toBeCloseTo(98, 6);
    expect(seg!.bz).toBeCloseTo(102, 6);
  });
  it('barrière à gauche sur la ligne droite (x ≈ w + 0,8)', () => {
    const lv = straightLevel(300);
    lv.barrieres = [{ de: 0, a: 2, cote: 'gauche' }];
    const { env } = envOf(lv);
    expect(env.segments.length).toBeGreaterThan(40);
    for (const s of env.segments) {
      expect(s.ax).toBeCloseTo(5.8, 3);
      expect(s.bz).toBeLessThanOrEqual(100.001);
    }
    expect(env.barriers.length).toBe(env.segments.length);
  });
  it('barrière « ext » : à l’extérieur du virage à gauche', () => {
    const lv = curveLevel();
    lv.barrieres = [{ de: 0, a: 4, cote: 'ext' }];
    const { env } = envOf(lv);
    for (const s of env.segments.slice(3, -3)) {
      expect(Math.hypot(s.ax - 50, s.az)).toBeGreaterThan(54.5);
    }
  });
  it('chevrons dans l’épingle, bornes sur la ligne droite', () => {
    expect(envOf(hairpinLevel()).env.items.filter((i) => i.kind === 'chevron').length).toBeGreaterThan(0);
    expect(envOf(straightLevel(300)).env.items.filter((i) => i.kind === 'borne').length).toBeGreaterThanOrEqual(20);
  });
  it('toutes les positions sont finies', () => {
    for (const it of envOf(hairpinLevel()).env.items) {
      expect(Number.isFinite(it.x + it.y + it.z + it.rot + it.scale)).toBe(true);
    }
  });
});
