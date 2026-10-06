import { describe, it, expect } from 'vitest';
import { createScore, stepScore, finishScore, timeBonus, angleFactor, comboRestant, facteursDrift, type ScoreFrame, type ScoreEvent, type ScoreState } from '../../../src/core/scoring/score';
import { SIM_DT } from '../../../src/core/constants';
import { DEG } from '../../../src/core/math/vec';

const frame = (p: Partial<ScoreFrame>): ScoreFrame =>
  ({ betaRad: 0, speed: 0, onRoad: true, progressRate: 20, crash: false, reset: false, ...p });
const DRIFT = frame({ betaRad: 30 * DEG, speed: 80 / 3.6 });
const STRAIGHT = frame({ speed: 80 / 3.6 });

function hold(st: ScoreState, f: ScoreFrame, seconds: number): ScoreEvent[] {
  const ev: ScoreEvent[] = [];
  for (let i = 0; i < Math.round(seconds / SIM_DT); i++) {
    const e = stepScore(st, f, SIM_DT);
    if (e) ev.push(e);
  }
  return ev;
}

describe('angleFactor', () => {
  it('suit la courbe de la spec', () => {
    expect(angleFactor(10)).toBe(0);
    expect(angleFactor(15)).toBeCloseTo(0.5, 9);
    expect(angleFactor(20)).toBeCloseTo(0.75, 9);
    expect(angleFactor(30)).toBe(1);
    expect(angleFactor(60)).toBe(1);
    expect(angleFactor(90)).toBeCloseTo(0.7, 9);
    expect(angleFactor(120)).toBeCloseTo(0.4, 9);
    expect(angleFactor(150)).toBeCloseTo(0.1, 9);
    expect(angleFactor(165)).toBeCloseTo(0.05, 9);
    expect(angleFactor(180)).toBe(0);
    expect(angleFactor(-90)).toBeCloseTo(0.7, 9);
  });
});

describe('stepScore', () => {
  it('un drift de 2 s à 30° et 80 km/h vaut 1600, encaissé x1', () => {
    const st = createScore();
    expect(hold(st, DRIFT, 2)).toEqual([]);
    expect(st.drift).toBeCloseTo(1600, -1);
    const ev = hold(st, STRAIGHT, 0.6);
    expect(ev.length).toBe(1);
    expect(ev[0]).toMatchObject({ type: 'bank', multiplier: 1 });
    expect(st.total).toBeCloseTo(1600, -1);
    expect(st.multiplier).toBe(2);
    expect(st.bestDrift).toBeCloseTo(1600, -1);
  });
  it('le deuxième drift est multiplié par 2', () => {
    const st = createScore();
    hold(st, DRIFT, 2); hold(st, STRAIGHT, 0.6);
    hold(st, DRIFT, 1);
    const ev = hold(st, STRAIGHT, 0.6);
    expect(ev[0]).toMatchObject({ type: 'bank', multiplier: 2 });
    expect(st.total).toBeCloseTo(3200, -1);
    expect(st.multiplier).toBe(3);
  });
  it('enchaîner avant 0,5 s = un seul drift', () => {
    const st = createScore();
    const ev = [...hold(st, DRIFT, 1), ...hold(st, STRAIGHT, 0.3), ...hold(st, DRIFT, 1), ...hold(st, STRAIGHT, 0.6)];
    expect(ev.length).toBe(1);
    expect(st.total).toBeCloseTo(1600, -1);
  });
  it('choc pendant un drift : perte, combo à x1', () => {
    const st = createScore();
    hold(st, DRIFT, 2); hold(st, STRAIGHT, 0.6);
    hold(st, DRIFT, 1);
    const e = stepScore(st, { ...DRIFT, crash: true }, SIM_DT);
    expect(e?.type).toBe('lose');
    expect(st.drift).toBe(0);
    expect(st.multiplier).toBe(1);
    expect(st.total).toBeCloseTo(1600, -1);
  });
  it('le replacement fait perdre', () => {
    const a = createScore();
    hold(a, DRIFT, 1);
    expect(stepScore(a, { ...STRAIGHT, reset: true }, SIM_DT)?.type).toBe('lose');
  });
  it('un tête-à-queue ne fait plus perdre : le drift continue puis s\'encaisse', () => {
    const b = createScore();
    hold(b, DRIFT, 1);
    const avant = b.drift;
    for (let i = 0; i < 60; i++) expect(stepScore(b, frame({ betaRad: 130 * DEG, speed: 60 / 3.6 }), SIM_DT)?.type).not.toBe('lose');
    expect(b.drift).toBeGreaterThan(avant);
    hold(b, STRAIGHT, 0.6);
    expect(b.total).toBeGreaterThan(0);
    expect(b.multiplier).toBe(2);
  });
  it('hors route ou sans avancer : aucun point', () => {
    const st = createScore();
    hold(st, { ...DRIFT, onRoad: false }, 1);
    hold(st, { ...DRIFT, progressRate: 0 }, 1);
    hold(st, { ...DRIFT, dejaParcouru: true }, 1);
    expect(st.drift).toBe(0);
    expect(hold(st, STRAIGHT, 0.6)).toEqual([]);
    expect(st.multiplier).toBe(1);
  });
  it('le combo retombe après 2 s sans drift', () => {
    const st = createScore();
    hold(st, DRIFT, 1); hold(st, STRAIGHT, 0.6);
    expect(st.multiplier).toBe(2);
    hold(st, STRAIGHT, 1.0);
    expect(st.multiplier).toBe(2);
    hold(st, STRAIGHT, 0.6);
    expect(st.multiplier).toBe(1);
  });
  it('multiplicateur plafonné à x5', () => {
    const st = createScore();
    for (let i = 0; i < 8; i++) { hold(st, DRIFT, 0.5); hold(st, STRAIGHT, 0.6); }
    expect(st.multiplier).toBe(5);
  });
  it('finishScore encaisse le drift en cours', () => {
    const st = createScore();
    hold(st, DRIFT, 1);
    expect(finishScore(st)).toMatchObject({ type: 'bank' });
    expect(st.total).toBeCloseTo(800, -1);
    expect(finishScore(st)).toBeNull();
  });
  it('bonus de temps : 2 500 points par seconde avant le double du temps cible, plafonné aux points de drift', () => {
    expect(timeBonus(60, 50, 1e6)).toBe(175000);
    expect(timeBonus(60, 70, 1e6)).toBe(125000);
    expect(timeBonus(60, 119, 1e6)).toBe(2500);
    expect(timeBonus(60, 120, 1e6)).toBe(0);
    expect(timeBonus(60, 200, 1e6)).toBe(0);
    expect(timeBonus(60, 50, 30000)).toBe(30000);
    expect(timeBonus(60, 50, 0)).toBe(0);
  });
  it('bonus de temps : traîner une seconde de plus coûte 2 500 points', () => {
    expect(timeBonus(60, 80, 1e6) - timeBonus(60, 81, 1e6)).toBe(2500);
  });
});

