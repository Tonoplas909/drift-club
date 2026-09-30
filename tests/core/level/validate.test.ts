import { describe, it, expect } from 'vitest';
import { validateLevel } from '../../../src/core/level/validate';
import { ENVIRONNEMENTS } from '../../../src/core/level/types';
import { makeLevel, straightLevel } from '../../fixtures/levels';

const errs = (raw: unknown): string[] => {
  const r = validateLevel(raw);
  return r.ok ? [] : r.erreurs;
};

describe('validateLevel', () => {
  it('accepte un niveau correct', () => {
    const r = validateLevel(straightLevel());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level.route.length).toBeGreaterThanOrEqual(2);
  });
  it('refuse ce qui n\'est pas un objet', () => {
    expect(errs(null)[0]).toMatch(/objet JSON/);
    expect(errs([1, 2])[0]).toMatch(/objet JSON/);
  });
  it('refuse une version plus récente', () => {
    expect(errs({ ...straightLevel(), format: 2 })[0]).toMatch(/plus récente/);
  });
  it('refuse un format manquant', () => {
    const { format: _f, ...rest } = straightLevel();
    expect(errs(rest)[0]).toMatch(/format/);
  });
  it('vérifie nom, ambiance et environnement', () => {
    expect(errs({ ...straightLevel(), nom: '' }).join()).toMatch(/nom/);
    expect(errs({ ...straightLevel(), ambiance: 'nuit' }).join()).toMatch(/ambiance/);
    expect(errs({ ...straightLevel(), environnement: 'lune' }).join()).toMatch(/environnement/);
  });
  it('accepte chaque environnement et le conserve, refuse les valeurs inconnues avec la liste attendue', () => {
    for (const environnement of ENVIRONNEMENTS) {
      const r = validateLevel({ ...straightLevel(), environnement });
      expect(r.ok && r.level.environnement).toBe(environnement);
    }
    expect(errs({ ...straightLevel(), environnement: 'Montagne' }).join()).toMatch(/montagne, neige, desert, automne, ville, pirate, backrooms, espace, japon/);
    for (const e of ['ville', 'pirate', 'backrooms', 'espace', 'japon']) expect(errs({ ...straightLevel(), environnement: e })).toEqual([]);
    expect(errs({ ...straightLevel(), environnement: 3 }).join()).toMatch(/environnement/);
    const { environnement: _e, ...sans } = straightLevel();
    expect(errs(sans).join()).toMatch(/environnement/);
  });
  it('vérifie le nombre de points', () => {
    expect(errs(makeLevel([[0, 0, 0, 10]])).join()).toMatch(/2 à 150 points/);
  });
  it('vérifie largeur, hauteur et écart entre points', () => {
    expect(errs(makeLevel([[0, 0, 0, 10], [0, 50, 0, 40]])).join()).toMatch(/route\[1\]\.l/);
    expect(errs(makeLevel([[0, 0, 0, 10], [0, 50, 500, 10]])).join()).toMatch(/route\[1\]\.y/);
    expect(errs(makeLevel([[0, 0, 0, 10], [0, 2, 0, 10]])).join()).toMatch(/distance au point précédent/);
  });
  it('vérifie la longueur totale', () => {
    const pts: [number, number, number, number][] = [];
    for (let i = 0; i <= 25; i++) pts.push([0, i * 140, 0, 10]);
    expect(errs(makeLevel(pts)).join()).toMatch(/longueur totale/);
  });
  it('vérifie les barrières', () => {
    expect(errs({ ...straightLevel(), barrieres: [{ de: 2, a: 1, cote: 'gauche' }] }).join()).toMatch(/barrieres\[0\]/);
    expect(errs({ ...straightLevel(), barrieres: [{ de: 0, a: 1, cote: 'haut' }] }).join()).toMatch(/barrieres\[0\]/);
  });
  it('vérifie décor et objets', () => {
    expect(errs({ ...straightLevel(), decor: { graine: 1.5, densite: 0.5 } }).join()).toMatch(/decor/);
    expect(errs({ ...straightLevel(), decor: { graine: 1, densite: 2 } }).join()).toMatch(/decor/);
    expect(errs({ ...straightLevel(), objets: [{ type: 'cone', x: 0, z: 0, rot: 0 }] }).join()).toMatch(/objets\[0\]/);
  });
  it('rend un niveau propre (nom sans espaces autour)', () => {
    const r = validateLevel({ ...straightLevel(), nom: '  Mon niveau  ' });
    expect(r.ok && r.level.nom).toBe('Mon niveau');
  });
});
