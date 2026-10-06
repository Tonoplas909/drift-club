/**
 * Atelier : livrées créées par les joueurs. Une livrée de l'Atelier est un assemblage des éléments existants
 * (`SkinElement`, rendus par src/render/skins.ts) : aucun dessin libre, aucune image importée. Ce module décrit les
 * motifs proposés à l'éditeur (réglages, bornes, valeurs par défaut) et valide strictement une livrée reçue
 * (éditeur, serveur) : seuls les réglages connus, dans leurs bornes, sont gardés.
 */
import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import { RARETE_IDS, type Rarete } from './raretes';
import type { SkinDef, SkinElement, Teinte } from './skins';

/** Préfixe des identifiants des livrées de l'Atelier (jamais utilisé par les livrées du jeu). */
export const PREFIXE_ATELIER = 'atelier-';

export const LIMITES_ATELIER = { elementsMax: 10, nomMax: 24, descriptionMax: 90, teintesMax: 6 } as const;

/** Teintes relatives à la couleur choisie au Garage (voir `Teinte`). */
export const TEINTES_RELATIVES = ['principale', 'contraste', 'sombre', 'clair'] as const;

export type Reglage =
  | { sorte: 'teinte'; nom: string; optionnel?: boolean }
  | { sorte: 'teintes'; nom: string; min: number; max: number }
  | { sorte: 'nombre'; nom: string; min: number; max: number; pas: number }
  | { sorte: 'choix'; nom: string; options: readonly (readonly [string | number, string])[] }
  | { sorte: 'chiffres'; nom: string; max: number }
  | { sorte: 'positions'; nom: string; min: number; max: number }
  | { sorte: 'intervalle'; nom: string };

export interface Motif {
  type: SkinElement['type'];
  nom: string;
  /** élément ajouté par le bouton « Ajouter » */
  defaut: SkinElement;
  reglages: Record<string, Reglage>;
}

const t = (nom = 'Couleur'): Reglage => ({ sorte: 'teinte', nom });
const n = (nom: string, min: number, max: number, pas: number): Reglage => ({ sorte: 'nombre', nom, min, max, pas });
const graine: Reglage = n('Variante', 1, 99, 1);

