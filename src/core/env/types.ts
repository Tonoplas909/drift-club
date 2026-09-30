import { IMMEUBLES, TOURS } from './ville';

/** Types de décor. Les 8 premiers existent depuis le début ; les autres servent les thèmes (desert, neige, automne, ville, pirate, backrooms, espace, japon). */
export type DecorKind =
  | 'sapin' | 'feuillu' | 'rocher' | 'rocherHaut' | 'chevron' | 'borne' | 'pneus' | 'panneau'
  | 'cactus' | 'buisson' | 'arbreSec' | 'mesa' | 'piquet' | 'tasNeige' | 'souche'
  | 'immeuble' | 'tour' | 'lampadaire' | 'plot' | 'blocBeton' | 'poubelle' | 'arretBus' | 'voiture' | 'arbreVille' | 'grillage'
  // pirate
  | 'palmier' | 'ponton' | 'tonneau' | 'caisse' | 'coffre' | 'canon' | 'ancre' | 'drapeauPirate' | 'epave'
  // backrooms
  | 'mur' | 'pilier' | 'lampeBureau' | 'dalleLumiere' | 'porteBureau' | 'carton'
  // espace
  | 'cristal' | 'antenne' | 'atterrisseur' | 'parabole' | 'balise' | 'bidon'
  // japon
  | 'cerisier' | 'torii' | 'toro' | 'pagode' | 'bambou' | 'sanctuaire';

export interface EnvItem {
  kind: DecorKind;
  variant: number;
  x: number; y: number; z: number;
  /** cap (convention ψ) */
  rot: number;
  /** multiplicateur de taille autour de la taille de base du modèle */
  scale: number;
  solid: boolean;
  manual: boolean;
}

export interface CircleCollider { x: number; z: number; r: number }
export interface SegmentCollider { ax: number; az: number; bx: number; bz: number }
export interface BarrierPiece { x: number; y: number; z: number; rot: number; len: number }

export interface Environment {
  items: EnvItem[];
  circles: CircleCollider[];
  segments: SegmentCollider[];
  barriers: BarrierPiece[];
}

export const VARIANTS: Record<DecorKind, number> = {
  sapin: 3, feuillu: 3, rocher: 2, rocherHaut: 1, chevron: 1, borne: 1, pneus: 1, panneau: 1,
  cactus: 3, buisson: 2, arbreSec: 2, mesa: 2, piquet: 1, tasNeige: 2, souche: 1,
  immeuble: IMMEUBLES.length, tour: TOURS.length, lampadaire: 1, plot: 1, blocBeton: 1, poubelle: 1, arretBus: 1,
  voiture: 4, arbreVille: 2, grillage: 1,
  palmier: 3, ponton: 2, tonneau: 1, caisse: 2, coffre: 1, canon: 1, ancre: 1, drapeauPirate: 1, epave: 2,
  mur: 3, pilier: 1, lampeBureau: 1, dalleLumiere: 2, porteBureau: 1, carton: 1,
  cristal: 3, antenne: 2, atterrisseur: 1, parabole: 1, balise: 1, bidon: 1,
  cerisier: 3, torii: 2, toro: 1, pagode: 2, bambou: 2, sanctuaire: 1,
};

/**
 * Rayon de collision (m) pour scale = 1. Les types qui ont une emprise rectangulaire (`boiteDe`, ville.ts) sont
 * solides par 4 segments : leur rayon ne sert alors que d'ordre de grandeur.
 */
export const COLLIDER_RADIUS: Record<DecorKind, number> = {
  sapin: 0.45, feuillu: 0.5, rocher: 1.4, rocherHaut: 1.1, chevron: 0.15, borne: 0.12, pneus: 0.6, panneau: 0.15,
  cactus: 0.4, buisson: 0.35, arbreSec: 0.35, mesa: 2.4, piquet: 0.1, tasNeige: 0.6, souche: 0.4,
  immeuble: 8, tour: 12, lampadaire: 0.25, plot: 0.25, blocBeton: 1.5, poubelle: 0.35, arretBus: 1.8, voiture: 2.2,
  arbreVille: 0.5, grillage: 2,
  palmier: 0.4, ponton: 1.5, tonneau: 0.45, caisse: 0.6, coffre: 0.5, canon: 0.6, ancre: 0.4, drapeauPirate: 0.15, epave: 2.5,
  mur: 1, pilier: 0.6, lampeBureau: 0.15, dalleLumiere: 0.5, porteBureau: 0.6, carton: 0.6,
  cristal: 0.8, antenne: 0.6, atterrisseur: 2.2, parabole: 0.5, balise: 0.12, bidon: 0.5,
  cerisier: 0.45, torii: 0.4, toro: 0.35, pagode: 4, bambou: 0.5, sanctuaire: 1.6,
};

/**
 * Objets purement visuels : jamais de collision, même « solides » (ils restent dans la liste proche du rendu).
 * Dalles lumineuses suspendues des backrooms.
 */
export const SANS_COLLISION: ReadonlySet<DecorKind> = new Set<DecorKind>(['dalleLumiere']);

/** Colliders circulaires multiples (décalage latéral en x local, rayon) : le torii a deux piliers, on passe entre eux. */
export const CERCLES_MULTIPLES: Partial<Record<DecorKind, readonly { dx: number; r: number }[]>> = {
  torii: [{ dx: -2.6, r: 0.42 }, { dx: 2.6, r: 0.42 }],
};

export const SOLID_DISTANCE = 40;
