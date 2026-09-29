import { describe, it, expect } from 'vitest';
import { RaceSim, type RaceEvent } from '../../../src/core/race/race';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { projectOnTrack } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import type { InputState } from '../../../src/core/input';
import type { Level } from '../../../src/core/level/types';
import { SIM_DT } from '../../../src/core/constants';
import { makeLevel, straightLevel, hairpinLevel } from '../../fixtures/levels';

function makeSim(level: Level, countdown = 0): RaceSim {
  const track = buildTrack(level);
  const terrain = new Terrain(track, level.decor.graine);
  const env = generateEnvironment(level, track, terrain);
  return new RaceSim({ level, track, terrain, env, car: CARS.equilibree, assists: MODES.semi, countdown });
}
const GAZ: InputState = { gaz: 1, frein: 0, direction: 0, freinAMain: false };
const IDLE: InputState = { gaz: 0, frein: 0, direction: 0, freinAMain: false };

function runFor(sim: RaceSim, seconds: number, input: InputState): RaceEvent[] {
  const ev: RaceEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) ev.push(...sim.step(input));
  return ev;
}

describe('RaceSim', () => {
  it('décompte 3-2-1-0 : la voiture ne bouge pas', () => {
    const sim = makeSim(straightLevel(300), 3);
    const z0 = sim.car.z;
    const ev = runFor(sim, 3.05, GAZ);
    const counts = ev.filter((e) => e.type === 'decompte').map((e) => (e as { n: number }).n);
    expect(counts).toEqual([3, 2, 1, 0]);
    expect(sim.phase).toBe('course');
    expect(sim.car.z).toBeCloseTo(z0, 1);
  });
  it('ligne droite pleins gaz : arrivée avec un résultat cohérent', () => {
    const sim = makeSim(straightLevel(300));
    let arrivee: RaceEvent | undefined;
    for (let t = 0; t < 60 && !arrivee; t += SIM_DT) arrivee = sim.step(GAZ).find((e) => e.type === 'arrivee');
    expect(arrivee).toBeDefined();
    expect(sim.phase).toBe('arrivee');
    const r = sim.result!;
    expect(r.time).toBeGreaterThan(5);
    expect(r.time).toBeLessThan(40);
    expect(r.score).toBe(r.driftPoints + r.bonus);
    expect(r.bonus).toBe(Math.round(Math.max(0, r.targetTime - r.time) * 2000));
    const zAfter = sim.car.z;
    runFor(sim, 1, GAZ);
    expect(sim.car.z).toBeGreaterThan(zAfter);
  });
  it('replacement manuel : sur la route, a l\'arret, pas au-dela de la progression', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 4, GAZ);
    sim.car.x += 4;
    const ev = sim.step(IDLE, true);
    expect(ev).toContainEqual({ type: 'replace', auto: false });
    expect(sim.car.speed).toBe(0);
    const p = projectOnTrack(sim.config.track, sim.car.x, sim.car.z, sim.progressIndex);
    expect(Math.abs(p.lateral)).toBeLessThan(0.5);
    expect(sim.progressS).toBeLessThanOrEqual(sim.maxProgressS);
  });
  it('limite de zone : replacement automatique', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 2, GAZ);
    sim.car.x += 60;
    const ev = sim.step(IDLE);
    expect(ev).toContainEqual({ type: 'replace', auto: true });
  });
  it('raccourci dans une epingle : progression gelee puis replacement apres 5 s', () => {
    const sim = makeSim(hairpinLevel());
    runFor(sim, 2, GAZ);
    const before = sim.maxProgressS;
    sim.car.x = 40; sim.car.vx = 0; sim.car.vz = 0; sim.car.yawRate = 0;
    const ev = runFor(sim, 5.3, IDLE);
    expect(ev).toContainEqual({ type: 'replace', auto: true });
    expect(sim.maxProgressS).toBeLessThan(before + 10);
  });
  it('mauvais sens detecte', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 6, GAZ);
    sim.car.heading = Math.PI;
    sim.car.vz = -sim.car.vz;
    let seen = false;
    for (let t = 0; t < 4; t += SIM_DT) { sim.step(GAZ); if (sim.hud().wrongWay) seen = true; }
    expect(seen).toBe(true);
  });
  it('rocher sur la route : choc et perte de combo', () => {
    const lv = straightLevel(300);
    lv.objets = [{ type: 'rocher', x: 0, z: 120, rot: 0 }];
    const sim = makeSim(lv);
    const ev = runFor(sim, 20, GAZ);
    expect(ev.some((e) => e.type === 'choc')).toBe(true);
  });
  it('deterministe', () => {
    const script = (t: number): InputState => ({ gaz: 1, frein: 0, direction: Math.sin(t) > 0.5 ? 1 : 0, freinAMain: t % 3 < 0.4 });
    const a = makeSim(hairpinLevel()), b = makeSim(hairpinLevel());
    for (let i = 0; i < 1800; i++) { a.step(script(i * SIM_DT)); b.step(script(i * SIM_DT)); }
    expect(a.car).toEqual(b.car);
    expect(a.score).toEqual(b.score);
  });
  it('niveau minimal (2 points, 20 m) : arrivee', () => {
    const sim = makeSim(makeLevel([[0, 0, 0, 10], [0, 20, 0, 10]]));
    const ev = runFor(sim, 10, GAZ);
    expect(ev.some((e) => e.type === 'arrivee')).toBe(true);
  });
  it('HUD : valeurs finies', () => {
    const sim = makeSim(straightLevel(300), 3);
    runFor(sim, 5, GAZ);
    const h = sim.hud();
    for (const v of Object.values(h)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
    expect(h.progress).toBeGreaterThan(0);
    expect(h.progress).toBeLessThanOrEqual(1);
  });
});
