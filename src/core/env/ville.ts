import type { DecorKind } from './types';

/**
 * Bâtiments et mobilier du thème « ville » : dimensions partagées entre le générateur (collisions, placement)
 * et le rendu (modèles). Aucun import d'exécution : ce fichier ne dépend de rien.
 */
export interface Batiment {
  /** façade (m), le long de la route */
  w: number;
  /** profondeur (m) */
  d: number;
  etages: number;
  /** palette de façade (index dans render/villeModeles.ts) */
  style: number;
}

/** Hauteur d'un étage (m). */
export const HAUTEUR_ETAGE = 3.4;

/** 2 à 8 étages : styles 0 brique, 1 beige, 2 béton, 3 à 6 pastels. */
export const IMMEUBLES: readonly Batiment[] = [
  { w: 12, d: 10, etages: 2, style: 1 }, { w: 14, d: 10, etages: 3, style: 0 },
  { w: 10, d: 10, etages: 4, style: 3 }, { w: 16, d: 12, etages: 3, style: 2 },
  { w: 12, d: 12, etages: 5, style: 0 }, { w: 18, d: 12, etages: 4, style: 5 },
  { w: 12, d: 10, etages: 6, style: 1 }, { w: 14, d: 12, etages: 6, style: 4 },
  { w: 10, d: 10, etages: 7, style: 2 }, { w: 16, d: 14, etages: 5, style: 6 },
  { w: 14, d: 12, etages: 8, style: 0 }, { w: 12, d: 12, etages: 8, style: 3 },
  { w: 20, d: 12, etages: 3, style: 1 }, { w: 11, d: 10, etages: 5, style: 5 },
  { w: 15, d: 11, etages: 4, style: 2 }, { w: 13, d: 12, etages: 7, style: 4 },
];

/** 10 à 12 étages, façades vitrées (styles 7 et 8) : posées plus loin de la route. */
export const TOURS: readonly Batiment[] = [
  { w: 18, d: 18, etages: 10, style: 7 }, { w: 22, d: 16, etages: 12, style: 8 },
  { w: 16, d: 16, etages: 11, style: 2 }, { w: 20, d: 20, etages: 12, style: 7 },
];

/**
 * Emprises rectangulaires (largeur selon x local, profondeur selon z local) des objets des autres thèmes, par variante :
 * pontons et épaves (pirate), panneaux de mur et piliers (backrooms), pagodes et sanctuaires (japon).
 */
const EMPRISES_THEMES: Partial<Record<DecorKind, readonly [number, number][]>> = {
  ponton: [[2.6, 12], [2.6, 8]],
  epave: [[3.6, 10], [3.6, 9]],
  mur: [[0.4, 8], [0.4, 8], [0.4, 3.2]],
  pilier: [[1.1, 1.1]],
  porteBureau: [[1.3, 0.3]],
  pagode: [[9, 9], [7, 7]],
  sanctuaire: [[2.6, 2.4]],
};

export const batimentDe = (kind: DecorKind, variant: number): Batiment | null =>
  kind === 'immeuble' ? IMMEUBLES[variant] ?? null : kind === 'tour' ? TOURS[variant] ?? null : null;

/** Emprise rectangulaire (largeur selon x local, profondeur selon z local) des objets solides qui ne sont pas des cercles. */
export function boiteDe(kind: DecorKind, variant: number): [number, number] | null {
  const b = batimentDe(kind, variant);
  if (b) return [b.w, b.d];
  const fixe = EMPRISES_THEMES[kind]?.[variant] ?? EMPRISES_THEMES[kind]?.[0];
  if (fixe) return fixe;
  switch (kind) {
    case 'blocBeton': return [0.6, 3];
    case 'arretBus': return [1.6, 3.6];
    case 'voiture': return [1.9, 4.3];
    case 'grillage': return [0.2, 4];
    default: return null;
  }
}