/** Motifs de l'éditeur, dans l'ordre du menu « Ajouter un motif ». */
export const MOTIFS: Motif[] = [
  { type: 'bandes', nom: 'Bandes capot-toit', defaut: { type: 'bandes', teinte: 'contraste', largeur: 0.14, ecart: 0.08 },
    reglages: { teinte: t(), largeur: n('Largeur', 0.04, 0.3, 0.01), ecart: n('Écart', 0, 0.2, 0.01) } },
  { type: 'bandesMulti', nom: 'Bandes multicolores', defaut: { type: 'bandesMulti', teintes: ['#1f4fb5', '#f4f1e8', '#d6262b'], largeur: 0.07, ecart: 0 },
    reglages: { teintes: { sorte: 'teintes', nom: 'Couleurs', min: 2, max: 5 }, largeur: n('Largeur', 0.03, 0.15, 0.01), ecart: n('Écart', 0, 0.08, 0.01) } },
  { type: 'toit', nom: 'Toit', defaut: { type: 'toit', teinte: 'contraste' }, reglages: { teinte: t() } },
  { type: 'capot', nom: 'Capot', defaut: { type: 'capot', teinte: '#26282e' }, reglages: { teinte: t() } },
  { type: 'basDeCaisse', nom: 'Bas de caisse', defaut: { type: 'basDeCaisse', teinte: 'sombre', hauteur: 0.1 },
    reglages: { teinte: t(), hauteur: n('Hauteur', 0.02, 0.2, 0.01) } },
  { type: 'laterale', nom: 'Bande latérale', defaut: { type: 'laterale', teinte: 'contraste', bas: 0.07, haut: 0.12 },
    reglages: { teinte: t(), bas: n('Bord bas', 0.03, 0.25, 0.01), haut: n('Bord haut', 0.05, 0.3, 0.01) } },
  { type: 'portieres', nom: 'Portières', defaut: { type: 'portieres', teinte: 'contraste', bas: 0.09, haut: 0.12 },
    reglages: { teinte: t(), bas: n('Marge basse', 0.03, 0.2, 0.01), haut: n('Marge haute', 0.05, 0.25, 0.01) } },
  { type: 'bloc', nom: 'Bloc de couleur', defaut: { type: 'bloc', teinte: 'contraste', de: 0.2, a: 0.8, bas: 0.12, haut: 0.15 },
    reglages: { teinte: t(), de: n('Début', 0, 0.9, 0.02), a: n('Fin', 0.1, 1, 0.02), bas: n('Marge basse', 0.05, 0.35, 0.01), haut: n('Marge haute', 0.05, 0.35, 0.01) } },
  { type: 'numero', nom: 'Numéro de course', defaut: { type: 'numero', chiffres: '7', fond: '#f4f1e8', encre: '#1d1d24' },
    reglages: { chiffres: { sorte: 'chiffres', nom: 'Numéro', max: 3 }, fond: t('Fond'), encre: t('Chiffres'), pos: n('Place', 0.2, 0.8, 0.02),
      forme: { sorte: 'choix', nom: 'Forme', options: [['rond', 'Rond'], ['carre', 'Carré']] } } },
  { type: 'grosNumero', nom: 'Gros numéro (capot, toit)', defaut: { type: 'grosNumero', chiffres: '1', teinte: 'contraste', zone: 'capot' },
    reglages: { chiffres: { sorte: 'chiffres', nom: 'Numéro', max: 2 }, teinte: t(), zone: { sorte: 'choix', nom: 'Où', options: [['capot', 'Capot'], ['toit', 'Toit']] } } },
  { type: 'damier', nom: 'Damier', defaut: { type: 'damier', teinte: 'contraste', zone: 'flanc', taille: 0.1 },
    reglages: { teinte: t(), zone: { sorte: 'choix', nom: 'Où', options: [['flanc', 'Flancs'], ['capot', 'Capot'], ['toit', 'Toit']] }, taille: n('Taille des cases', 0.05, 0.2, 0.01) } },
  { type: 'flammes', nom: 'Flammes', defaut: { type: 'flammes', teinte: '#e02a1a', coeur: '#ffd23f', nombre: 4 },
    reglages: { teinte: t('Bord'), coeur: t('Cœur'), nombre: n('Nombre', 2, 7, 1) } },
  { type: 'eclairs', nom: 'Éclairs', defaut: { type: 'eclairs', teinte: '#ffd23f', nombre: 2 }, reglages: { teinte: t(), nombre: n('Nombre', 1, 4, 1) } },
  { type: 'chevrons', nom: 'Chevrons', defaut: { type: 'chevrons', teinte: 'contraste', nombre: 4, zone: [0, 0.4] },
    reglages: { teinte: t(), nombre: n('Nombre', 2, 8, 1), zone: { sorte: 'intervalle', nom: 'Zone' } } },
  { type: 'diagonales', nom: 'Diagonales', defaut: { type: 'diagonales', teinte: 'contraste', nombre: 3, largeur: 0.09 },
    reglages: { teinte: t(), nombre: n('Nombre', 1, 7, 1), largeur: n('Largeur', 0.03, 0.2, 0.01), pente: n('Pente', -3, 3, 0.1) } },
  { type: 'pois', nom: 'Pois', defaut: { type: 'pois', teinte: 'contraste', rayon: 0.05, pas: 0.2 },
    reglages: { teinte: t(), rayon: n('Taille', 0.02, 0.1, 0.005), pas: n('Espacement', 0.08, 0.4, 0.01) } },
  { type: 'formes', nom: 'Formes', defaut: { type: 'formes', forme: 'etoile', teinte: 'contraste', taille: 0.1, pas: 0.3, graine: 1 },
    reglages: { forme: { sorte: 'choix', nom: 'Forme', options: [['etoile', 'Étoile'], ['coeur', 'Cœur'], ['fleur', 'Fleur'], ['losange', 'Losange'], ['rond', 'Rond'], ['croix', 'Croix'], ['fleche', 'Flèche'], ['patte', 'Patte']] },
      teinte: t(), taille: n('Taille', 0.03, 0.28, 0.01), pas: n('Espacement', 0.15, 0.6, 0.01), graine } },
  { type: 'pixels', nom: 'Motif 8 bits', defaut: { type: 'pixels', motif: 'invader', teinte: 'contraste', taille: 0.035, pos: [0.5] },
    reglages: { motif: { sorte: 'choix', nom: 'Motif', options: [['invader', 'Envahisseur'], ['coeur', 'Cœur'], ['fantome', 'Fantôme'], ['crane', 'Crâne'], ['note', 'Note']] },
      teinte: t(), taille: n('Taille', 0.02, 0.05, 0.005), pos: { sorte: 'positions', nom: 'Places', min: 1, max: 3 } } },
  { type: 'taches', nom: 'Taches', defaut: { type: 'taches', teinte: '#1d1d24', taille: 0.08, pas: 0.3, graine: 1 },
    reglages: { teinte: t(), taille: n('Taille', 0.02, 0.15, 0.005), pas: n('Espacement', 0.12, 0.6, 0.01), graine } },
  { type: 'camouflage', nom: 'Camouflage', defaut: { type: 'camouflage', teintes: ['sombre', 'clair'], graine: 1, case: 0.13 },
    reglages: { teintes: { sorte: 'teintes', nom: 'Couleurs', min: 1, max: 3 }, case: n('Taille', 0.06, 0.25, 0.01), graine } },
  { type: 'zebrures', nom: 'Zébrures', defaut: { type: 'zebrures', teinte: 'contraste', pas: 0.22, largeur: 0.08, pente: 3 },
    reglages: { teinte: t(), pas: n('Espacement', 0.12, 0.4, 0.01), largeur: n('Épaisseur', 0.03, 0.15, 0.01), pente: n('Pente', -4, 4, 0.1) } },
  { type: 'tigre', nom: 'Rayures de tigre', defaut: { type: 'tigre', teinte: '#1d1d24', pas: 0.2, graine: 1 },
    reglages: { teinte: t(), pas: n('Espacement', 0.12, 0.4, 0.01), graine } },
  { type: 'gouttes', nom: 'Coulures', defaut: { type: 'gouttes', teinte: 'contraste', nombre: 8, graine: 1 },
    reglages: { teinte: t(), nombre: n('Nombre', 3, 12, 1), graine } },
  { type: 'barres', nom: 'Barres horizontales', defaut: { type: 'barres', teintes: ['#ff3b30', '#ff9f0a', '#ffe14a'], hauteur: 0.03, ecart: 0, bas: 0.15 },
    reglages: { teintes: { sorte: 'teintes', nom: 'Couleurs', min: 1, max: 6 }, hauteur: n('Épaisseur', 0.015, 0.08, 0.005), ecart: n('Écart', 0, 0.05, 0.005), bas: n('Hauteur', 0.05, 0.3, 0.01) } },
  { type: 'degrade', nom: 'Traînées de vitesse', defaut: { type: 'degrade', teintes: ['sombre', 'clair', 'contraste'], hauteur: 0.06, ecart: 0.03 },
    reglages: { teintes: { sorte: 'teintes', nom: 'Couleurs', min: 1, max: 4 }, hauteur: n('Épaisseur', 0.03, 0.09, 0.005), ecart: n('Écart', 0.01, 0.06, 0.005) } },
  { type: 'dents', nom: 'Dents de scie', defaut: { type: 'dents', teinte: 'contraste', hauteur: 0.12, pas: 0.2 },
    reglages: { teinte: t(), hauteur: n('Hauteur', 0.05, 0.22, 0.01), pas: n('Largeur', 0.08, 0.35, 0.01) } },
  { type: 'hachures', nom: 'Hachures', defaut: { type: 'hachures', teinte: '#1d1d24', bas: 0.1, haut: 0.23, largeur: 0.055, pas: 0.13 },
    reglages: { teinte: t(), bas: n('Bas', 0.02, 0.3, 0.01), haut: n('Haut', 0.08, 0.35, 0.01), largeur: n('Épaisseur', 0.02, 0.1, 0.005), pas: n('Espacement', 0.06, 0.25, 0.01) } },
  { type: 'circuit', nom: 'Circuit imprimé', defaut: { type: 'circuit', teinte: '#2ee06a', nombre: 18, graine: 1 },
    reglages: { teinte: t(), nombre: n('Pistes', 6, 28, 1), graine } },
  { type: 'grille', nom: 'Grille', defaut: { type: 'grille', teinte: '#28e6ff', pas: 0.13, epaisseur: 0.012 },
    reglages: { teinte: t(), pas: n('Espacement', 0.06, 0.3, 0.01), epaisseur: n('Épaisseur', 0.006, 0.03, 0.002) } },
  { type: 'tribal', nom: 'Griffe', defaut: { type: 'tribal', teinte: '#111116', variante: 1 },
    reglages: { teinte: t(), variante: { sorte: 'choix', nom: 'Sens', options: [[1, 'Vers l\'arrière'], [2, 'Vers l\'avant']] } } },
];

