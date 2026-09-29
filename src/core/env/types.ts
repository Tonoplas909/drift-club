export type DecorKind = 'sapin' | 'feuillu' | 'rocher' | 'rocherHaut' | 'chevron' | 'borne' | 'pneus' | 'panneau';

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
};

/** Rayon de collision (m) pour scale = 1. */
export const COLLIDER_RADIUS: Record<DecorKind, number> = {
  sapin: 0.45, feuillu: 0.5, rocher: 1.4, rocherHaut: 1.1, chevron: 0.15, borne: 0.12, pneus: 0.6, panneau: 0.15,
};

export const SOLID_DISTANCE = 40;
