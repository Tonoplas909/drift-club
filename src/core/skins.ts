import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import { RARETE_IDS, type Rarete } from './raretes';

/** Identifiant d'une livrée, unique par voiture. « unie » = carrosserie sans décor (défaut, toujours débloquée). */
export type SkinId = string;
export const SKIN_DEFAUT: SkinId = 'unie';

/**
 * Couleur d'un élément de livrée, dérivée de la couleur principale choisie au Garage :
 * - 'principale' : la couleur choisie ;
 * - 'contraste'  : blanc cassé si la couleur est sombre, presque noir si elle est claire (luminance > 0,6) ;
 * - 'sombre'     : la couleur choisie assombrie (× 0,35) ;
 * - 'clair'      : la couleur choisie éclaircie (60 % vers le blanc) ;
 * - '#rrggbb'    : couleur fixe, indépendante de la couleur choisie.
 * Pour une livrée à `couleurForcee`, « la couleur choisie » est la couleur imposée.
 */
export type Teinte = 'principale' | 'contraste' | 'sombre' | 'clair' | `#${string}`;

export type ZoneBande = 'capot' | 'toit' | 'coffre';

/** Éléments de livrée déclaratifs ; le rendu est dans src/render/skins.ts (un `type` = un générateur). */
export type SkinElement =
  /** Bande(s) longitudinale(s) capot-toit-coffre ; `ecart` = 0 pour une bande unique (m). */
  | { type: 'bandes'; teinte: Teinte; largeur: number; ecart: number; zones?: ZoneBande[] }
  /** Toit d'une autre couleur. */
  | { type: 'toit'; teinte: Teinte }
  /** Capot d'une autre couleur (noir mat, carbone…). */
  | { type: 'capot'; teinte: Teinte }
  /** Bas de caisse entre les passages de roues ; `hauteur` en m. */
  | { type: 'basDeCaisse'; teinte: Teinte; hauteur: number }
  /** Bande latérale qui suit la ligne d'épaule ; `bas`/`haut` = distances sous le haut de la caisse (m). */
  | { type: 'laterale'; teinte: Teinte; bas: number; haut: number }
  /** Rond (ou carré) de portière + numéro de course (1 ou 2 chiffres) ; `pos` 0..1 = place entre les passages de roues. */
  | { type: 'numero'; chiffres: string; fond: Teinte; encre: Teinte; pos?: number; forme?: 'rond' | 'carre' }
  /** Rafale de chevrons inclinés sur le flanc ; `zone` = fraction [début, fin] entre les passages de roues. */
  | { type: 'chevrons'; teinte: Teinte; nombre: number; zone: [number, number] }
  /** Damier : deux rangées de cases sur le flanc, ou grille sur le capot / le toit ; `taille` = côté d'une case (m). */
  | { type: 'damier'; teinte: Teinte; zone: 'flanc' | 'capot' | 'toit'; taille: number }
  /** Langues de flammes sur le flanc, parties du passage de roue avant vers l'arrière ; `coeur` = teinte du centre. */
  | { type: 'flammes'; teinte: Teinte; coeur: Teinte; nombre: number }
  /** Éclairs (`nombre` sur le flanc, entre les passages de roues). */
  | { type: 'eclairs'; teinte: Teinte; nombre: number }
  /** Camouflage en cases (capot, toit, flancs) ; couleurs tirées d'une graine, la carrosserie fait office de fond. */
  | { type: 'camouflage'; teintes: Teinte[]; graine: number; case: number }
  /** Pois sur le flanc : `rayon` et `pas` (distance entre centres) en m. */
  | { type: 'pois'; teinte: Teinte; rayon: number; pas: number }
  /** `nombre` bandes obliques (pente 1,2 ≈ 50° par défaut ; négative = penchée vers l'arrière) sur le flanc, larges de `largeur` m. */
  | { type: 'diagonales'; teinte: Teinte; nombre: number; largeur: number; pente?: number }
  /** Dents de scie (triangles pointes en haut) le long du bas de caisse. */
  | { type: 'dents'; teinte: Teinte; hauteur: number; pas: number }
  /** Portières d'une autre couleur (entre les passages de roues) ; `bas`/`haut` = marges sous le bas / sous le haut de caisse (m). */
  | { type: 'portieres'; teinte: Teinte; bas: number; haut: number }
  /** Barres dégradées de plus en plus courtes (traînées de vitesse) ; une teinte par barre. */
  | { type: 'degrade'; teintes: Teinte[]; hauteur: number; ecart: number }
  /** Barres horizontales pleines sur toute la longueur du flanc (arc-en-ciel, métal brossé…), une teinte par barre ; `bas` = hauteur de la première au-dessus du bas de caisse (m). */
  | { type: 'barres'; teintes: Teinte[]; hauteur: number; ecart: number; bas: number }
  /** Plusieurs bandes longitudinales côte à côte (tricolore…), une teinte par bande de `largeur` m. */
  | { type: 'bandesMulti'; teintes: Teinte[]; largeur: number; ecart: number; zones?: ZoneBande[] }
  /** Bloc plein sur la portière : fractions `de`/`a` (0..1) entre les passages de roues, marges `bas`/`haut` (m). */
  | { type: 'bloc'; teinte: Teinte; de: number; a: number; bas: number; haut: number }
  /** Gros chiffres à plat sur le capot ou le toit (lus depuis l'arrière de la voiture). */
  | { type: 'grosNumero'; chiffres: string; teinte: Teinte; zone: 'capot' | 'toit' }
  /** Motif en pixels (8 bits) posé sur la portière ; `pos` = places (0..1) entre les passages de roues, `taille` = côté d'un pixel (m), `coeur` = teinte des pixels « o ». */
  | { type: 'pixels'; motif: MotifPixel; teinte: Teinte; coeur?: Teinte; taille: number; pos: number[]; y?: number }
  /** Formes lisses (étoiles, cœurs, fleurs, flèche…) : en ligne (`nombre` ≤ 3) ou semées sur tout le flanc (`pas`, distance entre centres). */
  | { type: 'formes'; forme: FormeDecor; teinte: Teinte; coeur?: Teinte; taille: number; nombre?: number; pas?: number; graine: number }
  /** Taches irrégulières semées sur le flanc (vache, léopard : avec `coeur`, chaque tache est un anneau) ; `taille` = rayon moyen (m), `pas` = distance entre centres. */
  | { type: 'taches'; teinte: Teinte; coeur?: Teinte; taille: number; pas: number; graine: number }
  /** Rayures raides sur tout le flanc (zèbre) : `pas` entre rayures, `largeur` mesurée à l'horizontale, `pente` (raide, négative = penchée vers l'arrière). */
  | { type: 'zebrures'; teinte: Teinte; pas: number; largeur: number; pente: number }
  /** Rayures de tigre : coins effilés qui tombent de la ligne d'épaule et remontent du bas de caisse. */
  | { type: 'tigre'; teinte: Teinte; pas: number; graine: number }
  /** Peinture qui coule : bande sous la ligne d'épaule et `nombre` coulures de longueurs variées. */
  | { type: 'gouttes'; teinte: Teinte; nombre: number; graine: number }
  /** Bande de hachures (ruban de chantier) : obliques de `largeur` tous les `pas` entre `bas` et `haut` (m au-dessus du bas de caisse). */
  | { type: 'hachures'; teinte: Teinte; bas: number; haut: number; largeur: number; pas: number }
  /** Pistes de circuit imprimé (traits à 0/45°, pastilles) : `nombre` pistes tirées d'une graine. */
  | { type: 'circuit'; teinte: Teinte; nombre: number; graine: number }
  /** Quadrillage de fines lignes : flancs, capot et toit ; `pas` entre lignes, `epaisseur` en m. */
  | { type: 'grille'; teinte: Teinte; pas: number; epaisseur: number }
  /** Rampe lumineuse : `nez` = barre de cellules sur la face avant (la plus claire au centre en premier), `toit` = feux à plat sur le toit ; une teinte par cellule. */
  | { type: 'scanner'; zone: 'nez' | 'toit'; teintes: Teinte[] }
  /** Grande griffe graphique sur le flanc (les deux côtés), `variante` 1 = lames vers l'arrière, 2 = lames vers l'avant. */
  | { type: 'tribal'; teinte: Teinte; variante: 1 | 2 };