const PAR_TYPE = new Map(MOTIFS.map((m) => [m.type, m]));
export const motifDe = (type: string): Motif | undefined => PAR_TYPE.get(type as SkinElement['type']);

/** Livrée proposée (sans identifiant ni rareté : c'est la validation qui les donne). */
export interface LivreeAtelier {
  voiture: CarId;
  nom: string;
  description: string;
  /** couleur de carrosserie imposée (#rrggbb), sinon celle du joueur */
  couleurForcee?: string;
  elements: SkinElement[];
}

const HEX = /^#[0-9a-f]{6}$/i;
const estTeinte = (v: unknown): v is Teinte => typeof v === 'string' && ((TEINTES_RELATIVES as readonly string[]).includes(v) || HEX.test(v));
const borne = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const arrondi = (v: number, pas: number): number => Math.round(Math.round(v / pas) * pas * 1e6) / 1e6;

/** Texte affichable : lettres, chiffres, ponctuation courante, sans caractères de contrôle ; espaces normalisés. */
export function nettoyerTexte(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  if (s.length === 0 || s.length > max) return null;
  if (!/^[\p{L}\p{N} .,;:!?'’"«»()&+\-–—…/#°%*@~^_=]+$/u.test(s)) return null;
  return s;
}

/** Valide un réglage ; renvoie la valeur nettoyée, `undefined` si absent et facultatif, ou une erreur (chaîne). */
function validerReglage(r: Reglage, v: unknown): { ok: true; valeur: unknown } | { ok: false; erreur: string } {
  switch (r.sorte) {
    case 'teinte':
      if (v === undefined && r.optionnel) return { ok: true, valeur: undefined };
      return estTeinte(v) ? { ok: true, valeur: v } : { ok: false, erreur: `${r.nom} : couleur invalide.` };
    case 'teintes':
      if (!Array.isArray(v) || v.length < r.min || v.length > r.max || !v.every(estTeinte)) return { ok: false, erreur: `${r.nom} : ${r.min} à ${r.max} couleurs.` };
      return { ok: true, valeur: [...v] };
    case 'nombre':
      if (typeof v !== 'number' || !Number.isFinite(v)) return { ok: false, erreur: `${r.nom} : nombre attendu.` };
      return { ok: true, valeur: arrondi(borne(v, r.min, r.max), r.pas) };
    case 'choix': {
      const o = r.options.find(([val]) => val === v);
      return o ? { ok: true, valeur: o[0] } : { ok: false, erreur: `${r.nom} : choix inconnu.` };
    }
    case 'chiffres':
      return typeof v === 'string' && new RegExp(`^[0-9]{1,${r.max}}$`).test(v) ? { ok: true, valeur: v } : { ok: false, erreur: `${r.nom} : 1 à ${r.max} chiffres.` };
    case 'positions':
      if (!Array.isArray(v) || v.length < r.min || v.length > r.max || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) return { ok: false, erreur: `${r.nom} : ${r.min} à ${r.max} places.` };
      return { ok: true, valeur: v.map((x: number) => arrondi(borne(x, 0.1, 0.9), 0.01)) };
    case 'intervalle': {
      if (!Array.isArray(v) || v.length !== 2 || !v.every((x) => typeof x === 'number' && Number.isFinite(x))) return { ok: false, erreur: `${r.nom} : début et fin attendus.` };
      const a = arrondi(borne(Math.min(v[0], v[1]), 0, 0.95), 0.01), b = arrondi(borne(Math.max(v[0], v[1]), a + 0.05, 1), 0.01);
      return { ok: true, valeur: [a, b] };
    }
  }
}

/** Élément nettoyé (seuls les réglages connus sont gardés), ou la liste des erreurs. */
export function validerElement(raw: unknown): { ok: true; element: SkinElement } | { ok: false; erreurs: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, erreurs: ['Motif invalide.'] };
  const o = raw as Record<string, unknown>;
  const motif = typeof o.type === 'string' ? motifDe(o.type) : undefined;
  if (!motif) return { ok: false, erreurs: ['Motif inconnu.'] };
  const el: Record<string, unknown> = { type: motif.type };
  const erreurs: string[] = [];
  for (const [cle, r] of Object.entries(motif.reglages)) {
    // réglage facultatif absent (place du numéro, forme, pente…) : valeur par défaut du rendu
    if (o[cle] === undefined && (r.sorte !== 'teinte' || r.optionnel) && !(cle in (motif.defaut as object))) continue;
    const v = validerReglage(r, o[cle] === undefined ? (motif.defaut as unknown as Record<string, unknown>)[cle] : o[cle]);
    if (!v.ok) erreurs.push(`${motif.nom} — ${v.erreur}`);
    else if (v.valeur !== undefined) el[cle] = v.valeur;
  }
  return erreurs.length ? { ok: false, erreurs } : { ok: true, element: el as unknown as SkinElement };
}

/** Valide une livrée proposée (éditeur, ou reçue du serveur). */
export function validerLivree(raw: unknown): { ok: true; livree: LivreeAtelier } | { ok: false; erreurs: string[] } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, erreurs: ['Livrée invalide.'] };
  const o = raw as Record<string, unknown>;
  const erreurs: string[] = [];
  const voiture = o.voiture as CarId;
  if (!CAR_IDS.includes(voiture)) erreurs.push('Voiture inconnue.');
  const nom = nettoyerTexte(o.nom, LIMITES_ATELIER.nomMax);
  if (!nom) erreurs.push(`Nom : 1 à ${LIMITES_ATELIER.nomMax} caractères (lettres, chiffres, ponctuation simple).`);
  const description = nettoyerTexte(o.description, LIMITES_ATELIER.descriptionMax);
  if (!description) erreurs.push(`Description : 1 à ${LIMITES_ATELIER.descriptionMax} caractères (lettres, chiffres, ponctuation simple).`);
  let couleurForcee: string | undefined;
  if (o.couleurForcee !== undefined && o.couleurForcee !== null) {
    if (typeof o.couleurForcee === 'string' && HEX.test(o.couleurForcee)) couleurForcee = o.couleurForcee.toLowerCase();
    else erreurs.push('Couleur de carrosserie invalide.');
  }
  const elements: SkinElement[] = [];
  if (!Array.isArray(o.elements) || o.elements.length === 0) erreurs.push('Ajoute au moins un motif.');
  else if (o.elements.length > LIMITES_ATELIER.elementsMax) erreurs.push(`${LIMITES_ATELIER.elementsMax} motifs au maximum.`);
  else for (const e of o.elements) {
    const v = validerElement(e);
    if (v.ok) elements.push(v.element); else erreurs.push(...v.erreurs);
  }
  if (erreurs.length) return { ok: false, erreurs };
  return { ok: true, livree: { voiture, nom: nom!, description: description!, ...(couleurForcee ? { couleurForcee } : {}), elements } };
}

