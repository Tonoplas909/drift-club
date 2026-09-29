import { describe, it, expect } from 'vitest';
import { createCarState, stepCar, copyCarState } from '../../../src/core/physics/car';
import { CARS, CAR_IDS } from '../../../src/core/physics/cars';
import { MODES, MODE_IDS } from '../../../src/core/physics/assists';
import type { CarId, ModeId, StepContext, CarState } from '../../../src/core/physics/types';
import type { Ground } from '../../../src/core/track/terrain';
import type { InputState } from '../../../src/core/input';
import { SIM_DT } from '../../../src/core/constants';
import { DEG, clamp } from '../../../src/core/math/vec';
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
  it('Arcade : Drift + direction tenus = drift stable (l’aide vise un angle, sans plafond)', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const { maxBeta } = run(c, ctxOf('equilibree', 'arcade'), 6, inp({ gaz: 1, freinAMain: true, direction: 1 }));
    expect(maxBeta).toBeGreaterThan(15 * DEG);
    expect(maxBeta).toBeLessThan(75 * DEG);
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

describe('voiture : direction clavier (rampe asymétrique)', () => {
  const ctx = ctxOf('equilibree', 'exigeant');
  const stepFor = (c: CarState, direction: number, seconds: number) => run(c, ctx, seconds, inp({ direction }));
  it('le retour au centre est plus rapide que l’entrée en braquage', () => {
    const a = createCarState(0, 0, 0), b = createCarState(0, 0, 0);
    a.vz = b.vz = 8;
    b.steerInput = 0.3;
    stepFor(a, 1, 0.03);
    stepFor(b, 0, 0.03);
    expect(a.steerInput).toBeGreaterThan(0.02);
    expect(0.3 - b.steerInput).toBeGreaterThan(a.steerInput * 2);
  });
  it('l’inversion de braquage est plus vive que l’entrée depuis le centre', () => {
    const a = createCarState(0, 0, 0), b = createCarState(0, 0, 0);
    a.vz = b.vz = 8;
    b.steerInput = 0.3;
    stepFor(a, -1, 0.1);
    stepFor(b, -1, 0.1);
    expect(b.steerInput - 0.3).toBeLessThan(a.steerInput - 0.02);
    expect(Math.abs(0.3 - b.steerInput)).toBeGreaterThan(Math.abs(a.steerInput) * 1.5);
  });
  it('contre-braquer dans la glisse est plus vif qu’un braquage normal', () => {
    const a = createCarState(0, 0, 0), b = createCarState(0, 0, 0);
    a.vz = 20;
    b.vz = 20; b.vx = -8; // dérive : vitesse latérale vers la droite (β < 0) → contre-braquage = direction −1
    stepFor(a, -1, 0.1);
    stepFor(b, -1, 0.1);
    expect(Math.abs(b.steerInput)).toBeGreaterThan(Math.abs(a.steerInput) * 1.3);
  });
  it('la butée de braquage diminue avec la vitesse', () => {
    const lent = createCarState(0, 0, 0), vite = createCarState(0, 0, 0);
    lent.vz = 8; vite.vz = 28;
    stepFor(lent, 1, 1);
    stepFor(vite, 1, 0.5);
    expect(vite.steerInput).toBeLessThan(lent.steerInput * 0.7);
  });
  it('une pression brève à 100 km/h ne fait pas décrocher la voiture (3 voitures × 3 modes)', () => {
    for (const id of CAR_IDS) for (const mode of MODE_IDS) {
      const c = createCarState(0, 0, 0);
      c.vz = 27.8;
      let peakYaw = 0;
      const { maxBeta } = run(c, ctxOf(id, mode), 2, (t) => { peakYaw = Math.max(peakYaw, Math.abs(c.yawRate)); return inp({ gaz: 0.5, direction: t < 0.15 ? 1 : 0 }); });
      expect(maxBeta).toBeLessThan(10 * DEG);
      expect(peakYaw).toBeLessThan(0.6);
    }
  });
  it('tenir plein braquage 1 s à 100 km/h puis relâcher ne part pas en tête-à-queue', () => {
    for (const id of CAR_IDS) for (const mode of MODE_IDS) {
      const c = createCarState(0, 0, 0);
      c.vz = 27.8;
      const { maxBeta } = run(c, ctxOf(id, mode), 3, (t) => inp({ gaz: 0.5, direction: t < 1 ? 1 : 0 }));
      expect(maxBeta).toBeLessThan(75 * DEG);
    }
  });
});

describe('voiture : accélérateur lissé', () => {
  it('monte progressivement (0 → 1) et retombe plus vite', () => {
    const c = createCarState(0, 0, 0);
    const ctx = ctxOf('equilibree', 'semi');
    stepCar(c, inp({ gaz: 1 }), ctx, SIM_DT);
    expect(c.throttleSmooth).toBeGreaterThan(0);
    expect(c.throttleSmooth).toBeLessThan(0.1);
    run(c, ctx, 0.5, inp({ gaz: 1 }));
    expect(c.throttleSmooth).toBe(1);
    const t0 = c.throttleSmooth;
    run(c, ctx, 0.1, inp({ gaz: 0 }));
    expect(t0 - c.throttleSmooth).toBeGreaterThan(0.5);
  });
});

describe('voiture : tête-à-queue et drift au clavier', () => {
  /** Pilote clavier : W tenu, angle de dérive visé, régulation P+D convertie en appuis A/D (PWM 0,16 s). */
  const pilote = (mode: ModeId, cible = 35 * DEG) => {
    let pb = 0, bd = 0;
    return (t: number, c: CarState): InputState => {
      bd += ((c.beta - pb) / SIM_DT - bd) * 0.1;
      pb = c.beta;
      let direction = t < 0.25 ? 1 : 0;
      const freinAMain = t >= 0.25 && (mode === 'arcade' || t < 0.7);
      if (t >= 0.25 && mode === 'arcade') direction = 1;
      else if (t >= 0.25) {
        const u = clamp((c.beta + 0.2 * bd + cible) / (15 * DEG), -1, 1);
        direction = (t % 0.16) / 0.16 < Math.abs(u) ? Math.sign(u) : 0;
      }
      return inp({ gaz: 1, direction, freinAMain });
    };
  };
  /** Simule avec un pilote dépendant de l'état ; renvoie temps en drift (15°–100°) et pic |β|. */
  const simule = (id: CarId, mode: ModeId, seconds: number, pil: (t: number, c: CarState) => InputState) => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const ctx = ctxOf(id, mode);
    let enDrift = 0, pic = 0;
    for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
      const t = i * SIM_DT;
      stepCar(c, pil(t, c), ctx, SIM_DT);
      pic = Math.max(pic, Math.abs(c.beta));
      if (t > 1 && Math.abs(c.beta) > 15 * DEG && Math.abs(c.beta) < 100 * DEG && c.speed > 8) enDrift += SIM_DT;
    }
    return { enDrift, pic, c };
  };

  it('un drift se tient au clavier (W tenu + appuis A/D) sans tête-à-queue : 3 voitures × 3 modes', () => {
    for (const id of CAR_IDS) for (const mode of MODE_IDS) {
      const { enDrift, pic, c } = simule(id, mode, 12, pilote(mode));
      expect(enDrift).toBeGreaterThan(5);
      expect(pic).toBeLessThan(100 * DEG);
      expect(c.speed).toBeGreaterThan(4);
    }
  });
  it('tête-à-queue possible dans tous les modes (aucun plafond d’angle)', () => {
    for (const id of CAR_IDS) for (const mode of MODE_IDS) {
      // Arcade : bouton Drift tenu et direction inversée en pleine dérive (flick) ; sinon frein à main puis braquage tenu + plein gaz
      const seq = (t: number): InputState => mode === 'arcade'
        ? inp({ gaz: 1, direction: t < 0.6 ? -1 : 1, freinAMain: true })
        : inp({ gaz: 1, direction: 1, freinAMain: t >= 0.25 && t < 0.7 });
      const { pic } = simule(id, mode, 8, seq);
      expect(pic).toBeGreaterThan(100 * DEG);
    }
  });
  it('en Exigeant, direction tenue sans contre-braquage : le cap tourne de plus de 180° par rapport à la trajectoire', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 25;
    const ctx = ctxOf('equilibree', 'exigeant');
    let maxAbs = 0;
    for (let i = 0; i < Math.round(8 / SIM_DT); i++) {
      const t = i * SIM_DT;
      stepCar(c, inp({ gaz: 1, direction: 1, freinAMain: t >= 0.25 && t < 0.7 }), ctx, SIM_DT);
      maxAbs = Math.max(maxAbs, Math.abs(c.beta));
    }
    expect(maxAbs).toBeGreaterThan(120 * DEG);
  });
  it('le lacet n’est plus plafonné à ±6 rad/s (simple borne numérique)', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 20;
    c.yawRate = 10;
    stepCar(c, inp({}), ctxOf('equilibree', 'exigeant'), SIM_DT);
    expect(c.yawRate).toBeGreaterThan(8);
    c.yawRate = 40;
    stepCar(c, inp({}), ctxOf('equilibree', 'exigeant'), SIM_DT);
    expect(c.yawRate).toBeLessThanOrEqual(12);
  });
  it('les modes n’ont plus de limiteur de tête-à-queue', () => {
    for (const mode of MODE_IDS) {
      expect(MODES[mode]).not.toHaveProperty('betaMax');
      expect(MODES[mode]).not.toHaveProperty('spinStiffness');
    }
  });
  it('les trois voitures restent distinctes : la Turbo a la queue la plus légère, l’Équilibrée la plus stable', () => {
    expect(CARS.turbo.muRear / CARS.turbo.muFront).toBeLessThan(CARS.legere.muRear / CARS.legere.muFront);
    expect(CARS.legere.muRear / CARS.legere.muFront).toBeLessThan(CARS.equilibree.muRear / CARS.equilibree.muFront);
    expect(CARS.legere.steerSpeed).toBeGreaterThan(CARS.equilibree.steerSpeed);
    expect(CARS.turbo.engineForce).toBeGreaterThan(CARS.equilibree.engineForce);
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
