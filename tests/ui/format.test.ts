import { describe, it, expect } from 'vitest';
import { formatScore, formatTime, formatDistance } from '../../src/ui/format';

describe('formatage', () => {
  it('score avec espaces fines', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(1234567.4)).toBe('1 234 567');
    expect(formatScore(999)).toBe('999');
  });
  it('temps m:ss.cc sans « 60 secondes »', () => {
    expect(formatTime(83.456)).toBe('1:23.46');
    expect(formatTime(5.2)).toBe('0:05.20');
    expect(formatTime(59.999)).toBe('1:00.00');
  });
  it('distance', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
    expect(formatDistance(850)).toBe('850 m');
  });
});
