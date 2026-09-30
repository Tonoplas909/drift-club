import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import type { Rarete } from './raretes';

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
  /** `nombre` bandes obliques (≈ 50°) sur le flanc, larges de `largeur` m. */
  | { type: 'diagonales'; teinte: Teinte; nombre: number; largeur: number }
  /** Dents de scie (triangles pointes en haut) le long du bas de caisse. */
  | { type: 'dents'; teinte: Teinte; hauteur: number; pas: number }
  /** Portières d'une autre couleur (entre les passages de roues) ; `bas`/`haut` = marges sous le bas / sous le haut de caisse (m). */
  | { type: 'portieres'; teinte: Teinte; bas: number; haut: number }
  /** Barres dégradées de plus en plus courtes (traînées de vitesse) ; une teinte par barre. */
  | { type: 'degrade'; teintes: Teinte[]; hauteur: number; ecart: number };

export interface SkinDef {
  id: SkinId;
  nom: string;
  rarete: Rarete;
  /** #rrggbb : la carrosserie prend cette couleur quelle que soit celle choisie au Garage (or, chrome, noir mat…). */
  couleurForcee?: string;
  elements: SkinElement[];
}

const sk = (id: SkinId, nom: string, rarete: Rarete, elements: SkinElement[], couleurForcee?: string): SkinDef =>
  couleurForcee ? { id, nom, rarete, couleurForcee, elements } : { id, nom, rarete, elements };

const UNIE: SkinDef = { id: SKIN_DEFAUT, nom: 'Unie', rarete: 'commune', elements: [] };

const OR = '#d9a21b';
const NOIR = '#1d1d24';
const CRAIE = '#f4f1e8';

/**
 * Livrées de chaque voiture (unie + 15, rangées par rareté). Ajouter une livrée = ajouter une entrée ici (id unique,
 * nom français, rareté, éléments) ; aucun autre code à toucher : elle entre automatiquement dans les caisses.
 * La première doit rester « unie ».
 */
