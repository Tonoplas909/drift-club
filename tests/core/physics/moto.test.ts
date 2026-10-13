import { describe, it, expect } from 'vitest';
import { createCarState, stepCar, jaugesMoto } from '../../../src/core/physics/car';
import { etatJaugesMoto } from '../../../src/game/hud';
import { CARS, CAR_IDS, VOITURE_IDS, MOTO_IDS, estMotoId } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import { chute, VITESSE_CHUTE } from '../../../src/core/physics/moto';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';
import type { InputState } from '../../../src/core/input';
import type { CarId, ModeId, MotoId, StepContext } from '../../../src/core/physics/types';
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
  it('la Supermotard et la Sportive sont des motos, les autres des voitures', () => {
    expect(MOTO_IDS).toEqual(['supermotard', 'sportive']);
    expect(VOITURE_IDS).toEqual(CAR_IDS.filter((id) => !MOTO_IDS.includes(id as MotoId)));
    for (const id of MOTO_IDS) {
      const p = CARS[id];
      expect(p.genre).toBe('moto');
      expect(estMotoId(id)).toBe(true);
      expect(p.width).toBeLessThan(1);
      expect(p.wheelbase).toBeLessThan(1.6);
      expect(p.mass).toBeLessThan(300);
    }
  });
  it('la Sportive : plus rapide que la Supermotard, couchée plus loin, et elle lève aussi l\'avant (embrayage, pompage)', () => {
    const plein = (id: MotoId) => {
      const c = createCarState(0, 0, 0);
      for (let i = 0; i < 20 / SIM_DT; i++) stepCar(c, inp({ gaz: 1 }), ctxOf(id), SIM_DT);
      return c.speed;
    };
    expect(plein('sportive')).toBeGreaterThan(plein('supermotard') + 8);
    expect(CARS.sportive.leanMax!).toBeGreaterThan(CARS.supermotard.leanMax!);
    const lever = (f: (t: number) => InputState) => {
      const c = createCarState(0, 0, 0);
      c.vz = 8;
      c.throttleSmooth = 1;
      let max = 0;
      for (let i = 0; i < 2.5 / SIM_DT; i++) {
        stepCar(c, f(i * SIM_DT), ctxOf('sportive'), SIM_DT);
        max = Math.max(max, c.cabrage);
      }
      return max;
    };
    expect(lever((t) => inp({ gaz: 1, frein: t < 0.6 ? 1 : 0 }))).toBeGreaterThan(12 * DEG);
    expect(lever((t) => inp({ gaz: 1, direction: t < 1 ? (Math.floor(t / 0.2) % 2 ? -1 : 1) : 0 }))).toBeGreaterThan(12 * DEG);
    expect(lever(() => inp({ gaz: 1 }))).toBe(0);
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
    it('roue avant en l\'air : on dirige un peu, au corps (virage large, la moto reste en wheelie)', () => {
      const cap = (dir: number) => {
        const r = rouler('semi', 8, 2.6, (t) => inp({ gaz: 1, frein: t < 0.6 ? 1 : 0, direction: t > 1 ? dir : 0 }));
        expect(r.c.cabrage).toBeGreaterThan(10 * DEG);
        expect(r.tombe).toBe(false);
        return r.c.heading;
      };
      expect(cap(0)).toBe(0);
      const droite = cap(1);
      expect(droite).toBeGreaterThan(5 * DEG);
      expect(droite).toBeLessThan(25 * DEG); // bien moins qu'avec la roue avant au sol
      expect(cap(-1)).toBe(-droite);
    });
    describe('pompage de fourche', () => {
      /** à ~40 km/h, gaz ouverts : `direction(t)` pendant 1 s, puis tout droit */
      const sortie = (mode: ModeId, direction: (t: number) => number) => rouler(mode, 11, 2.5, (t) => inp({ gaz: 1, direction: t < 1 ? direction(t) : 0 }));
      const alterne = (periode: number) => (t: number) => (Math.floor(t / periode) % 2 ? -1 : 1);
      it('deux ou trois coups de guidon rapides, gaz ouverts : l\'avant se lève en sortie de virage', () => {
        for (const mode of ['arcade', 'semi'] as const) {
          for (const periode of [0.15, 0.25]) {
            const { max, tombe } = sortie(mode, alterne(periode));
            expect(max, `${mode} ${periode}`).toBeGreaterThan(15 * DEG);
            expect(max, `${mode} ${periode}`).toBeLessThan(MODES[mode].antiCabrage + 5 * DEG);
            expect(tombe, `${mode} ${periode}`).toBe(false);
          }
        }
      });
      it('virage normal, chicane ou slalom tranquille : rien ne se lève', () => {
        expect(sortie('semi', () => 1).max).toBe(0);
        expect(rouler('semi', 11, 2.5, (t) => inp({ gaz: 1, direction: t < 0.7 ? 1 : t < 1.4 ? -1 : 0 })).max).toBe(0);
        expect(rouler('semi', 11, 4, (t) => inp({ gaz: 1, direction: alterne(0.8)(t) })).max).toBe(0);
      });
      it('jauge : la fourche passe au vert (« Gaz ! ») après les coups de guidon ; les gaz à ce moment lèvent l\'avant', () => {
        const c = createCarState(0, 0, 0);
        c.vz = 11;
        const ctx = ctxOf('supermotard', 'semi');
        let t = 0, pret = -1, max = 0;
        for (let i = 0; i < 2.5 / SIM_DT; i++, t += SIM_DT) {
          const gaz = pret >= 0 ? 1 : 0.5;
          stepCar(c, inp({ gaz, direction: pret < 0 && t < 1.2 ? alterne(0.2)(t) : 0 }), ctx, SIM_DT);
          const j = jaugesMoto(c, ctx)!;
          if (pret < 0 && j.fourchePrete) {
            pret = t;
            expect(j.fourche).toBe(1);
            expect(etatJaugesMoto(j)).toMatchObject({ fourche: 1, fourcheEtat: 'pret' });
          }
          max = Math.max(max, c.cabrage);
        }
        expect(pret).toBeGreaterThan(0);
        expect(max).toBeGreaterThan(10 * DEG);
      });
      it('gaz fermés ou trop vite (plus de ~95 km/h) : rien ne se lève', () => {
        expect(rouler('semi', 11, 2.5, (t) => inp({ gaz: 0.5, direction: t < 1 ? alterne(0.2)(t) : 0 })).max).toBe(0);
        expect(rouler('semi', 27, 2.5, (t) => inp({ gaz: 1, direction: t < 1 ? alterne(0.2)(t) : 0 })).max).toBe(0);
      });
    });
    it('jauge d\'embrayage : pleine (« Lâche ! ») à 25 km/h, « Trop vite » à 70 km/h, « Redresse » penchée ; rien pour une voiture', () => {
      const charger = (v0: number, lean = 0) => {
        const c = createCarState(0, 0, 0);
        c.vz = v0;
        for (let i = 0; i < 0.6 / SIM_DT; i++) {
          stepCar(c, inp({ gaz: 1, frein: 1 }), ctxOf('supermotard'), SIM_DT);
          if (lean) c.lean = lean;
        }
        return etatJaugesMoto(jaugesMoto(c, ctxOf('supermotard'))!);
      };
      expect(charger(7)).toMatchObject({ charge: 1, chargeEtat: 'pret', chargeMot: 'Lâche !' });
      expect(charger(19)).toMatchObject({ chargeEtat: 'vain', chargeMot: 'Trop vite' });
      expect(charger(7, 25 * DEG)).toMatchObject({ chargeEtat: 'vain', chargeMot: 'Redresse' });
      expect(jaugesMoto(createCarState(0, 0, 0), ctxOf('equilibree'))).toBeNull();
      expect(etatJaugesMoto(jaugesMoto(createCarState(0, 0, 0), ctxOf('supermotard'))!)).toMatchObject({ charge: 0, fourche: 0 });
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
