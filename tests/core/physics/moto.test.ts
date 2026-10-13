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
  it('le roulis est progressif : pas d\'à-coup aux appuis clavier, la moto met du temps à se coucher', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 17;
    let prevVel = 0, maxAcc = 0, a01 = 0;
    for (let i = 0; i < 3 / SIM_DT; i++) {
      const t = i * SIM_DT;
      // appuis secs : gauche 0,6 s, rien, droite 0,6 s, tapotements
      const direction = t < 0.6 ? 1 : t < 0.9 ? 0 : t < 1.5 ? -1 : Math.floor(t / 0.15) % 2;
      stepCar(c, inp({ gaz: 0.6, direction }), ctxOf('supermotard'), SIM_DT);
      if (i > 0) maxAcc = Math.max(maxAcc, Math.abs(c.leanVel - prevVel) / SIM_DT);
      prevVel = c.leanVel;
      if (Math.abs(t - 0.1) < SIM_DT / 2) a01 = Math.abs(c.lean);
    }
    // accélération de roulis bornée (l'ancien modèle partait à vitesse maximale d'un coup : ~50 000 °/s²)
    expect(maxAcc).toBeLessThan(3000 * DEG);
    // 0,1 s après l'appui, la moto n'est encore qu'un peu penchée
    expect(a01).toBeLessThan(8 * DEG);
  });
  it('pour tourner fort, il faut pencher : droite, la moto ne tient que la marge latérale', () => {
    const c = createCarState(0, 0, 0);
    c.vz = 20;
    const vx0 = c.vx;
    stepCar(c, inp({ direction: 1 }), ctxOf('supermotard'), SIM_DT);
    // premier pas, moto droite : accélération latérale au plus leanMarge × g
    expect(Math.abs((c.vx - vx0) / SIM_DT)).toBeLessThanOrEqual((CARS.supermotard.leanMarge ?? 0.3) * G + 1e-9);
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
  it('marche arrière (frein tenu) : jamais de chute, même à pleine vitesse arrière', () => {
    const c = createCarState(0, 0, 0);
    let tombe = false;
    for (let i = 0; i < 10 / SIM_DT; i++) {
      stepCar(c, inp({ frein: 1 }), ctxOf('supermotard', 'semi'), SIM_DT);
      tombe ||= chute(CARS.supermotard, c, 0);
    }
    expect(c.reverse).toBe(true);
    expect(c.speed).toBeGreaterThan(VITESSE_CHUTE);
    expect(tombe).toBe(false);
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

  describe('wheelie', () => {
    /** coup d'embrayage : frein et gaz tenus `charge` s, puis gaz seuls (ou la suite donnée) */
    const rouler = (mode: ModeId, v0: number, T: number, f: (t: number) => InputState) => {
      const c = createCarState(0, 0, 0);
      c.vz = v0;
      c.throttleSmooth = 1;
      let max = 0, tombe = false;
      for (let i = 0; i < T / SIM_DT; i++) {
        stepCar(c, f(i * SIM_DT), ctxOf('supermotard', mode), SIM_DT);
        max = Math.max(max, c.cabrage);
        tombe ||= chute(CARS.supermotard, c, 0);
      }
      return { c, max, tombe };
    };
    const embrayage = (charge = 0.5) => (t: number) => inp({ gaz: 1, frein: t < charge ? 1 : 0 });
    it('plein gaz ou coup de gaz seul : la roue avant ne se lève jamais', () => {
      expect(rouler('semi', 11, 4, () => inp({ gaz: 1 })).max).toBe(0);
      expect(rouler('semi', 7, 4, (t) => inp({ gaz: t < 0.3 ? 0 : 1 })).max).toBe(0);
      expect(rouler('semi', 0, 4, () => inp({ gaz: 1 })).max).toBe(0);
    });
    it('coup d\'embrayage à 25 km/h : wheelie tenu par l\'aide, sans chute (Arcade, Semi)', () => {
      for (const mode of ['arcade', 'semi'] as const) {
        const { c, max, tombe } = rouler(mode, 7, 3, embrayage());
        expect(c.cabrage, mode).toBeGreaterThan(15 * DEG);
        expect(max, mode).toBeLessThan(MODES[mode].antiCabrage + 5 * DEG);
        expect(tombe, mode).toBe(false);
      }
    });
    it('trop vite (70 km/h) ou embrayage trop court : rien ne se lève franchement', () => {
      expect(rouler('semi', 19, 3, embrayage()).max).toBe(0);
      expect(rouler('semi', 7, 3, embrayage(0.15)).max).toBeLessThan(8 * DEG);
    });
    it('Exigeant : gaz tenus, la moto passe par-dessus et tombe ; gaz coupés et frein arrière, elle retombe sur ses roues', () => {
      expect(rouler('exigeant', 7, 3, embrayage()).tombe).toBe(true);
      const { c, max, tombe } = rouler('exigeant', 7, 3, (t) => inp({ gaz: t < 0.85 ? 1 : 0, frein: t < 0.5 ? 1 : 0, freinAMain: t >= 0.85 }));
      expect(max).toBeGreaterThan(15 * DEG);
      expect(tombe).toBe(false);
      expect(c.cabrage).toBe(0);
    });
    it('roue avant en l\'air : la direction ne répond plus', () => {
      const tout = rouler('semi', 7, 1.6, (t) => inp({ gaz: 1, frein: t < 0.5 ? 1 : 0, direction: t > 1 ? 1 : 0 }));
      expect(tout.c.cabrage).toBeGreaterThan(10 * DEG);
      expect(Math.abs(tout.c.heading)).toBeLessThan(3 * DEG);
    });
    it('une voiture ne se cabre jamais', () => {
      const c = createCarState(0, 0, 0);
      c.vz = 7;
      for (let i = 0; i < 3 / SIM_DT; i++) stepCar(c, embrayage()(i * SIM_DT), ctxOf('equilibree', 'exigeant'), SIM_DT);
      expect(c.cabrage).toBe(0);
      expect(c.embrayage).toBe(0);
    });
    it('en course, un wheelie rapporte des points (comme un drift)', () => {
      const level = straightLevel(500);
      const track = buildTrack(level);
      const terrain = new Terrain(track, level.decor.graine);
      const sim = new RaceSim({ level, track, terrain, env: generateEnvironment(level, track, terrain), car: CARS.supermotard, assists: MODES.semi, countdown: 0 });
      const ev = [];
      for (let i = 0; i < 1.2 / SIM_DT; i++) ev.push(...sim.step(inp({ gaz: 1 })));
      // vitesse : ~35 km/h ; on charge l'embrayage puis on tient le wheelie 2 s, on coupe les gaz pour retomber
      for (let i = 0; i < 0.5 / SIM_DT; i++) ev.push(...sim.step(inp({ gaz: 1, frein: 1 })));
      for (let i = 0; i < 2 / SIM_DT; i++) ev.push(...sim.step(inp({ gaz: 1 })));
      for (let i = 0; i < 2 / SIM_DT; i++) ev.push(...sim.step(inp({ freinAMain: true })));
      const banks = ev.filter((e) => e.type === 'bank');
      expect(banks.length).toBe(1);
      expect((banks[0] as { points: number }).points).toBeGreaterThan(0);
    });
  });
});