/** Motifs de pixels disponibles (bitmaps dans src/render/skins.ts). */
export type MotifPixel = 'invader' | 'coeur' | 'fantome' | 'crane' | 'note';
/** Formes lisses disponibles pour l'élément `formes`. */
export type FormeDecor = 'etoile' | 'coeur' | 'fleur' | 'losange' | 'rond' | 'croix' | 'fleche' | 'patte';

export interface SkinDef {
  id: SkinId;
  nom: string;
  rarete: Rarete;
  /** #rrggbb : la carrosserie prend cette couleur quelle que soit celle choisie au Garage (or, chrome, noir mat…). */
  couleurForcee?: string;
  /** Une ligne, en français : la référence ou la blague (fiche de la caisse, infobulle du Garage). */
  description: string;
  elements: SkinElement[];
}

const sk = (id: SkinId, nom: string, rarete: Rarete, description: string, elements: SkinElement[], couleurForcee?: string): SkinDef =>
  couleurForcee ? { id, nom, rarete, description, couleurForcee, elements } : { id, nom, rarete, description, elements };

const UNIE: SkinDef = { id: SKIN_DEFAUT, nom: 'Unie', rarete: 'commune', description: 'Ta couleur, rien d\'autre : la valeur sûre.', elements: [] };

const OR = '#d9a21b';
const NOIR = '#1d1d24';
const CRAIE = '#f4f1e8';

