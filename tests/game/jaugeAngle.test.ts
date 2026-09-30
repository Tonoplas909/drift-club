import { describe, it, expect } from 'vitest';
import { aiguille, svgJaugeAngle, ZONES_ANGLE } from '../../src/game/jaugeAngle';

describe('indicateur d\'angle', () => {
  it('aiguille verticale à 0°, symétrique, bornée', () => {
    expect(aiguille(0)).toBeCloseTo(0, 9);
    expect(aiguille(60)).toBeCloseTo(-aiguille(-60), 9);
    expect(Math.abs(aiguille(500))).toBeCloseTo(100, 9);
  });
  it('zones contiguës de 0 à 120° et SVG complet', () => {
    for (let i = 1; i < ZONES_ANGLE.length; i++) expect(ZONES_ANGLE[i].de).toBe(ZONES_ANGLE[i - 1].a);
    expect(svgJaugeAngle().match(/<path/g)?.length).toBe(ZONES_ANGLE.length * 2);
  });
});
