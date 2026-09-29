import { describe, it, expect } from 'vitest';
import {
  addPoint,
  insertPoint,
  movePoint,
  setPoint,
  deletePoint,
  barrierAt,
  toggleBarrier,
  normalizeBarriers,
  addObjet,
  moveObjet,
  rotateObjet,
  deleteObjet,
  nearestPoint,
  nearestSegment,
  nearestObjet,
  newLevel,
  copyLevel,
} from '../../../src/core/editor/ops';
import { straightLevel, makeLevel } from '../../fixtures/levels';
import type { Level } from '../../../src/core/level/types';
import { validateLevel } from '../../../src/core/level/validate';

describe('ops: points', () => {
  it('ajoute un point en fin de route', () => {
    const l = straightLevel(100);
    const n = l.route.length;
    const last = l.route[n - 1];
    addPoint(l, 10, 20);
    expect(l.route.length).toBe(n + 1);
    expect(l.route[n].x).toBe(10);
    expect(l.route[n].z).toBe(20);
    expect(l.route[n].y).toBe(last.y);
    expect(l.route[n].l).toBe(last.l);
  });

  it('insère un point entre deux points', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 100, 0, 10], [0, 200, 0, 10]]);
    insertPoint(l, 1, 10, 50);
    expect(l.route.length).toBe(4);
    expect(l.route[2].x).toBe(10);
    expect(l.route[2].z).toBe(50);
    expect(l.route[2].y).toBe(0);
    expect(l.route[2].l).toBe(10);
  });

  it('insère un point et décale les indices des barrières', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 100, 0, 10], [0, 200, 0, 10]]);
    l.barrieres = [{ de: 1, a: 2, cote: 'gauche' }];
    insertPoint(l, 1, 10, 50);
    expect(l.route.length).toBe(4);
    expect(l.barrieres[0].de).toBe(1);
    expect(l.barrieres[0].a).toBe(3);
  });

  it('déplace un point', () => {
    const l = straightLevel(100);
    movePoint(l, 1, 5, 10);
    expect(l.route[1].x).toBe(5);
    expect(l.route[1].z).toBe(10);
  });

  it('modifie y et l d\'un point avec clamping', () => {
    const l = straightLevel(100);
    setPoint(l, 1, { y: 200, l: 25 });
    expect(l.route[1].y).toBe(150); // clamped
    expect(l.route[1].l).toBe(20); // clamped
    setPoint(l, 1, { y: -100, l: 5 });
    expect(l.route[1].y).toBe(-50); // clamped
    expect(l.route[1].l).toBe(6); // clamped
  });

  it('supprime un point', () => {
    const l = straightLevel(100);
    const n = l.route.length;
    const res = deletePoint(l, 1);
    expect(res).toBe(true);
    expect(l.route.length).toBe(n - 1);
  });

  it('refuse de supprimer un point si seulement 2 restent', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 100, 0, 10]]);
    const res = deletePoint(l, 1);
    expect(res).toBe(false);
    expect(l.route.length).toBe(2);
  });

  it('supprime les barrières invalides après suppression de point', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 100, 0, 10], [0, 200, 0, 10], [0, 300, 0, 10]]);
    l.barrieres = [{ de: 1, a: 2, cote: 'gauche' }];
    deletePoint(l, 1);
    // Barrière de=0, a=1 devenait invalide car le segment 1 n'existe plus
    expect(l.barrieres.length).toBe(0);
  });
});

