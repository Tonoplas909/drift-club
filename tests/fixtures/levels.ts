import type { Level } from '../../src/core/level/types';

/** route : liste de [x, z, y, l] */
export function makeLevel(route: [number, number, number, number][], extra: Partial<Level> = {}): Level {
  return {
    format: 1,
    nom: 'Test',
    auteur: 'Tests',
    environnement: 'montagne',
    ambiance: 'jour',
    route: route.map(([x, z, y, l]) => ({ x, z, y, l })),
    barrieres: [],
    decor: { graine: 1234, densite: 0.5 },
    objets: [],
    ...extra,
  };
}

/** Ligne droite vers +z depuis l'origine. */
export function straightLevel(length = 200, width = 10): Level {
  const pts: [number, number, number, number][] = [];
  const n = Math.max(1, Math.ceil(length / 50));
  for (let i = 0; i <= n; i++) pts.push([0, (length * i) / n, 0, width]);
  return makeLevel(pts);
}

/** Virage à gauche en quart de cercle, rayon 50 m, centre (50, 0). */
export function curveLevel(): Level {
  const pts: [number, number, number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    const phi = (i / 4) * (Math.PI / 2);
    pts.push([50 - 50 * Math.cos(phi), 50 * Math.sin(phi), 0, 10]);
  }
  return makeLevel(pts);
}

/** Montée le long de +z, épingle en demi-cercle (rayon 20 m, centre (20, 100)), redescente parallèle à x = 40. */
export function hairpinLevel(): Level {
  return makeLevel([
    [0, 0, 0, 10],
    [0, 50, 0, 10],
    [0, 100, 0, 10],
    [5.86, 114.14, 0, 10],
    [20, 120, 0, 10],
    [34.14, 114.14, 0, 10],
    [40, 100, 0, 10],
    [40, 50, 0, 10],
    [40, 0, 0, 10],
  ]);
}

/**
 * Boucle qui repasse au-dessus de son départ : la route part vers +z, tourne à droite et revient vers -x en
 * croisant la ligne droite du départ en (0, 0), `dy` m plus haut (dy ≥ 6 : un pont).
 */
export function pontLevel(dy = 12): Level {
  const k = dy / 12;
  return makeLevel([
    [0, -100, 0, 10],
    [0, 0, 0, 10],
    [0, 100, 2 * k, 10],
    [60, 150, 5 * k, 10],
    [120, 100, 8 * k, 10],
    [110, 20, 11 * k, 10],
    [50, 0, 12 * k, 10],
    [-50, 0, 12 * k, 10],
    [-130, 0, 12 * k, 10],
  ]);
}
