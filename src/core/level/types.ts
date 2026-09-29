export type Ambiance = 'jour' | 'coucher';
export type Environnement = 'montagne';
export type CoteBarriere = 'gauche' | 'droite' | 'deux' | 'ext';
export type TypeObjet = 'arbre' | 'sapin' | 'rocher' | 'pneus' | 'barriere' | 'panneau';

export interface PointRoute { x: number; z: number; y: number; l: number }
export interface Barriere { de: number; a: number; cote: CoteBarriere }
export interface ObjetPlace { type: TypeObjet; x: number; z: number; rot: number }

export interface Level {
  format: 1;
  nom: string;
  auteur: string;
  environnement: Environnement;
  ambiance: Ambiance;
  route: PointRoute[];
  barrieres: Barriere[];
  decor: { graine: number; densite: number };
  objets: ObjetPlace[];
}

export const LIMITES = {
  pointsMin: 2,
  pointsMax: 150,
  objetsMax: 300,
  longueurMax: 3000,
  largeurMin: 6,
  largeurMax: 20,
  hauteurMin: -50,
  hauteurMax: 150,
  ecartMin: 5,
  ecartMax: 150,
  nomMax: 40,
  auteurMax: 30,
} as const;