/** Livrées d'origine de chaque voiture (unie + 15, rangées par rareté) : les identifiants sont mémorisés chez les joueurs, on n'y touche pas. */
const BASE: Record<CarId, SkinDef[]> = {
  equilibree: [
    UNIE,
    sk('rayures', 'Double bande', 'commune', 'Deux traits pour aller droit au but.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.16, ecart: 0.08 }]),
    sk('bicolore', 'Bicolore', 'commune', 'Toit et bas de caisse en contraste : sobre et efficace.', [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'contraste', hauteur: 0.13 }]),
    sk('lisere', 'Liseré', 'commune', 'Un fin liseré à l\'épaule : chic, discret, et personne ne voit le compteur.', [{ type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.1 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.05 }]),
    sk('panda', 'Panda', 'commune', 'Portières et toit contrastés : mignon, mais ça mord dans les virages.', [{ type: 'portieres', teinte: 'contraste', bas: 0.09, haut: 0.12 }, { type: 'toit', teinte: 'contraste' }]),
    sk('diagonales', 'Diagonales', 'commune', 'Trois obliques pour avoir l\'air de rouler vite à l\'arrêt.', [{ type: 'diagonales', teinte: 'contraste', nombre: 3, largeur: 0.09 }]),
    sk('course', 'Course n°27', 'rare', 'Le 27, porte-bonheur officiel du paddock (non homologué).', [
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.13 },
      { type: 'numero', chiffres: '27', fond: CRAIE, encre: NOIR },
    ]),
    sk('carbone', 'Capot carbone', 'rare', 'Du carbone sur le capot et le toit : ça ne pèse rien, ça se voit beaucoup.', [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }]),
    sk('damier', 'Damier', 'rare', 'La ligne d\'arrivée, mais en avance.', [{ type: 'damier', teinte: 'contraste', zone: 'flanc', taille: 0.09 }, { type: 'damier', teinte: 'contraste', zone: 'toit', taille: 0.14 }]),
    sk('pois', 'Pois', 'rare', 'Des pois : la vitesse n\'empêche pas la fantaisie.', [{ type: 'pois', teinte: 'contraste', rayon: 0.05, pas: 0.2 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.07 }]),
    sk('touge', 'Touge', 'epique', 'Col de montagne, chevrons et numéro 5 : la descente de minuit.', [
      { type: 'toit', teinte: 'sombre' },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'contraste', nombre: 4, zone: [0, 0.4] },
      { type: 'numero', chiffres: '5', fond: CRAIE, encre: NOIR, pos: 0.7 },
    ]),
    sk('vitesse', 'Vitesse', 'epique', 'Des traînées de vitesse : elle est déjà repartie.', [{ type: 'degrade', teintes: ['sombre', 'clair', 'contraste'], hauteur: 0.07, ecart: 0.035 }, { type: 'capot', teinte: 'sombre' }]),
    sk('camo', 'Camouflage', 'epique', 'Introuvable dans la forêt... mais pas sur le radar.', [{ type: 'camouflage', teintes: ['sombre', 'clair'], graine: 27, case: 0.13 }]),
    sk('flammes', 'Flammes', 'legendaire', 'Pour les jours où la gomme ne suffit plus.', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 4 },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 },
    ]),
    sk('noiror', 'Noir et or', 'legendaire', 'La classe d\'un grand soir, avec la facture qui va avec.', [
      { type: 'bandes', teinte: OR, largeur: 0.12, ecart: 0.07 },
      { type: 'laterale', teinte: OR, bas: 0.07, haut: 0.11 },
      { type: 'basDeCaisse', teinte: OR, hauteur: 0.05 },
    ], '#17171d'),
    sk('or', 'Or massif', 'exotique', 'De l\'or massif. À ne pas laisser sous la pluie.', [
      { type: 'laterale', teinte: 'clair', bas: 0.07, haut: 0.11 },
      { type: 'bandes', teinte: 'clair', largeur: 0.05, ecart: 0.1 },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.1 },
    ], OR),
  ],
  legere: [
    UNIE,
    sk('bande', 'Bande unique', 'commune', 'Une seule bande, aucune hésitation.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.22, ecart: 0 }]),
    sk('bicolore', 'Bas de caisse', 'commune', 'Bas de caisse sombre : les cailloux n\'y verront que du feu.', [{ type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.15 }, { type: 'laterale', teinte: 'sombre', bas: 0.06, haut: 0.1 }]),
    sk('filet', 'Filet', 'commune', 'Un filet fin et un toit sombre : la discrétion en personne.', [{ type: 'laterale', teinte: 'contraste', bas: 0.05, haut: 0.08 }, { type: 'toit', teinte: 'sombre' }]),
    sk('dents', 'Dents de scie', 'commune', 'Elle sourit de toutes ses dents : prudence.', [{ type: 'dents', teinte: 'contraste', hauteur: 0.14, pas: 0.17 }]),
    sk('portieres', 'Portières noires', 'commune', 'Portières noires : l\'occasion... assumée.', [{ type: 'portieres', teinte: NOIR, bas: 0.1, haut: 0.1 }]),
    sk('course', 'Course n°13', 'rare', 'Le 13 : pour les pilotes qui se moquent du sort.', [
      { type: 'numero', chiffres: '13', fond: CRAIE, encre: NOIR },
      { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.06, zones: ['capot'] },
    ]),
    sk('taxi', 'Taxi', 'rare', 'Jaune à damier : c\'est libre, monsieur ?', [
      { type: 'damier', teinte: NOIR, zone: 'flanc', taille: 0.09 },
      { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.06 },
    ], '#ffc61a'),
    sk('rallye', 'Rallye', 'rare', 'Toit blanc, numéro 3, et de la poussière jusque dans les rêves.', [
      { type: 'toit', teinte: 'contraste' },
      { type: 'diagonales', teinte: 'sombre', nombre: 2, largeur: 0.08 },
      { type: 'numero', chiffres: '3', fond: 'contraste', encre: 'sombre', forme: 'carre', pos: 0.4 },
    ]),
    sk('mat', 'Noir mat', 'rare', 'Noir mat : elle avale la lumière, et les regards avec.', [
      { type: 'laterale', teinte: '#3a3d49', bas: 0.06, haut: 0.1 },
      { type: 'bandes', teinte: '#3a3d49', largeur: 0.1, ecart: 0.06, zones: ['capot', 'toit'] },
    ], '#20222a'),
    sk('touge', 'Touge', 'epique', 'Chevrons et capot noir dans la brume du col : ça sent le tofu chaud.', [
      { type: 'capot', teinte: NOIR },
      { type: 'laterale', teinte: 'contraste', bas: 0.08, haut: 0.13 },
      { type: 'chevrons', teinte: 'contraste', nombre: 3, zone: [0, 0.35] },
    ]),
    sk('eclairs', 'Éclairs', 'epique', 'Des éclairs : le tonnerre arrive juste après.', [{ type: 'eclairs', teinte: '#ffd23f', nombre: 3 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.07 }]),
    sk('degrade', 'Dégradé', 'epique', 'Quatre traînées, zéro regret.', [{ type: 'degrade', teintes: ['sombre', 'clair', 'contraste', 'clair'], hauteur: 0.05, ecart: 0.03 }]),
    sk('flammes', 'Flammes bleues', 'legendaire', 'Plus chaudes que les rouges, c\'est scientifique.', [{ type: 'flammes', teinte: 'contraste', coeur: '#19c8ff', nombre: 3 }]),
    sk('kamikaze', 'Kamikaze', 'legendaire', 'Des dents géantes, des freins facultatifs.', [
      { type: 'dents', teinte: 'contraste', hauteur: 0.22, pas: 0.32 },
      { type: 'bandes', teinte: 'contraste', largeur: 0.12, ecart: 0, zones: ['capot', 'toit'] },
      { type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.09 },
    ]),
    sk('chrome', 'Chrome', 'exotique', 'Du chrome : on s\'y voit, et on s\'y trouve beau.', [
      { type: 'laterale', teinte: '#7f8da3', bas: 0.06, haut: 0.1 },
      { type: 'basDeCaisse', teinte: '#4a5568', hauteur: 0.1 },
      { type: 'bandes', teinte: '#eef4ff', largeur: 0.05, ecart: 0.1, zones: ['capot', 'toit'] },
    ], '#cfd6e0'),
  ],
  turbo: [
    UNIE,
    sk('rayures', 'Double bande', 'commune', 'Deux traits, un seul objectif : la ligne droite.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.18, ecart: 0.1 }]),
    sk('pois', 'Pois', 'commune', 'Des pois sur un moteur turbo : le contraste, c\'est la vie.', [{ type: 'pois', teinte: 'contraste', rayon: 0.045, pas: 0.19 }]),
    sk('diagonales', 'Diagonales', 'commune', 'Deux grandes obliques : la vitesse se lit de côté.', [{ type: 'diagonales', teinte: 'contraste', nombre: 2, largeur: 0.16 }]),
    sk('filet', 'Filet', 'commune', 'Un filet à l\'épaule, un bas de caisse sombre : sobre, sauf sous le capot.', [{ type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.09 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.08 }]),
    sk('bicolore', 'Toit contrasté', 'commune', 'Un toit contrasté pour qu\'on te repère depuis l\'hélico.', [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.1 }]),
    sk('carbone', 'Carbone', 'rare', 'Tout en carbone, sauf le prix, qui est en or.', [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }, { type: 'basDeCaisse', teinte: '#26282e', hauteur: 0.13 }]),
    sk('course', 'Course n°7', 'rare', 'Le 7 : chiffre chanceux, pilote encore plus.', [
      { type: 'toit', teinte: 'contraste' },
      { type: 'numero', chiffres: '7', fond: CRAIE, encre: NOIR, pos: 0.45 },
      { type: 'basDeCaisse', teinte: 'contraste', hauteur: 0.13 },
    ]),
    sk('damier', 'Damier', 'rare', 'Damier sur les flancs et le capot : la victoire sans attendre l\'arrivée.', [{ type: 'damier', teinte: 'contraste', zone: 'flanc', taille: 0.1 }, { type: 'damier', teinte: 'contraste', zone: 'capot', taille: 0.14 }]),
    sk('camo', 'Camouflage', 'rare', 'Impossible à repérer... sauf quand elle passe le mur du son.', [{ type: 'camouflage', teintes: ['sombre', 'clair'], graine: 7, case: 0.14 }]),
    sk('touge', 'Sponsor touge', 'epique', 'Chevrons à gogo et zéro sponsor : la touge, version dépouillée.', [
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'contraste', nombre: 5, zone: [0, 0.45] },
      { type: 'bandes', teinte: 'sombre', largeur: 0.3, ecart: 0, zones: ['capot'] },
    ]),
    sk('eclairs', 'Éclairs', 'epique', 'Quatre éclairs bleus : ça décoiffe même les voisins.', [{ type: 'eclairs', teinte: '#3ad6ff', nombre: 4 }, { type: 'laterale', teinte: 'sombre', bas: 0.06, haut: 0.09 }]),
    sk('vitesse', 'Vitesse', 'epique', 'Des traînées de vitesse : le décor n\'a pas eu le temps de la voir.', [{ type: 'degrade', teintes: ['clair', 'contraste', 'sombre'], hauteur: 0.08, ecart: 0.04 }, { type: 'toit', teinte: 'sombre' }]),
    sk('flammes', 'Flammes', 'legendaire', 'Des flammes sur le capot noir : le turbo, on l\'entend et on le voit.', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 4 },
      { type: 'capot', teinte: 'sombre' },
    ]),
    sk('noiror', 'Noir et or', 'legendaire', 'Noir profond, filets dorés : pour rouler comme un roi.', [
      { type: 'bandes', teinte: OR, largeur: 0.14, ecart: 0.08 },
      { type: 'laterale', teinte: OR, bas: 0.07, haut: 0.11 },
      { type: 'chevrons', teinte: OR, nombre: 4, zone: [0, 0.35] },
    ], '#14141a'),
    sk('or', 'Plaqué or', 'exotique', 'Plaqué or : à peine moins massif, tout aussi tape-à-l\'œil.', [
      { type: 'bandes', teinte: 'sombre', largeur: 0.16, ecart: 0.08 },
      { type: 'laterale', teinte: 'clair', bas: 0.07, haut: 0.1 },
      { type: 'toit', teinte: 'clair' },
    ], '#e3b02b'),
  ],
  kei: [
    UNIE,
    sk('rayures', 'Filet double', 'commune', 'Deux filets, pas un de plus : la place est comptée.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.05 }]),
    sk('bicolore', 'Toit blanc', 'commune', 'Un toit contrasté : ça fait grande voiture, sans les mensualités.', [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.1 }]),
    sk('filet', 'Petit liseré', 'commune', 'Un liseré à l\'épaule : le seul luxe qui rentre dans le coffre.', [{ type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.1 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.05 }]),
    sk('konbini', 'Supérette', 'commune', 'Vert, blanc, orange : ouverte toute la nuit, comme les cols de montagne.', [
      { type: 'bandesMulti', teintes: ['#2fa84f', CRAIE, '#ff8a1f'], largeur: 0.07, ecart: 0 },
      { type: 'laterale', teinte: '#2fa84f', bas: 0.06, haut: 0.1 },
      { type: 'laterale', teinte: CRAIE, bas: 0.1, haut: 0.14 },
      { type: 'laterale', teinte: '#ff8a1f', bas: 0.14, haut: 0.18 },
    ]),
    sk('minipois', 'Mini pois', 'commune', 'De tout petits pois pour une toute petite voiture.', [{ type: 'pois', teinte: 'contraste', rayon: 0.035, pas: 0.15 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 }]),
    sk('course', 'Course n°66', 'rare', 'Le 66, comme les six cent soixante centimètres cubes : petit moteur, grosses ambitions.', [
      { type: 'numero', chiffres: '66', fond: CRAIE, encre: NOIR },
      { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.06, zones: ['capot'] },
    ]),
    sk('coccinelle', 'Coccinelle', 'rare', 'Rouge à pois noirs : ça porte bonheur, mais ça pique quand même.', [
      { type: 'pois', teinte: NOIR, rayon: 0.075, pas: 0.27 },
      { type: 'toit', teinte: NOIR },
      { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.05 },
    ], '#d6262b'),
    sk('abeille', 'Abeille', 'rare', 'Jaune et noir : petite, rapide, et elle pique dans les épingles.', [
      { type: 'zebrures', teinte: NOIR, pas: 0.22, largeur: 0.09, pente: 3 },
      { type: 'toit', teinte: NOIR },
    ], '#f2c31b'),
    sk('touge', 'Mini touge', 'epique', 'Trop petite pour la piste, parfaite pour l\'épingle : chevrons et numéro 3.', [
      { type: 'toit', teinte: 'sombre' },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'contraste', nombre: 3, zone: [0, 0.4] },
      { type: 'numero', chiffres: '3', fond: CRAIE, encre: NOIR, pos: 0.72 },
    ]),
    sk('fusee', 'Mini-fusée', 'legendaire', 'Petite mais explosive : la flamme dépasse largement de la voiture.', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 4 },
      { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.05, zones: ['capot', 'toit'] },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 },
    ]),
    sk('or', 'Kei en or', 'exotique', 'Un petit lingot sur roues : on la range au coffre-fort, on la sort pour les grandes occasions.', [
      { type: 'laterale', teinte: 'clair', bas: 0.06, haut: 0.1 },
      { type: 'toit', teinte: 'clair' },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.09 },
    ], '#e3b02b'),
  ],
  muscle: [
    UNIE,
    sk('bande', 'Grande bande', 'commune', 'Une seule grande bande, comme sur les affiches des années 70.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.3, ecart: 0 }]),
    sk('rayures', 'Doubles bandes', 'commune', 'Deux bandes de course : l\'uniforme du bitume.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.2, ecart: 0.1 }]),
    sk('bicolore', 'Toit vinyle', 'commune', 'Toit vinyle noir : très années 70, très collant l\'été.', [{ type: 'toit', teinte: 'sombre' }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.12 }]),
    sk('lisere', 'Filet chromé', 'commune', 'Un filet chromé à la ceinture : de l\'argent en barre, littéralement.', [
      { type: 'laterale', teinte: '#c9ced6', bas: 0.06, haut: 0.09 },
      { type: 'basDeCaisse', teinte: '#c9ced6', hauteur: 0.04 },
    ]),
    sk('diner', 'Diner', 'commune', 'Rose bonbon et turquoise : le milk-shake sur quatre roues.', [
      { type: 'laterale', teinte: '#3ad6c9', bas: 0.06, haut: 0.11 },
      { type: 'laterale', teinte: '#ff8fc0', bas: 0.11, haut: 0.16 },
      { type: 'basDeCaisse', teinte: '#ff8fc0', hauteur: 0.05 },
    ]),
    sk('course', 'Course n°71', 'rare', 'Le 71 : l\'année où tout le monde avait de la puissance à revendre.', [
      { type: 'numero', chiffres: '71', fond: CRAIE, encre: NOIR },
      { type: 'bandes', teinte: 'contraste', largeur: 0.16, ecart: 0.08, zones: ['capot'] },
    ]),
    sk('carbone', 'Capot carbone', 'rare', 'Du carbone sur un V8 : une armoire à glace avec un régime sans sel.', [
      { type: 'capot', teinte: '#26282e' },
      { type: 'toit', teinte: '#26282e' },
      { type: 'basDeCaisse', teinte: '#26282e', hauteur: 0.13 },
    ]),
    sk('damier', 'Damier', 'rare', 'Le drapeau à damier sur les flancs : la victoire, avec un peu d\'avance.', [
      { type: 'damier', teinte: 'contraste', zone: 'flanc', taille: 0.11 },
      { type: 'damier', teinte: 'contraste', zone: 'capot', taille: 0.16 },
    ]),
    sk('route66', 'Route 66', 'rare', 'Deux voies, un numéro, et huit cylindres pour l\'horizon.', [
      { type: 'numero', chiffres: '66', fond: NOIR, encre: CRAIE, forme: 'carre', pos: 0.45 },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.11 },
      { type: 'bandes', teinte: 'contraste', largeur: 0.08, ecart: 0.06, zones: ['toit', 'coffre'] },
    ]),
    sk('vitesse', 'Vitesse', 'epique', 'Des traînées de vitesse : le quart de mile est déjà loin.', [{ type: 'degrade', teintes: ['sombre', 'clair', 'contraste'], hauteur: 0.09, ecart: 0.04 }, { type: 'capot', teinte: 'sombre' }]),
    sk('camo', 'Camouflage', 'epique', 'Impossible de la manquer, même en camouflage : on l\'entend arriver.', [{ type: 'camouflage', teintes: ['sombre', 'clair'], graine: 71, case: 0.16 }]),
    sk('possedee', 'Possédée', 'epique', 'Rouge sang, toit blanc, et l\'autoradio qui s\'allume tout seul.', [
      { type: 'toit', teinte: CRAIE },
      { type: 'laterale', teinte: CRAIE, bas: 0.07, haut: 0.1 },
      { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.07 },
    ], '#c21a20'),
    sk('motardfantome', 'Motard fantôme', 'epique', 'Un crâne, des flammes, et un sourire jaune : elle brûle la gomme pour de vrai.', [
      { type: 'flammes', teinte: '#ff7a1a', coeur: '#ffe14a', nombre: 4 },
      { type: 'pixels', motif: 'crane', teinte: CRAIE, coeur: '#15151a', taille: 0.05, pos: [0.5], y: 0.4 },
    ], '#15151a'),
    sk('flammes', 'Flammes d\'enfer', 'legendaire', 'Le classique du hot rod : ça sent la gomme et l\'essence.', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 5 },
      { type: 'capot', teinte: 'sombre' },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 },
    ]),
    sk('bandit', 'Bandit', 'legendaire', 'Noire, dorée, radio qui grésille : tous les gyrophares du comté à ses trousses.', [
      { type: 'bandes', teinte: OR, largeur: 0.18, ecart: 0, zones: ['capot', 'toit'] },
      { type: 'laterale', teinte: OR, bas: 0.07, haut: 0.11 },
      { type: 'basDeCaisse', teinte: OR, hauteur: 0.05 },
    ], '#101014'),
  ],
  rotative: [
    UNIE,
    sk('bande', 'Bande centrale', 'commune', 'Une bande centrale, propre comme un rotor.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.16, ecart: 0 }]),
    sk('bicolore', 'Bas de caisse', 'commune', 'Bas de caisse sombre : les cailloux de la touge n\'y verront que du feu.', [{ type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.13 }, { type: 'laterale', teinte: 'sombre', bas: 0.06, haut: 0.09 }]),
    sk('filet', 'Filet', 'commune', 'Un filet fin et un toit sombre : sobre, jusqu\'au premier brap.', [{ type: 'laterale', teinte: 'contraste', bas: 0.05, haut: 0.08 }, { type: 'toit', teinte: 'sombre' }]),
    sk('huile', 'Fuite d\'huile', 'commune', 'Elle marque son territoire : ça goutte, mais ça tourne.', [{ type: 'gouttes', teinte: NOIR, nombre: 7, graine: 3 }]),
    sk('portieres', 'Portières claires', 'commune', 'Des portières d\'une autre couleur : l\'occasion, mais assumée.', [{ type: 'portieres', teinte: 'contraste', bas: 0.1, haut: 0.1 }]),
    sk('course', 'Course n°787', 'rare', 'Le 787 : quatre rotors, un seul chrono.', [
      { type: 'numero', chiffres: '787', fond: CRAIE, encre: NOIR },
      { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.06, zones: ['capot'] },
    ]),
    sk('carbone', 'Carbone', 'rare', 'Capot et toit en carbone : le rotor est léger, la facture aussi... presque.', [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }, { type: 'basDeCaisse', teinte: '#26282e', hauteur: 0.11 }]),
    sk('rotor', 'Rotor', 'rare', 'Un triangle qui tourne dans un ovale : la géométrie au service du brap.', [
      { type: 'formes', forme: 'losange', teinte: '#ffd23f', taille: 0.15, nombre: 2, graine: 5 },
      { type: 'laterale', teinte: '#ffd23f', bas: 0.06, haut: 0.09 },
    ], '#1d2a4d'),
    sk('crepuscule', 'Crépuscule', 'rare', 'Le soleil couchant sur le col : rose, orange, et puis la nuit.', [
      { type: 'barres', teintes: ['#ffd23f', '#ff9a3d', '#ff5e7e', '#a24bd8'], hauteur: 0.05, ecart: 0.02, bas: 0.16 },
      { type: 'toit', teinte: '#ff5e7e' },
    ], '#2a1f3d'),
    sk('touge', 'Touge', 'epique', 'Chevrons, numéro 8 et brume de minuit : le col est à elle.', [
      { type: 'toit', teinte: 'sombre' },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.11 },
      { type: 'chevrons', teinte: 'contraste', nombre: 4, zone: [0, 0.4] },
      { type: 'numero', chiffres: '8', fond: CRAIE, encre: NOIR, pos: 0.7 },
    ]),
    sk('quatrerotors', 'Quatre rotors', 'epique', 'Blanc, orange et vert : une victoire aux vingt-quatre heures, et un bruit qu\'on n\'oublie pas.', [
      { type: 'barres', teintes: ['#ff8a1f', '#ff8a1f', '#2fa84f', '#2fa84f'], hauteur: 0.06, ecart: 0.03, bas: 0.13 },
      { type: 'bandes', teinte: '#2fa84f', largeur: 0.14, ecart: 0.07, zones: ['capot'] },
    ], '#f4f1e8'),
    sk('brap', 'Brap !', 'epique', 'Le bruit d\'un moteur qui tourne dans l\'autre sens : rose, jaune, et pas très discret.', [
      { type: 'flammes', teinte: '#ff3e9a', coeur: '#ffd23f', nombre: 3 },
      { type: 'basDeCaisse', teinte: '#ff3e9a', hauteur: 0.05 },
    ], '#1c1428'),
    sk('derniere', 'Dernière édition', 'legendaire', 'Noir mat et filets rouges : tout a une fin, sauf le brap.', [
      { type: 'laterale', teinte: '#d6262b', bas: 0.06, haut: 0.09 },
      { type: 'bandes', teinte: '#d6262b', largeur: 0.06, ecart: 0.08 },
      { type: 'basDeCaisse', teinte: '#d6262b', hauteur: 0.04 },
    ], '#101014'),
    sk('chrome', 'Chrome rotatif', 'exotique', 'Du chrome qui tourne : on s\'y voit, et on s\'y perd.', [
      { type: 'laterale', teinte: '#7f8da3', bas: 0.06, haut: 0.1 },
      { type: 'basDeCaisse', teinte: '#4a5568', hauteur: 0.1 },
      { type: 'bandes', teinte: '#eef4ff', largeur: 0.05, ecart: 0.1, zones: ['capot', 'toit'] },
    ], '#cfd6e0'),
  ],
  break: [
    UNIE,
    sk('rayures', 'Filets de famille', 'commune', 'Deux filets sur le toit et une galerie pour les valises : on part en vacances.', [{ type: 'bandes', teinte: 'contraste', largeur: 0.12, ecart: 0.08 }]),
    sk('bicolore', 'Toit clair', 'commune', 'Un toit contrasté et un bas de caisse sombre : le break du dimanche.', [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.11 }]),
    sk('filet', 'Liseré', 'commune', 'Un liseré sur toute la longueur : il y en a, de la longueur.', [{ type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.1 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.05 }]),
    sk('vacances', 'Départ en vacances', 'commune', 'Ciel, sable et mer en trois bandes : le coffre est plein, la glacière aussi.', [
      { type: 'laterale', teinte: '#4aa8e8', bas: 0.06, haut: 0.11 },
      { type: 'laterale', teinte: '#f0d9a0', bas: 0.11, haut: 0.16 },
      { type: 'laterale', teinte: '#ff8a1f', bas: 0.16, haut: 0.21 },
    ]),
    sk('portieres', 'Portières claires', 'commune', 'Des portières d\'une autre couleur : le break d\'occasion, fièrement.', [{ type: 'portieres', teinte: 'contraste', bas: 0.1, haut: 0.12 }]),
    sk('boiseries', 'Boiseries', 'rare', 'Des panneaux en faux bois sur les flancs : la classe des années 70, le vernis en moins.', [
      { type: 'bloc', teinte: '#8a5a2b', de: 0.05, a: 0.95, bas: 0.12, haut: 0.18 },
      { type: 'barres', teintes: ['#5a3a1a', '#5a3a1a', '#5a3a1a'], hauteur: 0.018, ecart: 0.05, bas: 0.2 },
    ], '#3b6a9a'),
    sk('courrier', 'Courrier', 'rare', 'Jaune vif, numéro 12, aucune adresse : le courrier arrive toujours à l\'heure. Il glisse un peu.', [
      { type: 'numero', chiffres: '12', fond: CRAIE, encre: NOIR, forme: 'carre' },
      { type: 'laterale', teinte: '#2f5fc9', bas: 0.06, haut: 0.1 },
    ], '#f2c31b'),
    sk('dalmatiens', 'Cent un dalmatiens', 'rare', 'Une portée de taches noires sur fond blanc : ça aboie dans les épingles.', [
      { type: 'taches', teinte: NOIR, taille: 0.06, pas: 0.22, graine: 101 },
    ], '#f4f4f0'),
    sk('taxi', 'Taxi', 'rare', 'Jaune à damier, galerie de valises : c\'est libre, monsieur ?', [
      { type: 'damier', teinte: NOIR, zone: 'flanc', taille: 0.09 },
      { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.06 },
    ], '#ffc61a'),
    sk('touge', 'Touge en famille', 'epique', 'Chevrons, numéro 4 et quatre places : la descente de minuit avec les enfants à l\'arrière.', [
      { type: 'toit', teinte: 'sombre' },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'contraste', nombre: 4, zone: [0, 0.4] },
      { type: 'numero', chiffres: '4', fond: CRAIE, encre: NOIR, pos: 0.7 },
    ]),
    sk('safari', 'Safari', 'epique', 'Beige sable, rayures de zèbre : le break a passé la frontière des parcs nationaux.', [
      { type: 'zebrures', teinte: '#5a3a1a', pas: 0.26, largeur: 0.08, pente: 3 },
      { type: 'toit', teinte: '#5a3a1a' },
    ], '#d9b57a'),
    sk('flammes', 'Flammes de papa', 'legendaire', 'Des flammes sur un break : il a toujours voulu, il n\'a jamais osé.', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 4 },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 },
    ]),
    sk('or', 'Break de luxe', 'exotique', 'Plaqué or jusqu\'à la galerie : les valises voyagent en première classe.', [
      { type: 'laterale', teinte: 'clair', bas: 0.07, haut: 0.11 },
      { type: 'toit', teinte: 'clair' },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.09 },
    ], '#e3b02b'),
  ],
};