describe('comboRestant (barre du combo)', () => {
  it('null sans combo ou pendant un drift, 1 à l\'encaissement, décroît jusqu\'à 0 puis retour à x1', () => {
    const st = createScore();
    expect(comboRestant(st)).toBeNull();
    hold(st, DRIFT, 1);
    expect(comboRestant(st)).toBeNull(); // drift en cours
    hold(st, STRAIGHT, 0.5 + SIM_DT);
    expect(st.multiplier).toBe(2);
    const debut = comboRestant(st)!;
    expect(debut).toBeGreaterThan(0.95);
    hold(st, STRAIGHT, 0.75);
    expect(comboRestant(st)!).toBeCloseTo(0.5, 1);
    hold(st, STRAIGHT, 0.8);
    expect(st.multiplier).toBe(1);
    expect(comboRestant(st)).toBeNull();
  });
});

describe('durée du drift (facteurs affichés)', () => {
  it('compte la durée du drift en cours et repart de zéro à l\'encaissement', () => {
    const st = createScore();
    hold(st, DRIFT, 1.2);
    expect(st.driftTime).toBeCloseTo(1.2, 1);
    hold(st, STRAIGHT, 0.6);
    expect(st.driftTime).toBe(0);
  });
});

describe('facteurs affichés = points exacts', () => {
  it('base × km/h moyens × secondes × angle moyen × combo = points du drift, même avec vitesse et angle variables', () => {
    const st = createScore();
    hold(st, DRIFT, 1); hold(st, STRAIGHT, 0.6); // un premier drift encaissé → combo x2
    for (let i = 0; i < 300; i++) {
      const t = i * SIM_DT;
      stepScore(st, frame({ betaRad: (20 + 70 * Math.abs(Math.sin(t * 3))) * DEG, speed: (50 + 60 * t) / 3.6 }), SIM_DT);
    }
    const f = facteursDrift(st)!;
    expect(f.combo).toBe(2);
    expect(f.base * f.kmh * f.secondes * f.angle * f.combo).toBeCloseTo(st.drift * st.multiplier, 6);
    expect(f.angle).toBeGreaterThan(0); expect(f.angle).toBeLessThanOrEqual(1);
  });
  it('null hors drift', () => {
    expect(facteursDrift(createScore())).toBeNull();
  });
});
