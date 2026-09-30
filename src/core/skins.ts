import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';

/** Identifiant d'une livrée, unique par voiture. « unie » = carrosserie sans décor (défaut). */
export type SkinId = string;
export const SKIN_DEFAUT: SkinId = 'unie';

/**
 * Couleur d'un élément de livrée, dérivée de la couleur principale choisie au Garage :
 * - 'principale' : la couleur choisie ;
 * - 'contraste'  : blanc cassé si la couleur est sombre, presque noir si elle est claire (luminance > 0,6) ;
 * - 'sombre'     : la couleur choisie assombrie (× 0,35) ;
 * - 'clair'      : la couleur choisie éclaircie (60 % vers le blanc) ;
 * - '#rrggbb'    : couleur fixe, indépendante de la couleur choisie.
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
  /** Rond de portière + numéro de course (1 ou 2 chiffres) ; `pos` 0..1 = place entre les passages de roues. */
  | { type: 'numero'; chiffres: string; fond: Teinte; encre: Teinte; pos?: number }
  /** Rafale de chevrons inclinés sur le flanc ; `zone` = fraction [début, fin] entre les passages de roues. */
  | { type: 'chevrons'; teinte: Teinte; nombre: number; zone: [number, number] };

export interface SkinDef { id: SkinId; nom: string; elements: SkinElement[] }

const UNIE: SkinDef = { id: SKIN_DEFAUT, nom: 'Unie', elements: [] };

/**
 * Livrées de chaque voiture. Ajouter une livrée = ajouter une entrée ici (id unique, nom français,
 * liste d'éléments) ; aucun autre code à toucher. La première doit rester « unie ».
 */
export const SKINS: Record<CarId, SkinDef[]> = {
  equilibree: [
    UNIE,
    { id: 'rayures', nom: 'Double bande', elements: [{ type: 'bandes', teinte: 'contraste', largeur: 0.16, ecart: 0.08 }] },
    { id: 'bicolore', nom: 'Bicolore', elements: [{ type: 'toit', teinte: 'contraste' }, { type: 'basDeCaisse', teinte: 'contraste', hauteur: 0.13 }] },
    { id: 'course', nom: 'Course n°27', elements: [
      { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.13 },
      { type: 'numero', chiffres: '27', fond: '#f4f1e8', encre: '#1d1d24' },
    ] },
    { id: 'touge', nom: 'Touge', elements: [
      { type: 'toit', teinte: 'sombre' },
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'contraste', nombre: 4, zone: [0, 0.4] },
      { type: 'numero', chiffres: '5', fond: '#f4f1e8', encre: '#1d1d24', pos: 0.7 },
    ] },
    { id: 'carbone', nom: 'Capot carbone', elements: [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }] },
  ],
  legere: [
    UNIE,
    { id: 'bande', nom: 'Bande unique', elements: [{ type: 'bandes', teinte: 'contraste', largeur: 0.22, ecart: 0 }] },
    { id: 'bicolore', nom: 'Bas de caisse', elements: [{ type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.15 }, { type: 'laterale', teinte: 'sombre', bas: 0.06, haut: 0.1 }] },
    { id: 'course', nom: 'Course n°13', elements: [{ type: 'numero', chiffres: '13', fond: '#f4f1e8', encre: '#1d1d24' }, { type: 'bandes', teinte: 'contraste', largeur: 0.1, ecart: 0.06, zones: ['capot'] }] },
    { id: 'touge', nom: 'Touge', elements: [
      { type: 'capot', teinte: '#1d1d24' },
      { type: 'laterale', teinte: 'contraste', bas: 0.08, haut: 0.13 },
      { type: 'chevrons', teinte: 'contraste', nombre: 3, zone: [0, 0.35] },
    ] },
  ],
  turbo: [
    UNIE,
    { id: 'rayures', nom: 'Double bande', elements: [{ type: 'bandes', teinte: 'contraste', largeur: 0.18, ecart: 0.1 }] },
    { id: 'carbone', nom: 'Carbone', elements: [{ type: 'capot', teinte: '#26282e' }, { type: 'toit', teinte: '#26282e' }, { type: 'basDeCaisse', teinte: '#26282e', hauteur: 0.13 }] },
    { id: 'course', nom: 'Course n°7', elements: [
      { type: 'toit', teinte: 'contraste' },
      { type: 'numero', chiffres: '7', fond: '#f4f1e8', encre: '#1d1d24', pos: 0.45 },
      { type: 'basDeCaisse', teinte: 'contraste', hauteur: 0.13 },
    ] },
    { id: 'touge', nom: 'Sponsor touge', elements: [
      { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
      { type: 'chevrons', teinte: 'clair', nombre: 5, zone: [0, 0.45] },
      { type: 'bandes', teinte: 'sombre', largeur: 0.3, ecart: 0, zones: ['capot'] },
    ] },
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

/** Couleur d'accent d'une livrée (pastille d'aperçu du Garage) : teinte du premier élément, ou la couleur principale si unie. */
export function accentSkin(skin: SkinDef, principale: string): string {
  const e = skin.elements[0];
  return e ? resoudreTeinte(e.type === 'numero' ? e.fond : e.teinte, principale) : principale;
}
