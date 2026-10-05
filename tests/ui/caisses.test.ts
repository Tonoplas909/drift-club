import { describe, it, expect } from 'vitest';
import { MAX_LOT, meilleure, tailleLot } from '../../src/ui/caisses';
import type { Ouverture } from '../../src/core/economie';
import { progressionVide } from '../../src/core/economie';
import type { Objet } from '../../src/core/caisses';

const ou = (rarete: Objet['rarete'], doublon = false, skin = 'x'): Ouverture => ({
  progression: progressionVide(), tirage: { objet: { car: 'turbo', skin, rarete } as Objet, doublon }, remboursement: doublon ? 1 : 0,
});

describe('ouverture de plusieurs caisses', () => {
  it('taille du lot : autant de caisses que les clés le permettent, 10 au plus', () => {
    expect(tailleLot(0)).toBe(0);
    expect(tailleLot(5)).toBe(1);
    expect(tailleLot(6)).toBe(2);
    expect(tailleLot(29)).toBe(9);
    expect(tailleLot(300)).toBe(MAX_LOT);
    expect(MAX_LOT).toBe(10);
  });
  it('la meilleure : la plus rare, une nouveauté avant un doublon, la première à égalité', () => {
    const a = ou('commune'), b = ou('epique', true), c = ou('rare'), d = ou('epique', false, 'y'), e = ou('epique', false, 'z');
    expect(meilleure([a, b, c])).toBe(b);
    expect(meilleure([a, b, c, d, e])).toBe(d);
    expect(meilleure([a])).toBe(a);
  });
});
