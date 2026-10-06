import { describe, it, expect } from 'vitest';
import { RaceSim, MARGE_REPARCOURS, type RaceEvent } from '../../../src/core/race/race';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { projectOnTrack } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import type { InputState } from '../../../src/core/input';
import type { Level } from '../../../src/core/level/types';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';
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
    expect(r.bonus).toBe(Math.round(Math.min(r.driftPoints * 0.5, Math.max(0, 1.5 * r.targetTime - r.time) * 1000)));
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

describe('RaceSim : reculer puis réavancer ne rapporte rien', () => {
  /** Roule 5 s, recule éventuellement la voiture, puis la force en glisse (cap décalé de 30°) pendant 0,5 s. */
  function glisse(reculer: number): { drift: number; derriere: number } {
    const sim = makeSim(straightLevel(800));
    runFor(sim, 5, GAZ);
    sim.car.z -= reculer;
    runFor(sim, 0.3, GAZ); // la progression suit la voiture
    const derriere = sim.maxProgressS - sim.progressS;
    for (let i = 0; i < 60; i++) {
      sim.car.heading = Math.atan2(sim.car.vx, sim.car.vz) + 30 * DEG;
      sim.step(GAZ);
    }
    expect(sim.maxProgressS - sim.progressS).toBeGreaterThan(reculer > 0 ? MARGE_REPARCOURS : -1);
    return { drift: sim.score.drift + sim.score.total, derriere };
  }
  it('drift sur route nouvelle : des points', () => {
    const g = glisse(0);
    expect(g.derriere).toBeLessThan(MARGE_REPARCOURS);
    expect(g.drift).toBeGreaterThan(100);
  });
  it('même drift 80 m derrière la progression maximale : aucun point', () => {
    const g = glisse(80);
    expect(g.derriere).toBeGreaterThan(MARGE_REPARCOURS);
    expect(g.drift).toBe(0);
  });
  it('un replacement ne compte pas comme un recul (posé 5 m avant la progression maximale)', () => {
    const sim = makeSim(straightLevel(300));
    runFor(sim, 4, GAZ);
    sim.step(IDLE, true);
    expect(sim.maxProgressS - sim.progressS).toBeLessThan(MARGE_REPARCOURS);
  });
});

describe('RaceSim : arrivée franchie en glisse hors de la chaussée', () => {
  it('la ligne compte même 1,5 m hors de la route : le combo en cours est encaissé, rien après ne l\'annule', () => {
    // sans décor : seule compte la ligne d'arrivée (pas de borne sur le bas-côté)
    const level = straightLevel(300);
    const track = buildTrack(level), terrain = new Terrain(track, level.decor.graine);
    const sim = new RaceSim({ level, track, terrain, env: { items: [], circles: [], segments: [], barriers: [] }, car: CARS.equilibree, assists: MODES.semi, countdown: 0 });
    for (let i = 0; i < 4000 && sim.car.z < 255; i++) sim.step(GAZ);
    // drift sur la route jusqu'à 25 m de la ligne
    for (let i = 0; i < 4000 && sim.car.z < 275; i++) {
      sim.car.heading = Math.atan2(sim.car.vx, sim.car.vz) + 30 * DEG;
      sim.step(GAZ);
    }
    expect(sim.score.drift).toBeGreaterThan(0);
    const avant = sim.score.total + sim.score.drift * sim.score.multiplier;
    // la voiture déborde de 1,5 m (demi-largeur 5 m) et franchit la ligne en glisse
    let arrivee: RaceEvent | undefined;
    for (let i = 0; i < 600 && !arrivee; i++) {
      sim.car.x = 6.5;
      sim.car.heading = Math.atan2(sim.car.vx, sim.car.vz) + 30 * DEG;
      arrivee = sim.step(GAZ).find((e) => e.type === 'arrivee');
    }
    expect(arrivee).toBeDefined();
    expect(sim.car.z).toBeLessThan(302); // à la ligne, pas plus loin
    const r = sim.result!;
    expect(r.driftPoints).toBeGreaterThanOrEqual(Math.round(avant * 0.9));
    // ce qui se passe derrière la ligne ne change plus rien
    runFor(sim, 2, GAZ);
    expect(sim.result).toEqual(r);
  });
});
