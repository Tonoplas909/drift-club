export type Ambiance = 'jour' | 'coucher';
/**
 * Décors disponibles. L'ORDRE est figé : le code de partage stocke l'indice (encode.ts).
 * Ajouter un thème = l'ajouter À LA FIN ici, puis dans `THEMES` (core/env/themes.ts) et `THEMES_VISUELS` (render/themes.ts).
 */
export const ENVIRONNEMENTS = ['montagne', 'neige', 'desert', 'automne', 'ville', 'pirate', 'backrooms', 'espace', 'japon', 'cyberpunk'] as const;
export type Environnement = (typeof ENVIRONNEMENTS)[number];
export type CoteBarriere = 'gauche' | 'droite' | 'deux' | 'ext';
export type TypeObjet = 'arbre' | 'sapin' | 'rocher' | 'pneus' | 'barriere' | 'panneau';

export interface PointRoute { x: number; z: number; y: number; l: number }
export interface Barriere { de: number; a: number; cote: CoteBarriere }
export interface ObjetPlace { type: TypeObjet; x: number; z: number; rot: number }

/** Lac : polygone (x, z en mètres) dont la surface est à la hauteur `niveau` (m). */
export interface PlanEau { points: { x: number; z: number }[]; niveau: number }

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
  /** lacs (optionnel : les niveaux sans eau n'ont pas ce champ) */
  eau?: PlanEau[];
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
  eauMax: 3,
  eauPointsMin: 3,
  eauPointsMax: 64,
  /** surface minimale d'un lac (m²) */
  eauAireMin: 100,
  /** hauteur de la surface d'un lac (m) */
  eauNiveauMin: -60,
  eauNiveauMax: 150,
  /** distance libre minimale (m) entre le bord de la route et un lac : la route reste au sec */
  eauMarge: 6,
} as const;
