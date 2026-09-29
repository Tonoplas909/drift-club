import { describe, it, expect } from 'vitest';
import { sliderSpec, numericKeys, isDebug } from '../../src/debug/panel';

describe('panneau de réglage', () => {
  it('bornes des curseurs', () => {
    expect(sliderSpec(10)).toEqual({ min: 0, max: 30, step: 0.1 });
    expect(sliderSpec(0)).toEqual({ min: 0, max: 1, step: 0.01 });
    expect(sliderSpec(-2).min).toBe(-6);
  });
  it('seulement les champs numériques', () => {
    expect(numericKeys({ a: 1, b: 'x', c: true, d: null, e: 2.5 })).toEqual(['a', 'e']);
  });
  it('détecte ?debug', () => {
    expect(isDebug('?debug')).toBe(true);
    expect(isDebug('?x=1&debug=1')).toBe(true);
    expect(isDebug('')).toBe(false);
  });
});
