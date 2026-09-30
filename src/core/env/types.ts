/** Types de décor. Les 8 premiers existent depuis le début ; les autres servent les thèmes (desert, neige, automne). */
export type DecorKind =
  | 'sapin' | 'feuillu' | 'rocher' | 'rocherHaut' | 'chevron' | 'borne' | 'pneus' | 'panneau'
  | 'cactus' | 'buisson' | 'arbreSec' | 'mesa' | 'piquet' | 'tasNeige' | 'souche';

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
};

/** Rayon de collision (m) pour scale = 1. */
export const COLLIDER_RADIUS: Record<DecorKind, number> = {
  sapin: 0.45, feuillu: 0.5, rocher: 1.4, rocherHaut: 1.1, chevron: 0.15, borne: 0.12, pneus: 0.6, panneau: 0.15,
  cactus: 0.4, buisson: 0.35, arbreSec: 0.35, mesa: 2.4, piquet: 0.1, tasNeige: 0.6, souche: 0.4,
};

export const SOLID_DISTANCE = 40;
