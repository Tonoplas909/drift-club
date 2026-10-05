import { hash2 } from '../math/rng';
import { smoothstep } from '../math/vec';
import * as dm from '../math/dmath';

/**
 * Modelage du terrain propre à un thème (données pures, lues par `Terrain`) : mer (pirate) et cratères (espace).
 * Rien de tout cela ne s'applique près de la route : la chaussée et ses talus restent ceux du terrain de base.
 */

/** Mer : un plan d'eau infini à `niveau = altitude la plus basse de la route + decalage`, et un terrain qui descend vers lui loin de la route. */
export interface RegleMer {
  /** niveau de la mer par rapport au point le plus bas de la route (m, négatif : en dessous) */
  decalage: number;
  /** profondeur maximale sous le niveau (m) */
  profondeur: number;
  /** distance (m) à la route avant laquelle le terrain n'est pas modifié, et longueur (m) de la rampe qui suit */
  depart: number;
  rampe: number;
  /** [a, b] : seuils du masque de bruit (fbm à `echelle` m) à partir desquels la mer gagne du terrain */
  seuil: [number, number];
  echelle: number;
  /** [a, b] : au-delà de `b` m de la route tout est mer (le bord du terrain ne doit pas montrer de falaise) */
  lointain: [number, number];
}

/** Cratères : une cuvette (avec lèvre) par case de `cellule` m avec la probabilité donnée. */
export interface RegleCratere {
  cellule: number;
  probabilite: number;
  /** [rayon min, amplitude] (m) ; profondeur = `creux` × rayon */
  rayon: [number, number];
  creux: number;
  /** distance à la route : aucun cratère à moins de `a` m, pleins à `b` m */
  eloignement: [number, number];
}

export interface OptionsTerrain { mer?: RegleMer; cratere?: RegleCratere }

/** Masque de mer 0..1 à partir du bruit `m` (0..1) et de la distance `d` à la route. */
export function masqueMer(r: RegleMer, m: number, d: number): number {
  const proche = smoothstep(r.depart, r.depart + r.rampe, d);
  const terre = smoothstep(r.seuil[0], r.seuil[1], m);
  const loin = smoothstep(r.lointain[0], r.lointain[1], d);
  return proche * Math.max(terre, loin);
}

/** Variation de hauteur (m) due aux cratères en (x, z) ; `d` = distance à la route. */
export function creuxCratere(r: RegleCratere, x: number, z: number, d: number, graine: number): number {
  const eloigne = smoothstep(r.eloignement[0], r.eloignement[1], d);
  if (eloigne <= 0) return 0;
  const C = r.cellule;
  const ci = Math.floor(x / C), cj = Math.floor(z / C);
  let dh = 0;
  for (let j = cj - 1; j <= cj + 1; j++) {
    for (let i = ci - 1; i <= ci + 1; i++) {
      if (hash2(i, j, graine + 601) >= r.probabilite) continue;
      const cx = (i + 0.15 + 0.7 * hash2(i, j, graine + 602)) * C;
      const cz = (j + 0.15 + 0.7 * hash2(i, j, graine + 603)) * C;
      const R = r.rayon[0] + r.rayon[1] * hash2(i, j, graine + 604);
      const q = dm.hypot(x - cx, z - cz) / R;
      if (q >= 1.5) continue;
      const prof = r.creux * R;
      // cuvette en parabole, lèvre étroite juste au-delà du bord
      if (q < 1) dh -= prof * (1 - q * q);
      const l = (q - 1) / 0.16;
      dh += 0.14 * prof * dm.exp(-l * l);
    }
  }
  return dh * eloigne;
}
