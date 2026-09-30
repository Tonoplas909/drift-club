import { describe, it, expect } from 'vitest';
import { gaugeRatio, gaugeColor } from '../../src/render/speedGauge';

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
});