/** Identifiant de livrée d'une proposition validée (à partir de son identifiant serveur). */
export function idAtelier(idServeur: string): string {
  return PREFIXE_ATELIER + idServeur.replace(/[^0-9a-f]/gi, '').slice(0, 12).toLowerCase();
}

export const estIdAtelier = (id: string): boolean => id.startsWith(PREFIXE_ATELIER);

/** Livrée officielle de l'Atelier, telle que la renvoie le serveur une fois validée. */
export interface LivreeOfficielle { idServeur: string; rarete: Rarete; pseudo: string; livree: LivreeAtelier }

/** Définition de livrée (comme celles du jeu) d'une livrée validée ; le créateur est cité dans la description. */
export function defAtelier(o: LivreeOfficielle): SkinDef {
  const desc = `${o.livree.description} (création de ${o.pseudo})`;
  return {
    id: idAtelier(o.idServeur), nom: o.livree.nom, rarete: o.rarete, description: desc, elements: o.livree.elements,
    ...(o.livree.couleurForcee ? { couleurForcee: o.livree.couleurForcee } : {}),
  };
}

/** Lit une ligne du serveur (`livrees_officielles`) ; null si elle est invalide (jamais affichée). */
export function lireLivreeOfficielle(l: unknown): LivreeOfficielle | null {
  if (typeof l !== 'object' || l === null) return null;
  const o = l as Record<string, unknown>;
  if (typeof o.id !== 'string' || !RARETE_IDS.includes(o.rarete as Rarete)) return null;
  const d = typeof o.donnees === 'object' && o.donnees !== null ? (o.donnees as Record<string, unknown>) : {};
  const v = validerLivree({ ...d, voiture: o.voiture, nom: o.nom, description: o.description });
  if (!v.ok) return null;
  return { idServeur: o.id, rarete: o.rarete as Rarete, pseudo: typeof o.pseudo === 'string' && o.pseudo ? o.pseudo : '?', livree: v.livree };
}

/** Ligne au format du serveur (pour la garder sur l'appareil et la relire avec `lireLivreeOfficielle`). */
export function versLigneOfficielle(o: LivreeOfficielle): Record<string, unknown> {
  const { voiture, nom, description, couleurForcee, elements } = o.livree;
  return { id: o.idServeur, voiture, nom, description, rarete: o.rarete, pseudo: o.pseudo, donnees: { elements, ...(couleurForcee ? { couleurForcee } : {}) } };
}
