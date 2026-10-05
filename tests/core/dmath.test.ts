import { describe, it, expect } from 'vitest';
import * as dm from '../../src/core/math/dmath';
import { mulberry32 } from '../../src/core/math/rng';

/** Écart relatif (ou absolu près de zéro). */
const ecart = (a: number, b: number): number => Math.abs(a - b) / Math.max(1, Math.abs(b));

function valeurs(n: number, ampli: number, graine: number): number[] {
  const r = mulberry32(graine);
  return Array.from({ length: n }, () => (r() * 2 - 1) * ampli);
}

describe('dmath : fonctions déterministes', () => {
  it('sin, cos et tan proches de Math (angles du jeu et au-delà)', () => {
    for (const x of [...valeurs(4000, 4, 1), ...valeurs(4000, 400, 2), ...valeurs(500, 1e5, 3), 0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI]) {
      expect(ecart(dm.sin(x), Math.sin(x))).toBeLessThan(1e-15);
      expect(ecart(dm.cos(x), Math.cos(x))).toBeLessThan(1e-15);
    }
    for (const x of valeurs(2000, 1.5, 4)) expect(ecart(dm.tan(x), Math.tan(x))).toBeLessThan(3e-15);
    expect(dm.sin(Infinity)).toBeNaN();
    expect(dm.cos(NaN)).toBeNaN();
  });

  it('atan et atan2 proches de Math, mêmes cas particuliers', () => {
    for (const x of [...valeurs(4000, 3, 5), ...valeurs(2000, 1e4, 6), 1e-12, 1e30, -1e30]) {
      expect(ecart(dm.atan(x), Math.atan(x))).toBeLessThan(1e-15);
    }
    const ys = valeurs(3000, 50, 7), xs = valeurs(3000, 50, 8);
    for (let i = 0; i < ys.length; i++) expect(ecart(dm.atan2(ys[i], xs[i]), Math.atan2(ys[i], xs[i]))).toBeLessThan(1e-15);
    for (const y of [0, -0, 1, -1, Infinity, -Infinity]) {
      for (const x of [0, -0, 1, -1, 2, -2, Infinity, -Infinity]) {
        expect(dm.atan2(y, x), `atan2(${y}, ${x})`).toBeCloseTo(Math.atan2(y, x), 15);
        expect(Object.is(dm.atan2(y, x), -0)).toBe(Object.is(Math.atan2(y, x), -0));
      }
    }
  });

  it('exp proche de Math, débordements gérés', () => {
    for (const x of [...valeurs(4000, 5, 9), ...valeurs(1000, 700, 10), 0, 1e-10, 0.3, -0.3, 0.5, 1]) {
      expect(Math.abs(dm.exp(x) - Math.exp(x)) / Math.exp(x)).toBeLessThan(1e-15);
    }
    expect(dm.exp(800)).toBe(Infinity);
    expect(dm.exp(-800)).toBe(0);
    expect(Math.abs(dm.exp(-740) - Math.exp(-740))).toBeLessThanOrEqual(1e-323);
  });

  it('hypot', () => {
    expect(dm.hypot(3, 4)).toBe(5);
    expect(dm.hypot(2, 3, 6)).toBe(7);
  });

  it('résultats figés au bit près (garde-fou : changer ces fonctions change toutes les courses rejouées)', () => {
    let h = 0;
    const melange = (v: number): void => {
      const b = new DataView(new ArrayBuffer(8));
      b.setFloat64(0, v);
      h = Math.imul(h ^ b.getUint32(0), 0x9e3779b1) ^ Math.imul(h ^ b.getUint32(4), 0x85ebca6b);
    };
    for (const x of valeurs(2000, 20, 11)) {
      melange(dm.sin(x)); melange(dm.cos(x)); melange(dm.atan(x)); melange(dm.atan2(x, 1.5 - x)); melange(dm.exp(x / 4)); melange(dm.hypot(x, 2));
    }
    expect(h >>> 0).toBe(EMPREINTE_DMATH);
  });
});

const EMPREINTE_DMATH = 505103753;

describe('src/core : simulation déterministe', () => {
  it("aucune fonction non déterministe de Math dans src/core (utiliser math/dmath)", () => {
    const interdit = /Math\.(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|log|log2|log10|log1p|pow|cbrt|hypot)\b/;
    const sources = import.meta.glob('../../src/core/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const fautifs: string[] = [];
    for (const [p, texte] of Object.entries(sources)) {
      if (p.endsWith('dmath.ts')) continue;
      texte.split('\n').forEach((l, i) => { if (interdit.test(l)) fautifs.push(`${p}:${i + 1}`); });
    }
    expect(Object.keys(sources).length).toBeGreaterThan(30);
    expect(fautifs).toEqual([]);
  });
});
