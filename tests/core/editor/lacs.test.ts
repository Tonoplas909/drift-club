import { describe, it, expect } from 'vitest';
import { addLac, deleteLac, setNiveauLac, erreurContourLac, niveauLacParDefaut, copyLevel } from '../../../src/core/editor/ops';
import { analyseLevel } from '../../../src/core/editor/analyse';
import { LIMITES } from '../../../src/core/level/types';
import { straightLevel } from '../../fixtures/levels';

const carre = (cx: number, cz: number, demi = 30) => [
  { x: cx - demi, z: cz - demi }, { x: cx + demi, z: cz - demi }, { x: cx + demi, z: cz + demi }, { x: cx - demi, z: cz + demi },
];

describe('lacs de l\'éditeur', () => {
  it('ajoute, règle et supprime un lac ; le champ eau disparaît quand il n\'y en a plus', () => {
    const l = straightLevel(300);
    expect(niveauLacParDefaut(l)).toBe(-3); // route à 0 m
    expect(addLac(l, carre(80, 100))).toBe(0);
    expect(l.eau).toEqual([{ points: carre(80, 100), niveau: -3 }]);
    setNiveauLac(l, 0, -8);
    expect(l.eau![0].niveau).toBe(-8);
    setNiveauLac(l, 0, 9999);
    expect(l.eau![0].niveau).toBe(LIMITES.eauNiveauMax);
    deleteLac(l, 0);
    expect('eau' in l).toBe(false);
  });

  it('refuse les contours invalides avec un message en français', () => {
    const l = straightLevel(300);
    expect(erreurContourLac(l, carre(80, 100).slice(0, 2))).toMatch(/au moins 3 points/);
    expect(erreurContourLac(l, [{ x: 0, z: 0 }, { x: 10, z: 10 }, { x: 10, z: 0 }, { x: 0, z: 10 }])).toMatch(/se croise/);
    expect(erreurContourLac(l, carre(80, 100, 3))).toMatch(/trop petit/);
    expect(addLac(l, carre(80, 100, 3))).toBe(-1);
    for (let i = 0; i < LIMITES.eauMax; i++) expect(addLac(l, carre(80 + i * 100, 100))).toBe(i);
    expect(erreurContourLac(l, carre(80, 400))).toMatch(/Maximum 3 lacs/);
  });

  it('copyLevel conserve l\'eau', () => {
    const l = straightLevel(300);
    addLac(l, carre(80, 100));
    const c = copyLevel(l, 'Copie');
    expect(c.eau).toEqual(l.eau);
    c.eau![0].niveau = 5;
    expect(l.eau![0].niveau).toBe(-3); // copie profonde
  });

  it('analyse : un lac sur la route rend le niveau invalide (message dans erreurs)', () => {
    const l = straightLevel(300);
    addLac(l, carre(0, 100)); // sur la route
    const a = analyseLevel(l);
    expect(a.ok).toBe(false);
    expect(a.track).not.toBeNull();
    expect(a.erreurs.join()).toMatch(/lac 1 touche la route/);
    const b = straightLevel(300);
    addLac(b, carre(80, 100));
    expect(analyseLevel(b).ok).toBe(true);
  });
});