describe('ops: barriers', () => {
  it('retourne les drapeaux de barrière pour un segment', () => {
    const l = straightLevel();
    l.barrieres = [{ de: 0, a: 2, cote: 'gauche' }];
    expect(barrierAt(l, 0)).toEqual({ gauche: true, droite: false, ext: false });
    expect(barrierAt(l, 1)).toEqual({ gauche: true, droite: false, ext: false });
    expect(barrierAt(l, 2)).toEqual({ gauche: false, droite: false, ext: false });
  });

  it('bascule une barrière gauche', () => {
    const l = straightLevel();
    toggleBarrier(l, 0, 'gauche');
    expect(barrierAt(l, 0).gauche).toBe(true);
    toggleBarrier(l, 0, 'gauche');
    expect(barrierAt(l, 0).gauche).toBe(false);
  });

  it('bascule une barrière ext et désactive gauche/droite', () => {
    const l = straightLevel();
    l.barrieres = [{ de: 0, a: 1, cote: 'gauche' }];
    toggleBarrier(l, 0, 'ext');
    expect(barrierAt(l, 0).ext).toBe(true);
    expect(barrierAt(l, 0).gauche).toBe(false);
  });

  it('normalise les barrières : fusionne et compresse', () => {
    const l = straightLevel();
    l.barrieres = [
      { de: 0, a: 2, cote: 'gauche' },
      { de: 2, a: 4, cote: 'gauche' },
      { de: 1, a: 3, cote: 'droite' },
    ];
    normalizeBarriers(l);
    // plages sans chevauchement : gauche seule, puis gauche+droite (« deux »), puis gauche seule
    expect(l.barrieres).toEqual([
      { de: 0, a: 1, cote: 'gauche' },
      { de: 1, a: 3, cote: 'deux' },
      { de: 3, a: 4, cote: 'gauche' },
    ]);
  });

  it('normalizeBarriers convertit deux en gauche+droite fusionnées', () => {
    const l = straightLevel();
    l.barrieres = [{ de: 0, a: 2, cote: 'deux' }];
    normalizeBarriers(l);
    expect(l.barrieres).toEqual([{ de: 0, a: 2, cote: 'deux' }]);
  });
});

describe('ops: objects', () => {
  it('ajoute un objet', () => {
    const l = straightLevel();
    const idx = addObjet(l, 'arbre', 10, 20, 45);
    expect(idx).toBe(0);
    expect(l.objets[0].type).toBe('arbre');
    expect(l.objets[0].x).toBe(10);
    expect(l.objets[0].z).toBe(20);
    expect(l.objets[0].rot).toBe(45);
  });

  it('retourne -1 si on dépasse le nombre max d\'objets', () => {
    const l = straightLevel();
    l.objets = new Array(300).fill({ type: 'arbre', x: 0, z: 0, rot: 0 });
    const idx = addObjet(l, 'arbre', 0, 0);
    expect(idx).toBe(-1);
  });

  it('déplace un objet', () => {
    const l = straightLevel();
    addObjet(l, 'arbre', 0, 0);
    moveObjet(l, 0, 10, 20);
    expect(l.objets[0].x).toBe(10);
    expect(l.objets[0].z).toBe(20);
  });

  it('fait pivoter un objet', () => {
    const l = straightLevel();
    addObjet(l, 'arbre', 0, 0, 45);
    rotateObjet(l, 0, 45);
    expect(l.objets[0].rot).toBe(90);
  });

  it('boucle la rotation à 360°', () => {
    const l = straightLevel();
    addObjet(l, 'arbre', 0, 0, 350);
    rotateObjet(l, 0, 20);
    expect(l.objets[0].rot).toBe(10);
  });

  it('supprime un objet', () => {
    const l = straightLevel();
    addObjet(l, 'arbre', 0, 0);
    addObjet(l, 'sapin', 10, 10);
    deleteObjet(l, 0);
    expect(l.objets.length).toBe(1);
    expect(l.objets[0].type).toBe('sapin');
  });
});