const BLEU = '#1f4fb5';
const ROUGE = '#d6262b';
const CYAN = '#28e6ff';
const VERT = '#2ee06a';
const ARC_EN_CIEL: Teinte[] = ['#ff3b30', '#ff9f0a', '#ffe14a', '#34c759', '#0a84ff', '#bf5af2'];

/**
 * Livrées à références (culture pop, mèmes, clins d'œil au cinéma de la route) : aucune marque, aucun logo, aucun titre écrit en toutes lettres.
 * Chacune peut équiper plusieurs voitures (`NOUVELLES` ci-dessous) ; la forme s'adapte à la carrosserie.
 */
const BIBLIO: Record<string, SkinDef> = {
  // communes : elles gardent la couleur choisie au Garage
  riviera: sk('riviera', 'Riviera', 'commune', 'Bleu, blanc, rouge : la Côte d\'Azur à fond la caisse.', [
    { type: 'bandesMulti', teintes: [BLEU, CRAIE, ROUGE], largeur: 0.07, ecart: 0 },
    { type: 'laterale', teinte: BLEU, bas: 0.06, haut: 0.11 },
    { type: 'laterale', teinte: CRAIE, bas: 0.11, haut: 0.16 },
    { type: 'laterale', teinte: ROUGE, bas: 0.16, haut: 0.21 },
  ]),
  polka: sk('polka', 'Grosse polka', 'commune', 'Des pois XXL : ça fait pop, et ça se voit de loin.', [{ type: 'formes', forme: 'rond', teinte: 'contraste', taille: 0.075, pas: 0.25, graine: 4 }, { type: 'toit', teinte: 'contraste' }]),
  kawaii: sk('kawaii', 'Kawaii', 'commune', 'Des petits cœurs roses : mignon jusqu\'au premier dérapage.', [
    { type: 'formes', forme: 'coeur', teinte: '#ff8fc0', taille: 0.09, pas: 0.3, graine: 11 },
    { type: 'basDeCaisse', teinte: '#ff8fc0', hauteur: 0.05 },
  ]),
  danger: sk('danger', 'Danger !', 'commune', 'Passage de chantier : merci de ne pas s\'approcher.', [
    { type: 'bloc', teinte: '#ffc61a', de: 0, a: 1, bas: 0.1, haut: 0.32 },
    { type: 'hachures', teinte: NOIR, bas: 0.1, haut: 0.23, largeur: 0.055, pas: 0.13 },
  ]),
  huitbits: sk('huitbits', '8 bits', 'commune', 'Des envahisseurs en pixels : on tire, on freine, on recommence.', [
    { type: 'pixels', motif: 'invader', teinte: 'contraste', taille: 0.036, pos: [0.25, 0.75] },
    { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.05 },
  ]),
  peinture: sk('peinture', 'Peinture fraîche', 'commune', 'Ne pas toucher : la peinture n\'a pas fini de couler.', [{ type: 'gouttes', teinte: 'contraste', nombre: 8, graine: 5 }]),
  zebre: sk('zebre', 'Zèbre', 'commune', 'Un passage piéton, mais qui roule à fond.', [{ type: 'zebrures', teinte: 'contraste', pas: 0.2, largeur: 0.09, pente: 3 }]),
  neonbas: sk('neonbas', 'Néons', 'commune', 'Des néons sous la caisse : on double à l\'ambiance.', [
    { type: 'laterale', teinte: CYAN, bas: 0.07, haut: 0.11 },
    { type: 'basDeCaisse', teinte: '#ff3ec9', hauteur: 0.06 },
  ]),
  n1: sk('n1', 'Numéro un', 'commune', 'Toujours premier, du moins dans ses rêves.', [
    { type: 'numero', chiffres: '1', fond: CRAIE, encre: NOIR },
    { type: 'grosNumero', chiffres: '1', teinte: 'contraste', zone: 'capot' },
  ]),
  vies: sk('vies', 'Vies en bonus', 'commune', 'Trois cœurs en réserve : on a le droit de se rater.', [
    { type: 'pixels', motif: 'coeur', teinte: 'contraste', taille: 0.03, pos: [0.2, 0.5, 0.8], y: 0.36 },
    { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 },
  ]),
  flammettes: sk('flammettes', 'Petites flammes', 'commune', 'Des flammettes de voiture miniature : ça n\'en fait pas moins peur.', [
    { type: 'flammes', teinte: NOIR, coeur: '#ffb31a', nombre: 4 },
  ]),
  rafistolee: sk('rafistolee', 'Rafistolée', 'commune', 'Un peu de ruban adhésif, et ça repart.', [
    { type: 'diagonales', teinte: '#a9adb3', nombre: 2, largeur: 0.09 },
    { type: 'diagonales', teinte: '#a9adb3', nombre: 2, largeur: 0.09, pente: -1.2 },
  ]),
  n404: sk('n404', 'Introuvable', 'commune', 'Erreur 404 : livrée introuvable. Sauf ici.', [
    { type: 'numero', chiffres: '404', fond: CRAIE, encre: NOIR },
    { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.05 },
  ]),

  sakura: sk('sakura', 'Sakura', 'commune', 'Des fleurs de cerisier : ça tombe comme les pétales, à la première épingle.', [
    { type: 'formes', forme: 'fleur', teinte: '#ff9fc4', coeur: '#fff0a0', taille: 0.075, pas: 0.32, graine: 15 },
    { type: 'basDeCaisse', teinte: '#ff9fc4', hauteur: 0.05 },
  ]),

  // rares
  tofu: sk('tofu', 'Livreur de tofu', 'rare', 'Blanc et noir, capot sombre : la livraison de tofu à l\'aube, sans en renverser une goutte.', [
    { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.17 },
    { type: 'capot', teinte: NOIR },
    { type: 'laterale', teinte: NOIR, bas: 0.06, haut: 0.09 },
  ], '#f2f2ee'),
  nyan: sk('nyan', 'Nyan', 'rare', 'Un chat qui vole en laissant un arc-en-ciel : miaou à 200 km/h.', [
    { type: 'barres', teintes: ARC_EN_CIEL, hauteur: 0.055, ecart: 0, bas: 0.16 },
    { type: 'formes', forme: 'etoile', teinte: '#ffffff', taille: 0.05, nombre: 2, graine: 3 },
  ], '#f7a8d0'),
  tigre: sk('tigre', 'Œil du tigre', 'rare', 'La chanson de toutes les montées en puissance.', [
    { type: 'tigre', teinte: NOIR, pas: 0.2, graine: 3 },
    { type: 'bandes', teinte: NOIR, largeur: 0.1, ecart: 0.06, zones: ['capot'] },
  ], '#f28c1a'),
  leopard: sk('leopard', 'Léopard', 'rare', 'Des rosettes de chat sauvage : il chasse en solitaire.', [
    { type: 'taches', teinte: NOIR, coeur: 'principale', taille: 0.06, pas: 0.24, graine: 9 },
    { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.05 },
  ], '#d9a441'),
  meuh: sk('meuh', 'Meuh', 'rare', 'Elle n\'a pas peur du taureau. Ni du panneau.', [
    { type: 'taches', teinte: NOIR, taille: 0.075, pas: 0.27, graine: 21 },
    { type: 'basDeCaisse', teinte: '#f6b8c8', hauteur: 0.04 },
  ], '#f4f4f0'),
  doge: sk('doge', 'Doge', 'rare', 'Wow. Très vitesse. Tellement chevaux.', [
    { type: 'basDeCaisse', teinte: '#fbf1dc', hauteur: 0.13 },
    { type: 'formes', forme: 'patte', teinte: '#a3652a', taille: 0.14, nombre: 2, graine: 1 },
    { type: 'toit', teinte: '#c9893c' },
  ], '#e9b45f'),
  stonks: sk('stonks', 'Stonks', 'rare', 'Ça ne peut que monter.', [
    { type: 'formes', forme: 'fleche', teinte: '#1fd066', taille: 0.27, nombre: 1, graine: 1 },
    { type: 'laterale', teinte: '#e8e8f0', bas: 0.06, haut: 0.1 },
  ], '#2e4a78'),
  '24h': sk('24h', '24 Heures', 'rare', 'Bleu layette et orange vif : elle a fait un tour de cadran sans changer de pilote.', [
    { type: 'bandes', teinte: '#ff8a1f', largeur: 0.12, ecart: 0.06 },
    { type: 'laterale', teinte: '#ff8a1f', bas: 0.07, haut: 0.11 },
    { type: 'numero', chiffres: '17', fond: CRAIE, encre: NOIR, pos: 0.55 },
  ], '#8fd3f0'),
  mystere: sk('mystere', 'Mystère', 'rare', 'Un minibus hippie, des fleurs, et un chien qui a toujours peur derrière.', [
    { type: 'formes', forme: 'fleur', teinte: '#f28a1f', coeur: '#fff0a0', taille: 0.115, pas: 0.4, graine: 6 },
    { type: 'laterale', teinte: '#8bcf5b', bas: 0.06, haut: 0.1 },
  ], '#5cc2b0'),
  fantomes: sk('fantomes', 'Pas peur des fantômes', 'rare', 'Qui tu vas appeler ? Pas la fourrière.', [
    { type: 'bandes', teinte: ROUGE, largeur: 0.12, ecart: 0.06, zones: ['capot', 'toit'] },
    { type: 'laterale', teinte: ROUGE, bas: 0.06, haut: 0.09 },
    { type: 'pixels', motif: 'fantome', teinte: ROUGE, coeur: CRAIE, taille: 0.042, pos: [0.5], y: 0.36 },
  ], '#f4f4f0'),
  urgences: sk('urgences', 'Urgences', 'rare', 'Damier rouge et blanc, gyrophare : place, s\'il vous plaît !', [
    { type: 'damier', teinte: '#e2231a', zone: 'flanc', taille: 0.08 },
    { type: 'scanner', zone: 'toit', teintes: ['#e2231a', '#2f6bff'] },
  ], '#f4f4f0'),
  intercepteur: sk('intercepteur', 'Intercepteur', 'rare', 'Noir et blanc, gyrophare : ni logo ni sirène officielle, juste l\'allure.', [
    { type: 'portieres', teinte: '#f4f4f0', bas: 0.1, haut: 0.14 },
    { type: 'scanner', zone: 'toit', teintes: ['#e2231a', '#2f6bff'] },
  ], '#17171d'),
  banane: sk('banane', 'Peau de banane', 'rare', 'Attention : ça glisse.', [
    { type: 'taches', teinte: '#6b4a1a', taille: 0.022, pas: 0.13, graine: 2 },
    { type: 'toit', teinte: '#e8b820' },
  ], '#f2d02a'),
  champi: sk('champi', 'Super champi', 'rare', 'Un petit coup de pouce pour la puissance : elle grandit à chaque virage.', [
    { type: 'formes', forme: 'rond', teinte: '#f6f2e6', taille: 0.08, pas: 0.27, graine: 7 },
    { type: 'basDeCaisse', teinte: '#f6ecd0', hauteur: 0.1 },
  ], '#d6262b'),
  slime: sk('slime', 'Gluant', 'rare', 'Ça coule, c\'est vert, et ça ne part pas au lavage.', [{ type: 'gouttes', teinte: '#8cff3a', nombre: 9, graine: 8 }], '#242830'),
  eclaboussure: sk('eclaboussure', 'Éclaboussure', 'rare', 'Trois pots de peinture fluo, lancés depuis le bord de la route.', [
    { type: 'taches', teinte: '#ff3ec9', taille: 0.15, pas: 0.6, graine: 1 },
    { type: 'taches', teinte: CYAN, taille: 0.12, pas: 0.62, graine: 2 },
    { type: 'taches', teinte: '#ffd23f', taille: 0.08, pas: 0.66, graine: 3 },
  ], '#2b2b33'),
  rickroll: sk('rickroll', 'Rickroll', 'rare', 'Jamais elle ne te lâchera. Jamais elle ne te décevra.', [
    { type: 'pixels', motif: 'note', teinte: 'contraste', taille: 0.03, pos: [0.2, 0.5, 0.8] },
    { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.06, zones: ['capot'] },
  ]),
  among: sk('among', 'Among', 'rare', 'Il y a un imposteur parmi les pilotes. C\'est celui qui freine.', [
    { type: 'bloc', teinte: '#9fe7ff', de: 0.45, a: 0.92, bas: 0.34, haut: 0.12 },
    { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.08 },
  ], '#c2272d'),
  n42: sk('n42', 'Réponse 42', 'rare', 'La réponse à la grande question sur la vie, l\'univers et le reste.', [
    { type: 'numero', chiffres: '42', fond: CRAIE, encre: NOIR },
    { type: 'grosNumero', chiffres: '42', teinte: 'contraste', zone: 'capot' },
  ]),
  dejavu: sk('dejavu', 'Déjà vu', 'rare', 'Le même virage, la même musique, les mêmes chevrons : tu l\'as déjà vécu.', [
    { type: 'chevrons', teinte: 'contraste', nombre: 3, zone: [0, 0.32] },
    { type: 'chevrons', teinte: 'contraste', nombre: 3, zone: [0.68, 1] },
    { type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.09 },
  ]),
  cartemere: sk('cartemere', 'Carte mère', 'rare', 'Des pistes de cuivre : elle démarre en une seconde, quand elle ne plante pas.', [
    { type: 'circuit', teinte: '#f3c94b', nombre: 16, graine: 4 },
    { type: 'basDeCaisse', teinte: '#0a3a26', hauteur: 0.07 },
  ], '#0f5a3a'),
  rallyesponsors: sk('rallyesponsors', 'Rallye sans logo', 'rare', 'Des cases prêtes pour les sponsors... qui n\'ont jamais répondu.', [
    { type: 'bloc', teinte: 'contraste', de: 0, a: 0.42, bas: 0.1, haut: 0.12 },
    { type: 'bloc', teinte: '#ffc61a', de: 0.48, a: 1, bas: 0.1, haut: 0.12 },
    { type: 'numero', chiffres: '9', fond: NOIR, encre: CRAIE, forme: 'carre', pos: 0.28 },
  ]),

  cousins: sk('cousins', 'Les cousins', 'rare', 'Orange, numéro 01, toit décoré : une bande de cousins, un klaxon, et des sauts de rivière.', [
    { type: 'numero', chiffres: '01', fond: CRAIE, encre: NOIR },
    { type: 'grosNumero', chiffres: '01', teinte: NOIR, zone: 'toit' },
    { type: 'bandes', teinte: NOIR, largeur: 0.1, ecart: 0.06, zones: ['capot'] },
  ], '#f28a12'),
  etoiles: sk('etoiles', 'Étoiles et rayures', 'rare', 'Un drapeau sur un V8 : les étoiles en haut, les rayures en bas, la puissance partout.', [
    { type: 'barres', teintes: [ROUGE, CRAIE, ROUGE, CRAIE, ROUGE], hauteur: 0.045, ecart: 0, bas: 0.16 },
    { type: 'formes', forme: 'etoile', teinte: '#ffffff', taille: 0.05, pas: 0.18, graine: 8 },
  ], '#1f3a8a'),

  // épiques
  toutvabien: sk('toutvabien', 'Tout va bien', 'epique', 'Le capot fume un peu, mais tout va bien. Tout va très bien.', [
    { type: 'flammes', teinte: '#e02a1a', coeur: '#ffd23f', nombre: 5 },
    { type: 'basDeCaisse', teinte: '#3b2a1a', hauteur: 0.06 },
  ], '#e58a2d'),
  kachow: sk('kachow', 'Kachow', 'epique', 'Rouge vif, éclairs jaunes, numéro 95 : Ka-chow !', [
    { type: 'eclairs', teinte: '#ffd23f', nombre: 2 },
    { type: 'numero', chiffres: '95', fond: CRAIE, encre: '#d4231d', pos: 0.5 },
    { type: 'grosNumero', chiffres: '95', teinte: CRAIE, zone: 'capot' },
  ], '#d4231d'),
  eurobeat: sk('eurobeat', 'Eurobeat', 'epique', 'Les basses montent avec le régime, les épingles descendent avec le ciel.', [
    { type: 'chevrons', teinte: '#ff3e9a', nombre: 5, zone: [0, 0.55] },
    { type: 'laterale', teinte: CYAN, bas: 0.06, haut: 0.1 },
    { type: 'capot', teinte: NOIR },
  ], '#f6f6f2'),
  codevert: sk('codevert', 'Code vert', 'epique', 'Il n\'y a pas de cuillère. Il y a une pédale de droite.', [
    { type: 'circuit', teinte: VERT, nombre: 26, graine: 11 },
    { type: 'basDeCaisse', teinte: VERT, hauteur: 0.03 },
  ], '#08110c'),

  rouille: sk('rouille', 'Après la fin du monde', 'epique', 'Rouillée, rafistolée, un V8 pour dernier espoir : la route est longue, l\'essence est rare.', [
    { type: 'taches', teinte: '#7a3b14', taille: 0.11, pas: 0.36, graine: 33 },
    { type: 'diagonales', teinte: '#a9adb3', nombre: 2, largeur: 0.08 },
    { type: 'basDeCaisse', teinte: '#4a2a12', hauteur: 0.1 },
  ], '#b8763a'),
  levant: sk('levant', 'Soleil levant', 'epique', 'Blanche, un grand disque rouge : la première voiture à voir le jour se lever sur le col.', [
    { type: 'formes', forme: 'rond', teinte: '#d6262b', taille: 0.18, nombre: 1, graine: 2 },
    { type: 'bandes', teinte: '#d6262b', largeur: 0.14, ecart: 0, zones: ['capot'] },
    { type: 'basDeCaisse', teinte: '#d6262b', hauteur: 0.04 },
  ], '#f4f1e8'),

  // légendaires
  delorean: sk('delorean', '88 miles/h', 'legendaire', 'Acier inox brossé : à 88 miles à l\'heure, le passé n\'a qu\'à bien se tenir.', [
    { type: 'barres', teintes: ['#8a919d', '#e2e7ef', '#8a919d', '#e2e7ef', '#8a919d', '#e2e7ef', '#8a919d'], hauteur: 0.022, ecart: 0.028, bas: 0.16 },
    { type: 'basDeCaisse', teinte: '#2a2c33', hauteur: 0.09 },
    { type: 'numero', chiffres: '88', fond: '#2a2c33', encre: '#e8edf5', pos: 0.5 },
  ], '#b7bdc6'),
  k2000: sk('k2000', 'K-2000', 'legendaire', 'Noire, intelligente, et un œil rouge qui va et vient sur le nez.', [
    { type: 'scanner', zone: 'nez', teintes: ['#5a0c0c', '#a01212', '#ff2a1a', '#ff9a8a', '#ff2a1a', '#a01212', '#5a0c0c'] },
    { type: 'laterale', teinte: '#3a3a46', bas: 0.06, haut: 0.09 },
    { type: 'basDeCaisse', teinte: '#2a2a32', hauteur: 0.08 },
  ], '#0e0e12'),
  grilleneon: sk('grilleneon', 'Grille néon', 'legendaire', 'Un monde en lignes de lumière : la moto en moins, le style en plus.', [
    { type: 'grille', teinte: CYAN, pas: 0.13, epaisseur: 0.012 },
    { type: 'basDeCaisse', teinte: CYAN, hauteur: 0.03 },
  ], '#07070d'),
  voielactee: sk('voielactee', 'Voie lactée', 'legendaire', 'Un ciel de nuit à emporter : zéro pollution lumineuse.', [
    { type: 'taches', teinte: '#3b3390', taille: 0.13, pas: 0.5, graine: 5 },
    { type: 'formes', forme: 'etoile', teinte: '#ffe9a6', taille: 0.032, pas: 0.16, graine: 12 },
    { type: 'formes', forme: 'etoile', teinte: '#ffffff', taille: 0.05, pas: 0.42, graine: 13 },
  ], '#141a44'),

  // exotiques : hommages aux voitures de la saga (couleurs imposées)
  dixsec: sk('dixsec', 'Dix secondes', 'exotique', '« Je te dois une voiture de dix secondes. » Orange vif, griffe noire : la légende des rues.', [
    { type: 'tribal', teinte: '#111116', variante: 1 },
    { type: 'bandes', teinte: '#111116', largeur: 0.16, ecart: 0, zones: ['capot'] },
    { type: 'basDeCaisse', teinte: '#111116', hauteur: 0.05 },
  ], '#f28a12'),
  bleunitro: sk('bleunitro', 'Bleu nitro', 'exotique', 'Argent et bleu électrique : un coup de protoxyde, et la ville est à toi.', [
    { type: 'flammes', teinte: '#1f5cff', coeur: '#8fbcff', nombre: 3 },
    { type: 'bandes', teinte: '#1f5cff', largeur: 0.1, ecart: 0.06 },
    { type: 'basDeCaisse', teinte: '#1f5cff', hauteur: 0.045 },
  ], '#c5cad3'),
  maitredrift: sk('maitredrift', 'Maître du drift', 'exotique', 'Orange dessus, noir dessous : pour glisser dans l\'épingle sans lâcher un sourire.', [
    { type: 'capot', teinte: '#111116' },
    { type: 'toit', teinte: '#111116' },
    { type: 'basDeCaisse', teinte: '#111116', hauteur: 0.16 },
    { type: 'dents', teinte: '#111116', hauteur: 0.1, pas: 0.13 },
  ], '#ff7a1a'),
  famille: sk('famille', 'Famille', 'exotique', '« Ce qui compte, c\'est la famille. » Noir mat, filets argent, et neuf cents chevaux dans le coffre.', [
    { type: 'laterale', teinte: '#c9ced6', bas: 0.07, haut: 0.11 },
    { type: 'bandes', teinte: '#c9ced6', largeur: 0.04, ecart: 0.1 },
    { type: 'basDeCaisse', teinte: '#4a4e5c', hauteur: 0.09 },
  ], '#15151a'),
};

