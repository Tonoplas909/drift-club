import { describe, it, expect } from 'vitest';
import { gaugeRatio, gaugeColor, repereDrift, SpeedGauge } from '../../src/render/speedGauge';
import { DEFAULT_SCORE_PARAMS } from '../../src/core/scoring/score';

describe('jauge de vitesse', () => {
  it('vide à l’arrêt et en marche arrière, pleine à la vitesse max', () => {
    expect(gaugeRatio(0, false, 50)).toBe(0);
    expect(gaugeRatio(5, true, 50)).toBe(0);
    expect(gaugeRatio(25, false, 50)).toBeCloseTo(0.5, 9);
    expect(gaugeRatio(50, false, 50)).toBe(1);
    expect(gaugeRatio(60, false, 50)).toBe(1);
  });
  it('vire du vert au rouge en se remplissant', () => {
    const vert = gaugeColor(0), milieu = gaugeColor(0.5), rouge = gaugeColor(1);
    expect(vert.g).toBeGreaterThan(vert.r);
    expect(rouge.r).toBeGreaterThan(0.5);
    expect(rouge.g).toBeLessThan(0.1);
    expect(milieu.r).toBeGreaterThan(vert.r);
    expect(milieu.g).toBeGreaterThan(rouge.g);
  });
  it('repère des drifts qui comptent : à la vitesse minimale du score', () => {
    const pleine = 50;
    const r = repereDrift(pleine);
    expect(r).toBeCloseTo(DEFAULT_SCORE_PARAMS.speedMinKmh / 3.6 / pleine, 9);
    // la jauge atteint le repère exactement à cette vitesse
    expect(gaugeRatio(DEFAULT_SCORE_PARAMS.speedMinKmh / 3.6, false, pleine)).toBeCloseTo(r, 9);
    expect(repereDrift(5)).toBe(1);
    const g = new SpeedGauge();
    g.setRepere(r);
    g.setRepere(null);
    g.dispose();
  });
});
