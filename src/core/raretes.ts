/** Raretés des livrées, du plus courant au plus rare (ordre d'affichage). */
export type Rarete = 'commune' | 'rare' | 'epique' | 'legendaire' | 'exotique';

export interface RareteDef {
  id: Rarete;
  nom: string;
  /** poids de tirage en % (la somme vaut 100) */
  poids: number;
  /** couleur d'accent (#rrggbb) : bordures, barres des cartes, lueur de l'ouverture */
  couleur: string;
}

/** Tirage à la CS:GO : 79,9 / 16 / 3,2 / 0,64 / 0,26 %. */
export const RARETES: Record<Rarete, RareteDef> = {
  commune: { id: 'commune', nom: 'Commune', poids: 79.9, couleur: '#4b8bf5' },
  rare: { id: 'rare', nom: 'Rare', poids: 16, couleur: '#8e5cf0' },
  epique: { id: 'epique', nom: 'Épique', poids: 3.2, couleur: '#e83fc4' },
  legendaire: { id: 'legendaire', nom: 'Légendaire', poids: 0.64, couleur: '#ee3b3b' },
  exotique: { id: 'exotique', nom: 'Exotique', poids: 0.26, couleur: '#f5b82e' },
};

export const RARETE_IDS: Rarete[] = ['commune', 'rare', 'epique', 'legendaire', 'exotique'];

export const estRarete = (v: unknown): v is Rarete => typeof v === 'string' && v in RARETES;

/** Pourcentage à la française : « 79,9 % », « 16 % ». */
export const formatPoids = (p: number): string => `${String(p).replace('.', ',')} %`;
