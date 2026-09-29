import { describe, it, expect } from 'vitest';
import { SIM_DT } from '../../src/core/constants';
import { NO_INPUT } from '../../src/core/input';

describe('constantes', () => {
  it('pas de simulation de 1/120 s', () => {
    expect(SIM_DT).toBeCloseTo(1 / 120, 12);
  });
  it('entrée neutre', () => {
    expect(NO_INPUT).toEqual({ gaz: 0, frein: 0, direction: 0, freinAMain: false });
  });
});