export const SKINS: Record<CarId, SkinDef[]> = {
  equilibree: [
    UNIE,
    sk('rayures', 'Double bande', 'commune', [{ type: 'bandes', teinte: 'contraste', largeur: 0.16, ecart: 0.08 }]),
    sk('bicolore', 'Bicolore', 'commune', [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'contraste', hauteur: 0.13 }]),
    sk('lisere', 'Liseré', 'commune', [{ type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.1 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.05 }]),
    sk('panda', 'Panda', 'commune', [{ type: 'portieres', teinte: 'contraste', bas: 0.09, haut: 0.12 }, { type: 'toit', teinte: 'contraste' }]),
    sk('diagonales', 'Diagonales', 'commune', [{ type: 'diagonales', teinte: 'contraste', nombre: 3, largeur: 0.09 }]),
    sk('course', 'Course n°27', 'rare', [
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.13 },
      { type: 'numero', chiffres: '27', fond: CRAIE, encre: NOIR },
    ]),
    sk('carbone', 'Capot carbone', 'rare', [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }]),
    sk('damier', 'Damier', 'rare', [{ type: 'damier', teinte: 'contraste', zone: 'flanc', taille: 0.09 }, { type: 'damier', teinte: 'contraste', zone: 'toit', taille: 0.14 }]),
    sk('pois', 'Pois', 'rare', [{ type: 'pois', teinte: 'contraste', rayon: 0.05, pas: 0.2 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.07 }]),
    sk('touge', 'Touge', 'epique', [
      { type: 'toit', teinte: 'sombre' },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'contraste', nombre: 4, zone: [0, 0.4] },
      { type: 'numero', chiffres: '5', fond: CRAIE, encre: NOIR, pos: 0.7 },
    ]),
    sk('vitesse', 'Vitesse', 'epique', [{ type: 'degrade', teintes: ['sombre', 'clair', 'contraste'], hauteur: 0.07, ecart: 0.035 }, { type: 'capot', teinte: 'sombre' }]),
    sk('camo', 'Camouflage', 'epique', [{ type: 'camouflage', teintes: ['sombre', 'clair'], graine: 27, case: 0.13 }]),
    sk('flammes', 'Flammes', 'legendaire', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 4 },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.06 },
    ]),
    sk('noiror', 'Noir et or', 'legendaire', [
      { type: 'bandes', teinte: OR, largeur: 0.12, ecart: 0.07 },
      { type: 'laterale', teinte: OR, bas: 0.07, haut: 0.11 },
      { type: 'basDeCaisse', teinte: OR, hauteur: 0.05 },
    ], '#17171d'),
    sk('or', 'Or massif', 'exotique', [
      { type: 'laterale', teinte: 'clair', bas: 0.07, haut: 0.11 },
      { type: 'bandes', teinte: 'clair', largeur: 0.05, ecart: 0.1 },
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.1 },
    ], OR),
  ],
  legere: [
    UNIE,
    sk('bande', 'Bande unique', 'commune', [{ type: 'bandes', teinte: 'contraste', largeur: 0.22, ecart: 0 }]),
    sk('bicolore', 'Bas de caisse', 'commune', [{ type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.15 }, { type: 'laterale', teinte: 'sombre', bas: 0.06, haut: 0.1 }]),
    sk('filet', 'Filet', 'commune', [{ type: 'laterale', teinte: 'contraste', bas: 0.05, haut: 0.08 }, { type: 'toit', teinte: 'sombre' }]),
    sk('dents', 'Dents de scie', 'commune', [{ type: 'dents', teinte: 'contraste', hauteur: 0.14, pas: 0.17 }]),
    sk('portieres', 'Portières', 'commune', [{ type: 'portieres', teinte: 'sombre', bas: 0.1, haut: 0.1 }]),
    sk('course', 'Course n°13', 'rare', [
      { type: 'numero', chiffres: '13', fond: CRAIE, encre: NOIR },
      { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.06, zones: ['capot'] },
    ]),
    sk('taxi', 'Taxi', 'rare', [
      { type: 'damier', teinte: NOIR, zone: 'flanc', taille: 0.09 },
      { type: 'basDeCaisse', teinte: NOIR, hauteur: 0.06 },
    ], '#ffc61a'),
    sk('rallye', 'Rallye', 'rare', [
      { type: 'toit', teinte: 'contraste' },
      { type: 'diagonales', teinte: 'sombre', nombre: 2, largeur: 0.08 },
      { type: 'numero', chiffres: '3', fond: 'contraste', encre: 'sombre', forme: 'carre', pos: 0.4 },
    ]),
    sk('mat', 'Noir mat', 'rare', [
      { type: 'laterale', teinte: '#3a3d49', bas: 0.06, haut: 0.1 },
      { type: 'bandes', teinte: '#3a3d49', largeur: 0.1, ecart: 0.06, zones: ['capot', 'toit'] },
    ], '#20222a'),
    sk('touge', 'Touge', 'epique', [
      { type: 'capot', teinte: NOIR },
      { type: 'laterale', teinte: 'contraste', bas: 0.08, haut: 0.13 },
      { type: 'chevrons', teinte: 'contraste', nombre: 3, zone: [0, 0.35] },
    ]),
    sk('eclairs', 'Éclairs', 'epique', [{ type: 'eclairs', teinte: '#ffd23f', nombre: 3 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.07 }]),
    sk('degrade', 'Dégradé', 'epique', [{ type: 'degrade', teintes: ['sombre', 'clair', 'contraste', 'clair'], hauteur: 0.05, ecart: 0.03 }]),
    sk('flammes', 'Flammes bleues', 'legendaire', [{ type: 'flammes', teinte: 'contraste', coeur: '#19c8ff', nombre: 3 }]),
    sk('kamikaze', 'Kamikaze', 'legendaire', [
      { type: 'dents', teinte: 'contraste', hauteur: 0.22, pas: 0.32 },
      { type: 'bandes', teinte: 'contraste', largeur: 0.12, ecart: 0, zones: ['capot', 'toit'] },
      { type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.09 },
    ]),
    sk('chrome', 'Chrome', 'exotique', [
      { type: 'laterale', teinte: '#7f8da3', bas: 0.06, haut: 0.1 },
      { type: 'basDeCaisse', teinte: '#4a5568', hauteur: 0.1 },
      { type: 'bandes', teinte: '#eef4ff', largeur: 0.05, ecart: 0.1, zones: ['capot', 'toit'] },
    ], '#cfd6e0'),
  ],
  turbo: [
    UNIE,
    sk('rayures', 'Double bande', 'commune', [{ type: 'bandes', teinte: 'contraste', largeur: 0.18, ecart: 0.1 }]),
    sk('pois', 'Pois', 'commune', [{ type: 'pois', teinte: 'contraste', rayon: 0.045, pas: 0.19 }]),
    sk('diagonales', 'Diagonales', 'commune', [{ type: 'diagonales', teinte: 'clair', nombre: 2, largeur: 0.16 }]),
    sk('filet', 'Filet', 'commune', [{ type: 'laterale', teinte: 'contraste', bas: 0.06, haut: 0.09 }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.08 }]),
    sk('bicolore', 'Toit contrasté', 'commune', [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.1 }]),
    sk('carbone', 'Carbone', 'rare', [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }, { type: 'basDeCaisse', teinte: '#26282e', hauteur: 0.13 }]),
    sk('course', 'Course n°7', 'rare', [
      { type: 'toit', teinte: 'contraste' },
      { type: 'numero', chiffres: '7', fond: CRAIE, encre: NOIR, pos: 0.45 },
      { type: 'basDeCaisse', teinte: 'contraste', hauteur: 0.13 },
    ]),
    sk('damier', 'Damier', 'rare', [{ type: 'damier', teinte: 'contraste', zone: 'flanc', taille: 0.1 }, { type: 'damier', teinte: 'contraste', zone: 'capot', taille: 0.14 }]),
    sk('camo', 'Camouflage', 'rare', [{ type: 'camouflage', teintes: ['sombre', 'clair'], graine: 7, case: 0.14 }]),
    sk('touge', 'Sponsor touge', 'epique', [
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'clair', nombre: 5, zone: [0, 0.45] },
      { type: 'bandes', teinte: 'sombre', largeur: 0.3, ecart: 0, zones: ['capot'] },
    ]),
    sk('eclairs', 'Éclairs', 'epique', [{ type: 'eclairs', teinte: '#3ad6ff', nombre: 4 }, { type: 'laterale', teinte: 'sombre', bas: 0.06, haut: 0.09 }]),
    sk('vitesse', 'Vitesse', 'epique', [{ type: 'degrade', teintes: ['clair', 'contraste', 'sombre'], hauteur: 0.08, ecart: 0.04 }, { type: 'toit', teinte: 'sombre' }]),
    sk('flammes', 'Flammes', 'legendaire', [
      { type: 'flammes', teinte: 'contraste', coeur: '#ff8a1f', nombre: 4 },
      { type: 'capot', teinte: 'sombre' },
    ]),
    sk('noiror', 'Noir et or', 'legendaire', [
      { type: 'bandes', teinte: OR, largeur: 0.14, ecart: 0.08 },
      { type: 'laterale', teinte: OR, bas: 0.07, haut: 0.11 },
      { type: 'chevrons', teinte: OR, nombre: 4, zone: [0, 0.35] },
    ], '#14141a'),
    sk('or', 'Plaqué or', 'exotique', [
      { type: 'bandes', teinte: 'sombre', largeur: 0.16, ecart: 0.08 },
      { type: 'laterale', teinte: 'clair', bas: 0.07, haut: 0.1 },
      { type: 'toit', teinte: 'clair' },
    ], '#e3b02b'),
  ],
};

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
    case 'camouflage': case 'degrade': return e.teintes[0] ?? 'principale';
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
