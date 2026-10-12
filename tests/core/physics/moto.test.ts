import { describe, it, expect } from 'vitest';
import { createCarState, stepCar } from '../../../src/core/physics/car';
import { CARS, CAR_IDS, VOITURE_IDS, estMotoId } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import { chute, VITESSE_CHUTE } from '../../../src/core/physics/moto';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';
import type { InputState } from '../../../src/core/input';
import type { CarId, ModeId, StepContext } from '../../../src/core/physics/types';
import type { Ground } from '../../../src/core/track/terrain';
import { RaceSim } from '../../../src/core/race/race';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { generateEnvironment } from '../../../src/core/env/generate';
import { VEHICULES_DEFI } from '../../../src/core/niveauGenere';
import { straightLevel } from '../../fixtures/levels';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };
const ctxOf = (car: CarId, mode: ModeId = 'semi'): StepContext => ({ params: CARS[car], assists: MODES[mode], ground: flat, onRoad: true });
const inp = (o: Partial<InputState>): InputState => ({ gaz: 0, frein: 0, direction: 0, freinAMain: false, ...o });
const G = 9.81;

describe('motos', () => {
  it('la Supermotard est une moto, les autres des voitures', () => {
    expect(CARS.supermotard.genre).toBe('moto');
    expect(estMotoId('supermotard')).toBe(true);
    expect(VOITURE_IDS).toEqual(CAR_IDS.filter((id) => id !== 'supermotard'));
    const p = CARS.supermotard;
    expect(p.width).toBeLessThan(1);
    expect(p.wheelbase).toBeLessThan(1.6);
    expect(p.mass).toBeLessThan(300);
  });
  it('en virage, la moto penche vers l\'intérieur, à l\'angle qui équilibre l\'accélération latérale', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 15;
    let ay = 0;
    for (let i = 0; i < 3 / SIM_DT; i++) {
      const vx0 = c.vx, vz0 = c.vz;
      stepCar(c, inp({ gaz: 0.3, direction: 0.4 }), ctxOf('supermotard'), SIM_DT);
      // accélération latérale (repère moto, + à gauche)
      const ax = (c.vx - vx0) / SIM_DT, az = (c.vz - vz0) / SIM_DT;
      ay = ax * Math.cos(c.heading) - az * Math.sin(c.heading);
    }
    expect(Math.abs(c.lean)).toBeGreaterThan(10 * DEG);
    expect(Math.sign(c.lean)).toBe(Math.sign(ay));
    expect(Math.abs(c.lean - Math.atan(ay / G))).toBeLessThan(6 * DEG);
  });
  it('l\'inclinaison ne dépasse jamais leanMax, et une voiture ne penche jamais', () => {
    for (const id of ['supermotard', 'equilibree'] as const) {
      const c = createCarState(0, 0, 0);
      c.vz = 25;
      let max = 0;
      for (let i = 0; i < 6 / SIM_DT; i++) {
        stepCar(c, inp({ gaz: 1, direction: i * SIM_DT < 3 ? 1 : -1, freinAMain: i % 200 < 40 }), ctxOf(id, 'exigeant'), SIM_DT);
        max = Math.max(max, Math.abs(c.lean));
      }
      if (id === 'equilibree') expect(max).toBe(0);
      else { expect(max).toBeGreaterThan(20 * DEG); expect(max).toBeLessThanOrEqual(CARS.supermotard.leanMax! + 1e-12); }
    }
  });
  it('chute : trop en travers au-dessus de 20 km/h, ou gros choc ; jamais pour une voiture', () => {
    const c = createCarState(0, 0, 0);
    c.speed = VITESSE_CHUTE + 1;
    c.beta = 75 * DEG;
    expect(chute(CARS.supermotard, c, 0)).toBe(true);
    expect(chute(CARS.equilibree, c, 0)).toBe(false);
    c.beta = 40 * DEG;
    expect(chute(CARS.supermotard, c, 0)).toBe(false);
    expect(chute(CARS.supermotard, c, 10)).toBe(true);
    c.beta = 120 * DEG; c.speed = 3;
    expect(chute(CARS.supermotard, c, 0)).toBe(false);
  });
  it('en course, une chute fait perdre le drift et replace la moto', () => {
    const level = straightLevel(400);
    const track = buildTrack(level);
    const terrain = new Terrain(track, level.decor.graine);
    const sim = new RaceSim({ level, track, terrain, env: generateEnvironment(level, track, terrain), car: CARS.supermotard, assists: MODES.exigeant, countdown: 0 });
    for (let i = 0; i < 240; i++) sim.step(inp({ gaz: 1 }));
    // on la jette en travers
    sim.car.heading += 80 * DEG;
    const ev = sim.step(inp({ gaz: 1 }));
    expect(ev.some((e) => e.type === 'chute')).toBe(true);
    expect(ev.some((e) => e.type === 'replace' && e.auto)).toBe(true);
    expect(Math.abs(sim.car.beta)).toBeLessThan(1e-9);
  });
  it('le défi du jour ne tire que parmi les sept voitures d\'origine (liste figée)', () => {
    expect([...VEHICULES_DEFI]).toEqual(['equilibree', 'legere', 'turbo', 'kei', 'muscle', 'rotative', 'break']);
  });
});