/** Livrées à références de chaque voiture (identifiants de `BIBLIO`). */
const NOUVELLES: Record<CarId, string[]> = {
  equilibree: ['riviera', 'polka', 'kawaii', 'danger', 'huitbits', 'peinture', 'n404',
    'nyan', 'tigre', 'mystere', 'urgences', 'dejavu', 'n42',
    'toutvabien', 'eurobeat', 'codevert', 'delorean', 'voielactee', 'bleunitro', 'maitredrift'],
  legere: ['polka', 'zebre', 'neonbas', 'n1', 'vies', 'flammettes', 'rafistolee',
    'tofu', '24h', 'doge', 'banane', 'fantomes', 'meuh', 'stonks',
    'kachow', 'codevert', 'k2000', 'grilleneon'],
  turbo: ['riviera', 'kawaii', 'zebre', 'danger', 'flammettes', 'n404', 'vies',
    'leopard', 'champi', 'slime', 'eclaboussure', 'among', 'intercepteur', 'rallyesponsors',
    'eurobeat', 'toutvabien', 'grilleneon', 'voielactee', 'dixsec', 'famille'],
  kei: ['sakura', 'kawaii', 'polka', 'vies', 'flammettes', 'rafistolee',
    'meuh', 'champi', 'banane', 'cartemere', 'doge', 'among',
    'levant', 'kachow', 'eurobeat', 'codevert', 'toutvabien', 'grilleneon', 'voielactee', 'bleunitro'],
  muscle: ['riviera', 'danger', 'peinture', 'flammettes', 'n404', 'kawaii',
    'cousins', 'etoiles', 'tigre', 'intercepteur', 'stonks',
    'rouille', 'toutvabien', 'k2000', 'dixsec', 'famille'],
  rotative: ['neonbas', 'zebre', 'huitbits', 'sakura', 'flammettes', 'n1',
    '24h', 'dejavu', 'cartemere', 'tofu', 'nyan',
    'levant', 'eurobeat', 'codevert', 'grilleneon', 'voielactee', 'maitredrift'],
  break: ['riviera', 'polka', 'peinture', 'zebre', 'n1', 'sakura',
    'mystere', 'fantomes', 'tofu', 'urgences', 'n42',
    'rouille', 'toutvabien', 'eurobeat', 'codevert', 'delorean', 'voielactee', 'famille'],
};

