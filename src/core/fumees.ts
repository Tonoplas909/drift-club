import type { Rarete } from './raretes';

/**
 * Fumées de pneus : cosmétiques du drift, débloquables dans les caisses comme les livrées.
 * Dans le catalogue des caisses et l'inventaire elles forment une « voiture » à part, de clé `fumee`
 * (lignes serveur ('fumee', id, rareté), débloquées 'fumee:id') : aucune table ni fonction SQL de plus.
 * Données pures : le rendu (couleurs animées, lueur, paillettes) est dans src/render/effects.ts.
 */

/** Clé de la collection des fumées dans le catalogue et l'inventaire (à la place d'une voiture). */
export const CLE_FUMEE = 'fumee';

/** Identifiant d'une fumée, unique ; « classique » = la fumée du décor (blanche, grise, poussiéreuse…), toujours débloquée. */
export type FumeeId = string;
export const FUMEE_DEFAUT: FumeeId = 'classique';

/**
 * Apparence déclarative d'une fumée.
 * - `couleurs` : couleurs (#rrggbb) ; vide = couleur de fumée du décor.
 * - `mode` : 'degrade' = fondu des couleurs au fil de la vie d'une bouffée ; 'alterne' = une couleur par bouffée, à tour de rôle
 *   (les deux roues arrière ont alors chacune la leur avec deux couleurs).
 * - `arcEnCiel` : teinte qui tourne (tours par seconde) ; remplace `couleurs`.
 * - `lueur` : bouffées lumineuses (mélange additif, sans ombrage) qui s'éteignent en fondu.
 * - `paillettes` : petites étincelles émises avec la fumée (`densite` = étincelles par bouffée).
 */
export interface FumeeStyle {
  couleurs: string[];
  mode: 'degrade' | 'alterne';
  arcEnCiel?: { vitesse: number; saturation: number; clarte: number };
  lueur?: boolean;
  paillettes?: { couleurs: string[]; densite: number };
}

export interface FumeeDef { id: FumeeId; nom: string; rarete: Rarete; description: string; style: FumeeStyle }

const unie = (c: string, rarete: Rarete, id: string, nom: string, description: string, clair?: string): FumeeDef =>
  ({ id, nom, rarete, description, style: { couleurs: clair ? [clair, c] : [c], mode: 'degrade' } });

