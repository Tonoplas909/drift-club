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

/** Japon : maisons traditionnelles (minka) à 1 ou 2 niveaux ; styles 0 bois sombre, 1 crépi clair, 2 bois clair. */
export const MINKAS: readonly Batiment[] = [
  { w: 10, d: 8, etages: 1, style: 0 }, { w: 12, d: 9, etages: 2, style: 1 }, { w: 9, d: 8, etages: 1, style: 2 }, { w: 14, d: 10, etages: 2, style: 0 },
];

/** Japon : échoppes de ville (machiya) étroites, rideau « noren » et lanternes ; styles 0 à 3 (bois, enduit, ardoise, rouge). */
export const MACHIYAS: readonly Batiment[] = [
  { w: 7, d: 9, etages: 2, style: 0 }, { w: 6, d: 8, etages: 2, style: 1 }, { w: 8, d: 10, etages: 2, style: 2 }, { w: 6, d: 9, etages: 3, style: 3 },
];

/** Japon : petits immeubles de ville (bureaux, karaoké, ramen) avec enseignes verticales ; styles 0 à 3. */
export const IMMEUBLES_JP: readonly Batiment[] = [
  { w: 8, d: 10, etages: 4, style: 0 }, { w: 7, d: 9, etages: 5, style: 1 }, { w: 9, d: 10, etages: 3, style: 2 }, { w: 8, d: 12, etages: 6, style: 3 },
];

/** Cyberpunk : immeubles à néons et écrans géants (styles 0 à 3 : magenta, cyan, ambre, vert acide). */
export const IMMEUBLES_NEON: readonly Batiment[] = [
  { w: 12, d: 12, etages: 5, style: 0 }, { w: 14, d: 12, etages: 7, style: 1 }, { w: 10, d: 12, etages: 6, style: 2 },
  { w: 16, d: 14, etages: 4, style: 3 }, { w: 12, d: 14, etages: 8, style: 0 }, { w: 18, d: 12, etages: 6, style: 1 },
];

/** Cyberpunk : mégatours (12 à 22 étages), posées plus loin de la route. */
export const TOURS_NEON: readonly Batiment[] = [
  { w: 18, d: 18, etages: 14, style: 0 }, { w: 22, d: 18, etages: 18, style: 1 }, { w: 16, d: 16, etages: 12, style: 2 }, { w: 24, d: 22, etages: 22, style: 3 },
];

const BATIMENTS: Partial<Record<DecorKind, readonly Batiment[]>> = {
  immeuble: IMMEUBLES, tour: TOURS, minka: MINKAS, machiya: MACHIYAS, immeubleJp: IMMEUBLES_JP, immeubleNeon: IMMEUBLES_NEON, tourNeon: TOURS_NEON,
};

/**
 * Emprises rectangulaires (largeur selon x local, profondeur selon z local) des objets des autres thèmes, par variante :
 * pontons et épaves (pirate), panneaux de mur et piliers (backrooms), pagodes, sanctuaires et distributeurs (japon), kiosques (cyberpunk).
 */
const EMPRISES_THEMES: Partial<Record<DecorKind, readonly [number, number][]>> = {
  ponton: [[2.6, 12], [2.6, 8]],
  epave: [[3.6, 10], [3.6, 9]],
  mur: [[0.4, 8], [0.4, 8], [0.4, 3.2]],
  pilier: [[1.1, 1.1]],
  porteBureau: [[1.3, 0.3]],
  pagode: [[9, 9], [7, 7]],
  sanctuaire: [[2.6, 2.4]],
  distributeur: [[1.1, 0.8]],
  kiosque: [[3.4, 2.4], [3.0, 2.2]],
};

/** Dimensions d'un bâtiment (ville, japon, cyberpunk) ; null pour les autres objets. */
export const batimentDe = (kind: DecorKind, variant: number): Batiment | null => BATIMENTS[kind]?.[variant] ?? null;

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
