import { describe, it, expect } from 'vitest';
import { DUREE_ROULETTE, DUREE_ROULETTE_REDUITE, defilementFinal, easeOutRoulette, indexSousRepere, nouvelRng } from '../../src/ui/roulette';
import { INDEX_GAGNANT } from '../../src/core/caisses';

describe('roulette : courbe', () => {
  it('part de 0, arrive à 1, croissante et décélérée', () => {
    expect(easeOutRoulette(0)).toBe(0);
    expect(easeOutRoulette(1)).toBe(1);
    let prec = 0, vPrec = Infinity;
    for (let i = 1; i <= 100; i++) {
      const v = easeOutRoulette(i / 100), dv = v - easeOutRoulette((i - 1) / 100);
      expect(v).toBeGreaterThanOrEqual(prec);
      expect(dv).toBeLessThanOrEqual(vPrec + 1e-12); // la vitesse ne fait que baisser
      prec = v; vPrec = dv;
    }
  });
  it('bornée hors de [0, 1]', () => {
    expect(easeOutRoulette(-3)).toBe(0);
    expect(easeOutRoulette(7)).toBe(1);
  });
  it('rapide au départ (> 85 % du chemin fait à mi-parcours), lente à la fin (< 5 % restant à 80 %)', () => {
    expect(easeOutRoulette(0.5)).toBeGreaterThan(0.85);
    expect(1 - easeOutRoulette(0.8)).toBeLessThan(0.05);
  });
  it('durées : ~5-6 s, plus courte en mouvement réduit', () => {
    expect(DUREE_ROULETTE).toBeGreaterThanOrEqual(5000);
    expect(DUREE_ROULETTE).toBeLessThanOrEqual(6000);
    expect(DUREE_ROULETTE_REDUITE).toBeLessThan(DUREE_ROULETTE / 2);
  });
});

describe('roulette : arrêt sur la carte gagnante', () => {
  const pas = 142, largeurCarte = 132, vue = 1000;
  it('le repère tombe toujours dans la carte gagnante, quel que soit le décalage tiré', () => {
    for (const decal of [-1, -0.5, 0, 0.3, 1, 5, -5]) {
      const d = defilementFinal(INDEX_GAGNANT, pas, largeurCarte, vue, decal);
      expect(indexSousRepere(d, vue, pas)).toBe(INDEX_GAGNANT);
      const x = d + vue / 2 - INDEX_GAGNANT * pas; // position du repère dans la carte
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(largeurCarte);
    }
  });
  it('décalage 0 : repère au centre de la carte ; les décalages diffèrent', () => {
    const d0 = defilementFinal(10, pas, largeurCarte, vue, 0);
    expect(d0 + vue / 2 - 10 * pas).toBeCloseTo(largeurCarte / 2, 9);
    expect(defilementFinal(10, pas, largeurCarte, vue, 0.5)).toBeGreaterThan(d0);
  });
  it('indexSousRepere : suit le défilement carte par carte, jamais négatif', () => {
    expect(indexSousRepere(0, vue, pas)).toBe(Math.floor(vue / 2 / pas));
    expect(indexSousRepere(-9999, vue, pas)).toBe(0);
    let prec = -1;
    for (let d = 0; d < 3000; d += 7) { const i = indexSousRepere(d, vue, pas); expect(i).toBeGreaterThanOrEqual(prec); prec = i; }
  });
  it('en fin de course la carte sous le repère est la gagnante (tic de fin cohérent avec le résultat)', () => {
    const finale = defilementFinal(INDEX_GAGNANT, pas, largeurCarte, vue, 0.7);
    expect(indexSousRepere(finale * easeOutRoulette(1), vue, pas)).toBe(INDEX_GAGNANT);
    expect(indexSousRepere(finale * easeOutRoulette(0.5), vue, pas)).toBeLessThan(INDEX_GAGNANT);
  });
});

describe('nouvelRng', () => {
  it('générateur dans [0, 1[ ; deux instances diffèrent', () => {
    const a = nouvelRng(), b = nouvelRng();
    const xs = Array.from({ length: 5 }, () => a());
    for (const x of xs) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
    expect(xs).not.toEqual(Array.from({ length: 5 }, () => b()));
  });
});