export const FUMEES: FumeeDef[] = [
  { id: FUMEE_DEFAUT, nom: 'Classique', rarete: 'commune', description: 'La fumée du décor : blanche sur route, poussiéreuse dans le désert.', style: { couleurs: [], mode: 'degrade' } },

  // communes : une couleur franche
  unie('#e5352b', 'commune', 'rouge', 'Rouge tomate', 'Des nuages bien mûrs.', '#ff8a78'),
  unie('#3b82f6', 'commune', 'bleu', 'Bleu ciel', 'Le ciel tombe sur la route.', '#9cc4ff'),
  unie('#ff6fb5', 'commune', 'rose', 'Rose bonbon', 'Sucrée, collante, inratable.', '#ffc2e0'),
  unie('#3fc15a', 'commune', 'vert', 'Vert prairie', 'Une odeur de gazon frais.', '#a6eeb0'),
  unie('#ffd93a', 'commune', 'jaune', 'Jaune citron', 'Acidulée, mais pas trop.', '#fff3a0'),
  unie('#ff8a1f', 'commune', 'orange', 'Orange sanguine', 'Du jus de gomme.', '#ffc680'),
  unie('#9a4fe0', 'commune', 'violet', 'Violet prune', 'Une fumée qui a du caractère.', '#d3adff'),
  unie('#2b2b33', 'commune', 'noir', 'Noir pneu', 'Du bon gros caoutchouc brûlé.', '#5a5a66'),
  unie('#2fd0b8', 'commune', 'menthe', 'Menthe glacée', 'Fraîche, même à fond de rapport.', '#a2f3e6'),
  unie('#8a8a92', 'commune', 'cendre', 'Gris cendre', 'Le feu est éteint, la fumée reste.', '#c6c6cc'),

  // rares : dégradés et combinaisons
  { id: 'coucher', nom: 'Coucher de soleil', rarete: 'rare', description: 'Du jaune au violet, en une seule glissade.', style: { couleurs: ['#ffe27a', '#ff9a3c', '#ff5d8f', '#7a4fd6'], mode: 'degrade' } },
  { id: 'ocean', nom: 'Dégradé océan', rarete: 'rare', description: 'Des vagues de turquoise à bleu nuit.', style: { couleurs: ['#7ff0ff', '#2b8cff', '#16307a'], mode: 'degrade' } },
  { id: 'damier', nom: 'Damier', rarete: 'rare', description: 'Une bouffée noire, une bouffée blanche : on gagne !', style: { couleurs: ['#1b1b22', '#f5f5f5'], mode: 'alterne' } },
  { id: 'barbapapa', nom: 'Barbe à papa', rarete: 'rare', description: 'Rose et bleu pastel, comme à la fête foraine.', style: { couleurs: ['#ffc2e6', '#bfe4ff'], mode: 'degrade' } },
  { id: 'ecurie', nom: 'Écurie', rarete: 'rare', description: 'Les couleurs de l\'équipe, une roue chacune.', style: { couleurs: ['#e5352b', '#f4f4f4'], mode: 'alterne' } },

  // épiques : lueur ou étincelles
  { id: 'feu', nom: 'Feu de gomme', rarete: 'epique', description: 'Du jaune braise au rouge, puis plus rien.', style: { couleurs: ['#fff0a0', '#ffa21f', '#e03a14', '#3a120c'], mode: 'degrade', lueur: true } },
  { id: 'toxique', nom: 'Toxique', rarete: 'epique', description: 'À ne pas respirer. Ni toucher. Ni regarder trop longtemps.', style: { couleurs: ['#d8ff5a', '#6ee21a', '#1d6a14'], mode: 'degrade', lueur: true } },
  { id: 'neonrose', nom: 'Néon rose', rarete: 'epique', description: 'Allumée en pleine nuit, on la voit de loin.', style: { couleurs: ['#ffd1f2', '#ff3fd0', '#8a1a8a'], mode: 'degrade', lueur: true } },
  { id: 'givre', nom: 'Givre', rarete: 'epique', description: 'Des cristaux de glace dans le sillage.', style: { couleurs: ['#ffffff', '#bfe6ff', '#6aa8ff'], mode: 'degrade', paillettes: { couleurs: ['#ffffff', '#cfeeff'], densite: 0.7 } } },

  // légendaires : couleurs animées, lueur et étincelles
  { id: 'arcenciel', nom: 'Arc-en-ciel', rarete: 'legendaire', description: 'Toutes les couleurs, dans l\'ordre, tout le temps.', style: { couleurs: [], mode: 'degrade', arcEnCiel: { vitesse: 0.45, saturation: 0.9, clarte: 0.6 } } },
  { id: 'galaxie', nom: 'Galaxie', rarete: 'legendaire', description: 'Un bout de nébuleuse et quelques étoiles.', style: { couleurs: ['#c8a0ff', '#6a3fd6', '#1d1a6a'], mode: 'degrade', lueur: true, paillettes: { couleurs: ['#ffffff', '#b9a4ff', '#8fd0ff'], densite: 1 } } },
  { id: 'or', nom: 'Poussière d\'or', rarete: 'legendaire', description: 'Le luxe, ça laisse des traces.', style: { couleurs: ['#fff2a8', '#ffc21f', '#b8741a'], mode: 'degrade', lueur: true, paillettes: { couleurs: ['#fff7c2', '#ffd24a'], densite: 1 } } },

  // exotiques : le grand spectacle
  { id: 'prisme', nom: 'Prisme', rarete: 'exotique', description: 'La lumière se casse en mille morceaux.', style: { couleurs: [], mode: 'degrade', lueur: true, arcEnCiel: { vitesse: 0.9, saturation: 1, clarte: 0.62 }, paillettes: { couleurs: ['#ffffff', '#ff7ad9', '#7af0ff', '#fff27a'], densite: 1.4 } } },
  { id: 'aurore', nom: 'Aurore', rarete: 'exotique', description: 'Vert, turquoise, violet : le ciel du nord au ras du bitume.', style: { couleurs: ['#7dffb0', '#38e0e0', '#8a5cff', '#ff7ad9'], mode: 'degrade', lueur: true, paillettes: { couleurs: ['#d8fff0', '#c8b0ff'], densite: 1.2 } } },
];

export const FUMEE_IDS: FumeeId[] = FUMEES.map((f) => f.id);

export const fumeeValide = (id: unknown): id is FumeeId => typeof id === 'string' && FUMEES.some((f) => f.id === id);

/** Définition de la fumée `id` ; « classique » si inconnue. */
export function fumeeDef(id: FumeeId | undefined): FumeeDef {
  return FUMEES.find((f) => f.id === id) ?? FUMEES[0];
}

/** Nettoie une valeur lue du stockage : fumée inconnue → « classique ». */
export const validerFumee = (raw: unknown): FumeeId => (fumeeValide(raw) ? raw : FUMEE_DEFAUT);
