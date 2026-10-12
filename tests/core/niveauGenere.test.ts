import { describe, it, expect } from 'vitest';
import { niveauGenere, graineDuDecor } from '../../src/core/niveauGenere';
import { defiDuJour, graineDuJour, jourEnClair } from '../../src/core/defi';
import { ENVIRONNEMENTS } from '../../src/core/level/types';
import { analyseLevel } from '../../src/core/editor/analyse';
import { niveauAleatoire } from '../../src/core/editor/aleatoire';

describe('niveau généré (éditeur)', () => {
  it('le défi du jour est exactement le niveau généré de sa graine', () => {
    const jour = '2026-10-12';
    const g = niveauGenere(graineDuJour(jour), `Défi du ${jourEnClair(jour)}`);
    const d = defiDuJour(jour);
    expect(d.level).toEqual(g.level);
    expect(d.voiture).toBe(g.voiture);
  });
  it('chaque décor peut être demandé, et le niveau tiré est jouable', () => {
    for (const e of ENVIRONNEMENTS) {
      const graine = graineDuDecor(123456789, e);
      const { level } = niveauGenere(graine, 'Essai');
      expect(level.environnement, e).toBe(e);
      const a = analyseLevel(level);
      expect(a.ok, `${e} : ${a.erreurs.join(' ')} ${a.problemes.map((p) => p.message).join(' ')}`).toBe(true);
    }
  });
  it('déterministe : même graine, même niveau', () => {
    expect(niveauGenere(42, 'A').level).toEqual(niveauGenere(42, 'A').level);
    expect(niveauGenere(42, 'A').level.route).not.toEqual(niveauGenere(43, 'A').level.route);
  });
  it('éditeur : niveau aléatoire toujours valide, avec peu de points à retoucher', () => {
    let points = 0, n = 0;
    for (let k = 0; k < 6; k++) {
      for (const e of [undefined, ...ENVIRONNEMENTS]) {
        const level = niveauAleatoire(k * 7919 + 17, e);
        if (e) expect(level.environnement).toBe(e);
        const a = analyseLevel(level);
        expect(a.ok, `${k} ${e} : ${a.erreurs.join(' ')} ${a.problemes.map((p) => p.message).join(' ')}`).toBe(true);
        points += level.route.length; n++;
      }
    }
    expect(points / n).toBeLessThan(60);
  });
});
