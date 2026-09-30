import { describe, it, expect } from 'vitest';
import { rangFr } from '../../src/ui/classement';

describe('rangFr', () => {
  it('1er puis 2e, 3e…', () => {
    expect(rangFr(1)).toBe('1er');
    expect(rangFr(2)).toBe('2e');
    expect(rangFr(12)).toBe('12e');
  });
});