const RANG = (r: Rarete): number => RARETE_IDS.indexOf(r);

/** Livrées de chaque voiture : « unie » d'abord, puis les d'origine et celles à références, rangées par rareté croissante (ordre d'écriture conservé à rareté égale). */
export const SKINS: Record<CarId, SkinDef[]> = Object.fromEntries(CAR_IDS.map((car) => {
  const liste = [...BASE[car].slice(1), ...NOUVELLES[car].map((id) => BIBLIO[id])].sort((a, b) => RANG(a.rarete) - RANG(b.rarete));
  return [car, [UNIE, ...liste]];
})) as Record<CarId, SkinDef[]>;

export type SkinsChoisies = Partial<Record<CarId, SkinId>>;

export const skinsDe = (car: CarId): SkinDef[] => SKINS[car];

export const skinValide = (car: CarId, id: unknown): id is SkinId => typeof id === 'string' && SKINS[car].some((s) => s.id === id);

/** Livrée mémorisée pour `car` ; « unie » si absente ou inconnue. */
export function skinChoisie(skins: SkinsChoisies | undefined, car: CarId): SkinId {
  const id = skins?.[car];
  return skinValide(car, id) ? id : SKIN_DEFAUT;
}

/** Définition de la livrée `id` de `car` ; « unie » si inconnue. */
export function skinDef(car: CarId, id: SkinId | undefined): SkinDef {
  return SKINS[car].find((s) => s.id === id) ?? SKINS[car][0];
}