describe('ops: picking', () => {
  it('trouve le point le plus proche', () => {
    const l = makeLevel([[0, 0, 0, 10], [100, 100, 0, 10]]);
    const idx = nearestPoint(l, 1, 1, 100);
    expect(idx).toBe(0);
  });

  it('retourne -1 si aucun point dans maxDist', () => {
    const l = makeLevel([[0, 0, 0, 10], [100, 100, 0, 10]]);
    const idx = nearestPoint(l, 200, 200, 10);
    expect(idx).toBe(-1);
  });

  it('trouve le segment le plus proche', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 100, 0, 10]]);
    const seg = nearestSegment(l, 5, 50, 100);
    expect(seg).not.toBeNull();
    expect(seg?.seg).toBe(0);
    expect(seg?.t).toBeGreaterThan(0);
    expect(seg?.t).toBeLessThan(1);
  });

  it('retourne null si aucun segment dans maxDist', () => {
    const l = makeLevel([[0, 0, 0, 10], [0, 100, 0, 10]]);
    const seg = nearestSegment(l, 200, 200, 10);
    expect(seg).toBeNull();
  });

  it('trouve l\'objet le plus proche', () => {
    const l = straightLevel();
    addObjet(l, 'arbre', 0, 0);
    addObjet(l, 'sapin', 100, 100);
    const idx = nearestObjet(l, 1, 1, 100);
    expect(idx).toBe(0);
  });

  it('retourne -1 si aucun objet dans maxDist', () => {
    const l = straightLevel();
    addObjet(l, 'arbre', 0, 0);
    const idx = nearestObjet(l, 200, 200, 10);
    expect(idx).toBe(-1);
  });
});

describe('ops: factory', () => {
  it('crée un niveau par défaut valide', () => {
    const l = newLevel();
    const v = validateLevel(l);
    expect(v.ok).toBe(true);
    expect(l.nom).toBe('Nouveau niveau');
    expect(l.route.length).toBeGreaterThanOrEqual(2);
  });

  it('copie un niveau en profondeur', () => {
    const l1 = straightLevel();
    const l2 = copyLevel(l1, 'Copie');
    expect(l2).not.toBe(l1);
    expect(l2.route).not.toBe(l1.route);
    expect(l2.nom).toBe('Copie');
    expect(l2.route.length).toBe(l1.route.length);
  });
});

describe('ops: barrières sur des plages', () => {
  const route = (n: number) => Array.from({ length: n }, (_, i) => ({ x: 0, z: i * 20, y: 0, l: 10 }));
  const lvl = (n: number, barrieres: Level['barrieres']): Level =>
    ({ ...newLevel(), route: route(n), barrieres });

  it('basculer un tronçon au milieu d\'une plage la coupe en deux sans toucher au reste', () => {
    const l = lvl(10, [{ de: 2, a: 8, cote: 'ext' }]);
    toggleBarrier(l, 5, 'ext');
    expect(l.barrieres).toEqual([{ de: 2, a: 5, cote: 'ext' }, { de: 6, a: 8, cote: 'ext' }]);
    toggleBarrier(l, 5, 'ext');
    expect(l.barrieres).toEqual([{ de: 2, a: 8, cote: 'ext' }]);
  });

  it('gauche + droite sur un tronçon donne « deux »', () => {
    const l = lvl(6, [{ de: 0, a: 4, cote: 'gauche' }]);
    toggleBarrier(l, 2, 'droite');
    expect(l.barrieres).toEqual([{ de: 0, a: 2, cote: 'gauche' }, { de: 2, a: 3, cote: 'deux' }, { de: 3, a: 4, cote: 'gauche' }]);
  });

  it('supprimer un point intérieur raccourcit la barrière', () => {
    const l = lvl(10, [{ de: 2, a: 6, cote: 'gauche' }]);
    deletePoint(l, 4);
    expect(l.barrieres).toEqual([{ de: 2, a: 5, cote: 'gauche' }]);
    deletePoint(l, 0);
    expect(l.barrieres).toEqual([{ de: 1, a: 4, cote: 'gauche' }]);
    deletePoint(l, 4);
    expect(l.barrieres).toEqual([{ de: 1, a: 3, cote: 'gauche' }]);
  });
});
