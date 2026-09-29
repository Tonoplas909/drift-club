import { describe, it, expect } from 'vitest';
import { createCarState, stepCar, copyCarState } from '../../../src/core/physics/car';
import { CARS, CAR_IDS } from '../../../src/core/physics/cars';
import { MODES, MODE_IDS } from '../../../src/core/physics/assists';
import type { CarId, ModeId, StepContext, CarState } from '../../../src/core/physics/types';
import type { Ground } from '../../../src/core/track/terrain';
import type { InputState } from '../../../src/core/input';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';
import { mulberry32 } from '../../../src/core/math/rng';

const flat: Ground = { heightAt: () => 0, gradientAt: () => ({ gx: 0, gz: 0 }) };
const ctxOf = (car: CarId, mode: ModeId, ground: Ground = flat, onRoad = true): StepContext =>
  ({ params: CARS[car], assists: MODES[mode], ground, onRoad });
const inp = (p: Partial<InputState>): InputState => ({ gaz: 0, frein: 0, direction: 0, freinAMain: false, ...p });

function run(car: CarState, ctx: StepContext, seconds: number, input: InputState | ((t: number) => InputState)) {
  let maxBeta = 0;
  const steps = Math.round(seconds / SIM_DT);
  for (let i = 0; i < steps; i++) {
    const t = i * SIM_DT;
    stepCar(car, typeof input === 'function' ? input(t) : input, ctx, SIM_DT);
    maxBeta = Math.max(maxBeta, Math.abs(car.beta));
  }
  return { maxBeta };
}

const finite = (c: CarState) => Object.values(c).every((v) => typeof v !== 'number' || Number.isFinite(v));

describe('voiture : ligne droite', () => {
  it('accélère pleins gaz sans dévier', () => {
    const c = createCarState(0, 0, 0);
    run(c, ctxOf('equilibree', 'semi'), 5, inp({ gaz: 1 }));
    expect(c.speed).toBeGreaterThan(14);
    expect(c.speed).toBeLessThan(28);
    expect(Math.abs(c.x)).toBeLessThan(0.5);
    expect(Math.abs(c.heading)).toBeLessThan(0.01);
    expect(c.z).toBeGreaterThan(30);
  });
  it('plafonne près de la vitesse max', () => {
    for (const id of CAR_IDS) {
      const c = createCarState(0, 0, 0);
      run(c, ctxOf(id, 'semi'), 60, inp({ gaz: 1 }));
      expect(c.speed).toBeGreaterThan(0.75 * CARS[id].maxSpeed);
      expect(c.speed).toBeLessThanOrEqual(CARS[id].maxSpeed + 0.5);
    }
  });
  it('freine de 25 m/s à l’arrêt en moins de 70 m', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const ctx = ctxOf('equilibree', 'semi');
    let t = 0;
    while (c.speed > 0.5 && t < 6) { stepCar(c, inp({ frein: 1 }), ctx, SIM_DT); t += SIM_DT; }
    expect(t).toBeLessThan(5);
    expect(c.z).toBeLessThan(70);
  });
  it('recule en maintenant le frein à l’arrêt', () => {
    const c = createCarState(0, 0, 0);
    run(c, ctxOf('equilibree', 'semi'), 3, inp({ frein: 1 }));
    expect(c.reverse).toBe(true);
    expect(c.vLong).toBeLessThan(-2);
    expect(c.vLong).toBeGreaterThan(-8.5);
  });
});

describe('voiture : virages et glisse', () => {
  it('tourne à gauche (cap qui augmente, x qui augmente)', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 8;
    run(c, ctxOf('equilibree', 'semi'), 2, inp({ gaz: 0.3, direction: 1 }));
    expect(c.heading).toBeGreaterThan(0.3);
    expect(c.x).toBeGreaterThan(1);
  });
  it('le frein à main fait décrocher l’arrière (semi et exigeant)', () => {
    for (const mode of ['semi', 'exigeant'] as ModeId[]) {
      const c = createCarState(0, 0, 0);
      c.vz = 20;
      const { maxBeta } = run(c, ctxOf('equilibree', mode), 1.5, (t) =>
        t < 0.3 ? inp({ gaz: 0.5, direction: 1 }) : inp({ direction: 1, freinAMain: true }));
      expect(maxBeta).toBeGreaterThan(20 * DEG);
    }
  });
  it('Arcade : le drift tient et ne part pas en tête-à-queue', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const { maxBeta } = run(c, ctxOf('equilibree', 'arcade'), 6, inp({ gaz: 1, freinAMain: true, direction: 1 }));
    expect(maxBeta).toBeGreaterThan(15 * DEG);
    expect(maxBeta).toBeLessThanOrEqual(60 * DEG);
    expect(c.speed).toBeGreaterThan(8);
  });
  it('hors route : vitesse de pointe plus basse', () => {
    const on = createCarState(0, 0, 0), off = createCarState(0, 0, 0);
    run(on, ctxOf('equilibree', 'semi', flat, true), 20, inp({ gaz: 1 }));
    run(off, ctxOf('equilibree', 'semi', flat, false), 20, inp({ gaz: 1 }));
    expect(off.speed).toBeLessThan(on.speed - 1);
  });
  it('pente : la voiture roule seule vers le bas', () => {
    const slope: Ground = { heightAt: (_x, z) => -0.1 * z, gradientAt: () => ({ gx: 0, gz: -0.1 }) };
    const c = createCarState(0, 0, 0);
    run(c, ctxOf('equilibree', 'semi', slope), 5, inp({}));
    expect(c.vz).toBeGreaterThan(2);
    expect(c.y).toBeCloseTo(-0.1 * c.z, 6);
  });
});

describe('voiture : robustesse', () => {
  const randomInputs = (seed: number) => {
    const r = mulberry32(seed);
    let cur = inp({});
    let next = 0;
    return (t: number) => {
      if (t >= next) {
        cur = inp({ gaz: r() < 0.7 ? r() : 0, frein: r() < 0.2 ? r() : 0, direction: r() * 2 - 1, freinAMain: r() < 0.2 });
        next = t + 0.25;
      }
      return cur;
    };
  };
  it('déterministe : mêmes entrées, même état au bit près', () => {
    const a = createCarState(0, 0, 0), b = createCarState(0, 0, 0);
    run(a, ctxOf('turbo', 'semi'), 20, randomInputs(7));
    run(b, ctxOf('turbo', 'semi'), 20, randomInputs(7));
    expect(a).toEqual(b);
  });
  it('3 voitures × 3 modes, 30 s d’entrées aléatoires : état fini, vitesse bornée', () => {
    for (const id of CAR_IDS) for (const mode of MODE_IDS) {
      const c = createCarState(0, 0, 0);
      run(c, ctxOf(id, mode), 30, randomInputs(id.length * 31 + mode.length));
      expect(finite(c)).toBe(true);
      expect(c.speed).toBeLessThan(80);
    }
  });
  it('copyCarState copie toutes les valeurs', () => {
    const c = createCarState(1, 2, 0.5, 3);
    c.vx = 4;
    const d = copyCarState(c);
    expect(d).toEqual(c);
    expect(d).not.toBe(c);
  });
});