/** Nouvelle table de choix où `car` prend la livrée `id` (inconnue → « unie ») ; les autres voitures gardent la leur. */
export function choisirSkin(skins: SkinsChoisies | undefined, car: CarId, id: SkinId): SkinsChoisies {
  return { ...(skins ?? {}), [car]: skinValide(car, id) ? id : SKIN_DEFAUT };
}

/** Nettoie une valeur lue du stockage : ne garde que les voitures connues, livrée inconnue → « unie ». */
export function validerSkins(raw: unknown): SkinsChoisies {
  const out: SkinsChoisies = {};
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  for (const car of CAR_IDS) if (car in o) out[car] = skinValide(car, o[car]) ? (o[car] as SkinId) : SKIN_DEFAUT;
  return out;
}

const hexVersRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbVersHex = (c: [number, number, number]): string =>
  '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

/** Couleur (#rrggbb) d'une teinte pour la couleur principale `principale` (#rrggbb). */
export function resoudreTeinte(t: Teinte, principale: string): string {
  if (t.startsWith('#')) return t;
  const [r, g, b] = hexVersRgb(/^#[0-9a-f]{6}$/i.test(principale) ? principale : '#e63b2e');
  switch (t) {
    case 'sombre': return rgbVersHex([r * 0.35, g * 0.35, b * 0.35]);
    case 'clair': return rgbVersHex([r + (255 - r) * 0.6, g + (255 - g) * 0.6, b + (255 - b) * 0.6]);
    case 'contraste': return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#1d1d24' : '#f4f1e8';
    default: return rgbVersHex([r, g, b]);
  }
}

/** Couleur de carrosserie réellement affichée : la couleur imposée de la livrée, sinon celle choisie au Garage. */
export const couleurEffective = (skin: SkinDef | null | undefined, choisie: string): string => skin?.couleurForcee ?? choisie;

/** Teinte « vedette » d'un élément (première teinte, ou fond du numéro). */
function teinteVedette(e: SkinElement): Teinte {
  switch (e.type) {
    case 'numero': return e.fond;
    case 'camouflage': case 'degrade': case 'barres': case 'bandesMulti': case 'scanner': return e.teintes[0] ?? 'principale';
    case 'flammes': return e.coeur;
    default: return e.teinte;
  }
}

/** Couleur d'accent d'une livrée (pastille d'aperçu du Garage) : teinte du premier élément, ou la couleur principale si unie. */
export function accentSkin(skin: SkinDef, principale: string): string {
  const base = couleurEffective(skin, principale);
  const e = skin.elements[0];
  return e ? resoudreTeinte(teinteVedette(e), base) : base;
}
