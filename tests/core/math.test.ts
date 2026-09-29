import { describe, it, expect } from 'vitest';
import { clamp, lerp, smoothstep, wrapAngle, DEG } from '../../src/core/math/vec';
import { mulberry32, hash2, randInt } from '../../src/core/math/rng';
import { valueNoise, fbm } from '../../src/core/math/noise';

describe('vec', () => {
  it('clamp / lerp / smoothstep', () => {
    expect(clamp(5, 0, 2)).toBe(2);
    expect(clamp(-1, 0, 2)).toBe(0);
    expect(lerp(10, 20, 0.25)).toBe(12.5);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5, 10);
  });
  it('wrapAngle ramène dans ]-pi, pi]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 9);
    expect(wrapAngle(-3 * Math.PI / 2)).toBeCloseTo(Math.PI / 2, 9);
    expect(wrapAngle(0.3)).toBeCloseTo(0.3, 12);
    expect(DEG * 180).toBeCloseTo(Math.PI, 12);
  });
});

describe('rng', () => {
  it('mulberry32 est déterministe et dans [0,1[', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
  it('graines différentes → suites différentes', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
  it('hash2 déterministe et dans [0,1[', () => {
    for (let i = -20; i < 20; i++) {
      const h = hash2(i, i * 7, 99);
      expect(h).toBe(hash2(i, i * 7, 99));
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
  });
  it('randInt reste dans [0, n[', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 3);
      expect([0, 1, 2]).toContain(v);
    }
  });
});

describe('bruit', () => {
  it('valueNoise continu et dans [0,1]', () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.137, z = i * 0.071;
      const n = valueNoise(x, z, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
      expect(Math.abs(valueNoise(x + 0.001, z, 5) - n)).toBeLessThan(0.01);
    }
  });
  it('fbm dans [0,1] et déterministe', () => {
    for (let i = 0; i < 100; i++) {
      const v = fbm(i * 1.3, -i * 0.7, 12);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBe(fbm(i * 1.3, -i * 0.7, 12));
    }
  });
});
