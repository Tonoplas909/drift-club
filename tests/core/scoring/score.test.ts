import { describe, it, expect } from 'vitest';
import { createScore, stepScore, finishScore, timeBonus, angleFactor, type ScoreFrame, type ScoreEvent, type ScoreState } from '../../../src/core/scoring/score';
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
    expect(angleFactor(75)).toBeCloseTo(0.75, 9);
    expect(angleFactor(95)).toBe(0);
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
  it('replacement et tête-à-queue font perdre', () => {
    const a = createScore();
    hold(a, DRIFT, 1);
    expect(stepScore(a, { ...STRAIGHT, reset: true }, SIM_DT)?.type).toBe('lose');
    const b = createScore();
    hold(b, DRIFT, 1);
    expect(stepScore(b, frame({ betaRad: 100 * DEG, speed: 60 / 3.6 }), SIM_DT)?.type).toBe('lose');
  });
  it('hors route ou sans avancer : aucun point', () => {
    const st = createScore();
    hold(st, { ...DRIFT, onRoad: false }, 1);
    hold(st, { ...DRIFT, progressRate: 0 }, 1);
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
  it('bonus de temps', () => {
    expect(timeBonus(60, 50)).toBe(20000);
    expect(timeBonus(60, 70)).toBe(0);
  });
});
