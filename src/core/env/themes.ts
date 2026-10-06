import type { Environnement, TypeObjet } from '../level/types';
import type { DecorKind } from './types';
import type { OptionsTerrain } from './terrainRegles';

/**
 * Règles de placement d'un thème de décor (données pures, §5.5). `generateEnvironment` les lit sans rien
 * savoir des thèmes ; le rendu (couleurs, modèles) est dans `render/themes.ts`.
 */
export interface Essence {
  kind: DecorKind;
  /** poids près de l'altitude la plus basse de la route */
  bas: number;
  /** poids 60 m plus haut (interpolation lisse) */
  haut: number;
  /** [taille min, amplitude] : échelle = min + amplitude × tirage (défaut [0,8 ; 0,5]) */
  echelle?: [number, number];
}

export interface ObjetBord {
  kind: DecorKind;
  /** un candidat tous les `tousLes` m de route, de chaque côté */
  tousLes: number;
  /** distance à l'axe = largeur de la route + `decalage` (≥ 3 m : rien dans le couloir) */
  decalage: number;
  /** chance de poser l'objet à chaque candidat (0..1) */
  probabilite: number;
  /** cap : `libre` (défaut, aléatoire) ; `route` (axe z local le long de la route, +x vers l'extérieur) ; `routeSym` (idem, sens aléatoire) ; `travers` (axe z local perpendiculaire à la route, vers l'extérieur : torii qui s'ouvre sur un chemin) */
  orientation?: 'libre' | 'route' | 'routeSym' | 'travers';
  /** [taille min, amplitude] (défaut [0,8 ; 0,5]) */
  echelle?: [number, number];
}

/** Objet flottant au-dessus de la route et de ses abords (dalles lumineuses des backrooms) : visuel, sans collision, posé à l'altitude de la chaussée. */
export interface ObjetSuspendu {
  kind: DecorKind;
  /** un candidat tous les `tousLes` m de route */
  tousLes: number;
  probabilite: number;
  /** décalage latéral maximal (m) depuis l'axe, de chaque côté (la route comprise) */
  lateral: number;
  echelle?: [number, number];
}

/**
 * Objet semé sur le terrain loin de la route, par cases de `cellule` m (générateur aléatoire à part : n'influence pas le reste du décor).
 * Pour les rivages (pirate) : `rive` fait descendre le point tiré le long de la pente jusqu'à la laisse de mer.
 */
export interface RegleFond {
  kind: DecorKind;
  cellule: number;
  probabilite: number;
  /** distance à l'axe de la route (m) : entre `dMin` et `dMax` */
  dMin: number;
  dMax: number;
  /** pente maximale du terrain (dénivelé / m) et altitude minimale au-dessus du point le plus bas de la route (collines) */
  penteMax?: number;
  altitudeMin?: number;
  /** `libre` (défaut) ; `quart` (multiples de 90°, pièces alignées) ; `aval` (z local vers la mer, ponton) ; `rive` (parallèle au rivage, épave) */
  orientation?: 'libre' | 'quart' | 'aval' | 'rive';
  echelle?: [number, number];
  /** rivage : hauteur (m) au-dessus de la mer où se pose l'objet (min, max) et avance (m) vers la mer une fois trouvé */
  rive?: { min: number; max: number; avance?: number };
  /** altitude fixe au-dessus du niveau de la mer (ponton) ; sinon le terrain, moins `enfoncement` (défaut 0,3 m) */
  yMer?: number;
  enfoncement?: number;
}

/** Bâtiments alignés le long de la route (thème ville) : `generateEnvironment` les pose puis les rend solides. */
export interface RegleBatiments {
  /** distance libre (m) entre le bord de la route (largeur/2) et n'importe quel point d'un bâtiment (≥ 6 : place pour dériver) */
  recul: number;
  /** espace entre deux façades voisines : [min, amplitude] (m) */
  ecart: [number, number];
  /** probabilité de poser un bâtiment à chaque emplacement du 1er rang (proche) et du 2e rang (30 à 50 m) */
  rang1: number;
  rang2: number;
  /** tours de fond : une case tous les `cellule` m, entre 45 et 320 m de la route */
  fond: { cellule: number; probabilite: number };
  /**
   * Types de bâtiments de chaque rang, avec leur part (somme 1, tirés dans l'ordre). Défaut (ville) : immeubles au 1er rang,
   * 40 % de tours au 2e, 35 % au fond.
   */
  types?: TypesBatiments;
  /**
   * Bâtiments seulement dans les « quartiers » (bruit de grande échelle au-dessus de `seuil`) : villages du japon. Au-dessus
   * de `ville`, ce sont les types `typesVille` (centre-bourg) ; les quartiers ignorent le masque de forêt.
   */
  quartiers?: { echelle: number; seuil: number; ville: number; typesVille: TypesBatiments };
}

export type PartsBatiments = readonly (readonly [DecorKind, number])[];
export interface TypesBatiments { rang1: PartsBatiments; rang2: PartsBatiments; fond: PartsBatiments }

/**
 * Couloir (backrooms) : murs continus de chaque côté de la route, à `decalage` m du bord, ouverts par endroits sur des
 * passages latéraux (labyrinthe). Longueurs tirées entre [min, min + amplitude] m.
 */
export interface RegleCouloir {
  decalage: number;
  /** longueur d'un tronçon de mur (m) */
  pas: number;
  /** longueur des pans de mur pleins, des ouvertures, et des murs latéraux des passages */
  plein: [number, number];
  ouverture: [number, number];
  passage: [number, number];
}

export interface ThemeRegles {
  /** nom affiché (français) */
  nom: string;
  /** phrase pour l'éditeur */
  description: string;
  /** couleur du sol dans la vue de dessus de l'éditeur */
  fondEditeur: string;
  /** multiplicateur du relief du terrain (défaut 1 ; < 1 : plaine, pour un décor urbain) */
  relief?: number;
  /** mer et cratères (voir `terrainRegles.ts`) ; à passer à `Terrain` (`creerTerrain`) */
  terrain?: OptionsTerrain;
  arbres: {
    essences: Essence[];
    /** probabilité de base par case en forêt / hors forêt (avant densité) */
    pForet: number;
    pHors: number;
    /** seuil de forêt minimal (0..1) : au-dessus, les « forêts » (parcs en ville) sont plus rares quelle que soit la densité */
    seuilMin?: number;
  };
  rochers: {
    /** probabilité de base par case, puis bonus sur forte pente */
    base: number;
    pente: number;
    normal: DecorKind;
    haut: DecorKind;
    /** part de rochers « hauts » */
    partHauts: number;
    echelle: [number, number];
  };
  bord: {
    /** panneau à l'extérieur des virages serrés (null : aucun) */
    chevron: DecorKind | null;
    /** objet tous les ~25 m sur les deux bords (null : aucun) */
    borne: DecorKind | null;
    extras: ObjetBord[];
    /** les extras ne se posent pas sur un objet déjà placé (défaut : non, pour ne pas changer les décors existants) */
    sansChevauchement?: boolean;
    /** objets flottants au-dessus de la route (backrooms) */
    suspendus?: ObjetSuspendu[];
  };
  /** objets semés loin de la route (pagodes, pontons, murs des backrooms…) */
  fond?: RegleFond[];
  /** bâtiments (ville, japon, cyberpunk) ; absent : aucun */
  batiments?: RegleBatiments;
  /** couloir le long de la route (backrooms) */
  couloir?: RegleCouloir;
  /** décor correspondant aux objets posés à la main dans l'éditeur (« barriere » est toujours la glissière) */
  objets: Record<Exclude<TypeObjet, 'barriere'>, DecorKind>;
  /** noms français des objets de la palette de l'éditeur pour ce thème */
  nomsObjets: Partial<Record<TypeObjet, string>>;
}

export const THEMES: Record<Environnement, ThemeRegles> = {
  // Règles historiques : ne pas y toucher (le décor des niveaux existants en dépend, tests/core/env/montagne-regression.test.ts)
  montagne: {
    nom: 'Montagne',
    description: 'Sapins, feuillus et rochers verts.',
    fondEditeur: '#86c874',
    arbres: {
      essences: [{ kind: 'sapin', bas: 0.4, haut: 1 }, { kind: 'feuillu', bas: 0.6, haut: 0 }],
      pForet: 0.85, pHors: 0.08,
    },
    rochers: { base: 0.03, pente: 0.25, normal: 'rocher', haut: 'rocherHaut', partHauts: 0.2, echelle: [0.8, 0.5] },
    bord: { chevron: 'chevron', borne: 'borne', extras: [] },
    objets: { arbre: 'feuillu', sapin: 'sapin', rocher: 'rocher', pneus: 'pneus', panneau: 'panneau' },
    nomsObjets: {},
  },
  neige: {
    nom: 'Neige',
    description: 'Sapins enneigés, rochers gelés, congères et piquets de déneigement.',
    fondEditeur: '#e4edf6',
    arbres: {
      essences: [{ kind: 'sapin', bas: 0.75, haut: 1 }, { kind: 'feuillu', bas: 0.25, haut: 0 }],
      pForet: 0.85, pHors: 0.08,
    },
    rochers: { base: 0.03, pente: 0.28, normal: 'rocher', haut: 'rocherHaut', partHauts: 0.25, echelle: [0.8, 0.6] },
    bord: {
      chevron: 'chevron', borne: 'piquet',
      extras: [{ kind: 'tasNeige', tousLes: 9, decalage: 3.4, probabilite: 0.5 }],
    },
    objets: { arbre: 'feuillu', sapin: 'sapin', rocher: 'rocher', pneus: 'pneus', panneau: 'panneau' },
    nomsObjets: {},
  },
  desert: {
    nom: 'Canyon',
    description: 'Sable, mesas rouges, cactus et buissons secs.',
    fondEditeur: '#e6c98a',
    arbres: {
      essences: [
        { kind: 'cactus', bas: 0.45, haut: 0.2, echelle: [0.75, 0.6] },
        { kind: 'buisson', bas: 0.35, haut: 0.3, echelle: [0.8, 0.7] },
        { kind: 'arbreSec', bas: 0.2, haut: 0.5, echelle: [0.8, 0.5] },
      ],
      pForet: 0.32, pHors: 0.05,
    },
    rochers: { base: 0.04, pente: 0.3, normal: 'rocher', haut: 'mesa', partHauts: 0.3, echelle: [0.9, 0.7] },
    bord: {
      chevron: 'chevron', borne: 'borne',
      extras: [{ kind: 'buisson', tousLes: 16, decalage: 3.6, probabilite: 0.4 }],
    },
    objets: { arbre: 'arbreSec', sapin: 'cactus', rocher: 'rocher', pneus: 'pneus', panneau: 'panneau' },
    nomsObjets: { arbre: 'Arbre sec', sapin: 'Cactus' },
  },
  automne: {
    nom: 'Forêt d’automne',
    description: 'Feuillages roux, jaunes et rouges, sol de feuilles mortes.',
    fondEditeur: '#c4b061',
    arbres: {
      essences: [{ kind: 'feuillu', bas: 0.75, haut: 0.35 }, { kind: 'sapin', bas: 0.25, haut: 0.65 }],
      pForet: 0.88, pHors: 0.1,
    },
    rochers: { base: 0.02, pente: 0.22, normal: 'rocher', haut: 'rocherHaut', partHauts: 0.15, echelle: [0.8, 0.5] },
    bord: {
      chevron: 'chevron', borne: 'borne',
      extras: [{ kind: 'souche', tousLes: 22, decalage: 3.6, probabilite: 0.35 }],
    },
    objets: { arbre: 'feuillu', sapin: 'sapin', rocher: 'rocher', pneus: 'pneus', panneau: 'panneau' },
    nomsObjets: {},
  },
  ville: {
    nom: 'Ville',
    description: 'Immeubles en bordure de route, lampadaires, voitures garées, mobilier urbain et parcs.',
    fondEditeur: '#a3a29d',
    relief: 0.3,
    // parcs = zones de « forêt » (rares) plantées de feuillus ; pas de rochers
    arbres: { essences: [{ kind: 'feuillu', bas: 1, haut: 1, echelle: [0.65, 0.5] }], pForet: 0.4, pHors: 0, seuilMin: 0.66 },
    rochers: { base: 0, pente: 0, normal: 'blocBeton', haut: 'blocBeton', partHauts: 0, echelle: [1, 0] },
    bord: {
      chevron: 'chevron', borne: null, sansChevauchement: true,
      extras: [
        { kind: 'lampadaire', tousLes: 26, decalage: 3.2, probabilite: 0.9, orientation: 'route', echelle: [1, 0] },
        { kind: 'arbreVille', tousLes: 30, decalage: 3.7, probabilite: 0.45, echelle: [0.9, 0.3] },
        { kind: 'poubelle', tousLes: 45, decalage: 3.5, probabilite: 0.45, echelle: [1, 0] },
        { kind: 'plot', tousLes: 22, decalage: 3.4, probabilite: 0.3, echelle: [0.9, 0.3] },
        { kind: 'blocBeton', tousLes: 60, decalage: 3.5, probabilite: 0.35, orientation: 'routeSym', echelle: [1, 0] },
        { kind: 'arretBus', tousLes: 150, decalage: 3.8, probabilite: 0.85, orientation: 'route', echelle: [1, 0] },
        { kind: 'voiture', tousLes: 24, decalage: 3.4, probabilite: 0.45, orientation: 'routeSym', echelle: [1, 0] },
        { kind: 'grillage', tousLes: 12, decalage: 3.6, probabilite: 0.22, orientation: 'routeSym', echelle: [1, 0] },
      ],
    },
    batiments: { recul: 8, ecart: [2, 6], rang1: 0.85, rang2: 0.7, fond: { cellule: 46, probabilite: 0.5 } },
    objets: { arbre: 'arbreVille', sapin: 'lampadaire', rocher: 'blocBeton', pneus: 'pneus', panneau: 'panneau' },
    nomsObjets: { arbre: 'Arbre en bac', sapin: 'Lampadaire', rocher: 'Bloc béton' },
  },
  pirate: {
    nom: 'Côte des Pirates',
    description: 'Plages, dunes et mer turquoise, palmiers, pontons, tonneaux, canons, épaves et drapeaux à tête de mort.',
    fondEditeur: '#e8d29a',
    relief: 0.35,
    terrain: { mer: { decalage: -2.5, profondeur: 7, depart: 26, rampe: 70, seuil: [0.41, 0.53], echelle: 240, lointain: [200, 330] } },
    arbres: {
      essences: [
        { kind: 'palmier', bas: 0.75, haut: 0.35, echelle: [0.8, 0.5] },
        { kind: 'buisson', bas: 0.25, haut: 0.65, echelle: [0.8, 0.7] },
      ],
      pForet: 0.4, pHors: 0.06,
    },
    rochers: { base: 0.03, pente: 0.3, normal: 'rocher', haut: 'rocherHaut', partHauts: 0.2, echelle: [0.8, 0.6] },
    bord: {
      chevron: 'chevron', borne: 'borne', sansChevauchement: true,
      extras: [
        { kind: 'tonneau', tousLes: 30, decalage: 3.6, probabilite: 0.4 },
        { kind: 'caisse', tousLes: 40, decalage: 3.8, probabilite: 0.35 },
        { kind: 'drapeauPirate', tousLes: 70, decalage: 3.6, probabilite: 0.55, orientation: 'route', echelle: [0.95, 0.2] },
        { kind: 'canon', tousLes: 90, decalage: 4.2, probabilite: 0.4 },
        { kind: 'ancre', tousLes: 110, decalage: 4, probabilite: 0.4 },
        { kind: 'coffre', tousLes: 160, decalage: 4.4, probabilite: 0.45, orientation: 'route', echelle: [1, 0] },
        { kind: 'buisson', tousLes: 18, decalage: 3.6, probabilite: 0.25 },
      ],
    },
    fond: [
      { kind: 'epave', cellule: 150, probabilite: 0.85, dMin: 40, dMax: 300, orientation: 'rive', rive: { min: 0.3, max: 1.2 }, enfoncement: 0.5, echelle: [0.9, 0.3] },
      { kind: 'ponton', cellule: 120, probabilite: 0.75, dMin: 34, dMax: 260, orientation: 'aval', rive: { min: 0.3, max: 1, avance: 3.5 }, yMer: 0.6, echelle: [1, 0] },
    ],
    objets: { arbre: 'palmier', sapin: 'drapeauPirate', rocher: 'rocher', pneus: 'tonneau', panneau: 'caisse' },
    nomsObjets: { arbre: 'Palmier', sapin: 'Drapeau pirate', pneus: 'Tonneau', panneau: 'Caisse' },
  },
  backrooms: {
    nom: 'Backrooms',
    description: 'Couloirs sans fin sous un plafond bas : moquette humide, papier peint jaune, néons, ouvertures sur un labyrinthe de pièces vides.',
    fondEditeur: '#c9b84e',
    relief: 0.08,
    // quelques piliers égarés ; les pièces (murs, piliers) sont semées loin de la route
    arbres: { essences: [{ kind: 'pilier', bas: 1, haut: 1, echelle: [1, 0] }], pForet: 0.05, pHors: 0.01 },
    rochers: { base: 0.012, pente: 0, normal: 'carton', haut: 'porteBureau', partHauts: 0.15, echelle: [0.9, 0.3] },
    couloir: { decalage: 5.5, pas: 4, plein: [14, 30], ouverture: [7, 6], passage: [8, 10] },
    bord: {
      chevron: 'chevron', borne: null, sansChevauchement: true,
      extras: [
        { kind: 'carton', tousLes: 40, decalage: 3.6, probabilite: 0.3 },
        { kind: 'porteBureau', tousLes: 70, decalage: 4.2, probabilite: 0.25, orientation: 'travers', echelle: [1, 0] },
      ],
      // néons du plafond, dans le couloir et dans les pièces
      suspendus: [{ kind: 'dalleLumiere', tousLes: 9, probabilite: 0.9, lateral: 14 }],
    },
    fond: [
      { kind: 'mur', cellule: 18, probabilite: 0.6, dMin: 13, dMax: 100, orientation: 'quart', echelle: [1, 0] },
      { kind: 'pilier', cellule: 16, probabilite: 0.5, dMin: 13, dMax: 90, orientation: 'quart', echelle: [1, 0] },
    ],
    objets: { arbre: 'pilier', sapin: 'lampeBureau', rocher: 'mur', pneus: 'carton', panneau: 'porteBureau' },
    nomsObjets: { arbre: 'Pilier', sapin: 'Lampadaire néon', rocher: 'Cloison', pneus: 'Cartons', panneau: 'Porte' },
  },
  espace: {
    nom: 'Espace',
    description: 'Sol lunaire à cratères, ciel noir étoilé, cristaux lumineux, antennes, atterrisseurs et paraboles.',
    fondEditeur: '#7d7889',
    relief: 0.5,
    terrain: { cratere: { cellule: 120, probabilite: 0.7, rayon: [14, 26], creux: 0.24, eloignement: [32, 60] } },
    // pas de végétation : les « arbres » sont des amas de cristaux
    arbres: { essences: [{ kind: 'cristal', bas: 1, haut: 1, echelle: [0.8, 0.9] }], pForet: 0.1, pHors: 0.012 },
    rochers: { base: 0.07, pente: 0.3, normal: 'rocher', haut: 'rocherHaut', partHauts: 0.35, echelle: [0.9, 1.2] },
    bord: {
      chevron: 'chevron', borne: 'balise', sansChevauchement: true,
      extras: [
        { kind: 'bidon', tousLes: 60, decalage: 3.6, probabilite: 0.4 },
        { kind: 'parabole', tousLes: 90, decalage: 6, probabilite: 0.5 },
        { kind: 'antenne', tousLes: 140, decalage: 7, probabilite: 0.5 },
        { kind: 'rocher', tousLes: 30, decalage: 3.5, probabilite: 0.35, echelle: [0.4, 0.4] },
      ],
    },
    fond: [
      { kind: 'cristal', cellule: 34, probabilite: 0.35, dMin: 10, dMax: 160, echelle: [1, 1.8] },
      { kind: 'antenne', cellule: 110, probabilite: 0.45, dMin: 20, dMax: 300, penteMax: 0.35 },
      { kind: 'atterrisseur', cellule: 200, probabilite: 0.5, dMin: 35, dMax: 320, penteMax: 0.3, echelle: [1, 0.3] },
      { kind: 'parabole', cellule: 90, probabilite: 0.4, dMin: 20, dMax: 250, penteMax: 0.4 },
    ],
    objets: { arbre: 'cristal', sapin: 'antenne', rocher: 'rocher', pneus: 'bidon', panneau: 'balise' },
    nomsObjets: { arbre: 'Cristal', sapin: 'Antenne relais', pneus: 'Bidons', panneau: 'Balise' },
  },
  japon: {
    nom: 'Japon',
    description: 'Cerisiers en fleurs, villages de maisons traditionnelles, rues commerçantes, torii, lanternes de pierre, bambous, rizières et pagodes.',
    fondEditeur: '#f0c6d3',
    relief: 0.7,
    arbres: {
      essences: [
        { kind: 'cerisier', bas: 0.7, haut: 0.5, echelle: [0.8, 0.5] },
        { kind: 'bambou', bas: 0.12, haut: 0.25, echelle: [0.8, 0.5] },
        { kind: 'buisson', bas: 0.18, haut: 0.25, echelle: [0.8, 0.6] },
      ],
      pForet: 0.42, pHors: 0.06,
    },
    rochers: { base: 0.02, pente: 0.22, normal: 'rocher', haut: 'rocherHaut', partHauts: 0.15, echelle: [0.8, 0.5] },
    bord: {
      chevron: 'chevron', borne: 'borne', sansChevauchement: true,
      extras: [
        { kind: 'toro', tousLes: 20, decalage: 3.6, probabilite: 0.55, orientation: 'travers', echelle: [1, 0.2] },
        { kind: 'torii', tousLes: 130, decalage: 5.5, probabilite: 0.6, orientation: 'travers', echelle: [0.95, 0.3] },
        { kind: 'bambou', tousLes: 30, decalage: 3.8, probabilite: 0.35 },
        { kind: 'cerisier', tousLes: 24, decalage: 4.5, probabilite: 0.55, echelle: [0.9, 0.4] },
        { kind: 'sanctuaire', tousLes: 220, decalage: 7, probabilite: 0.5, orientation: 'travers', echelle: [1, 0] },
        { kind: 'poteauJp', tousLes: 34, decalage: 3.3, probabilite: 0.6, orientation: 'route', echelle: [1, 0] },
        { kind: 'distributeur', tousLes: 120, decalage: 3.8, probabilite: 0.45, orientation: 'travers', echelle: [1, 0] },
      ],
    },
    // villages (maisons traditionnelles) et, au cœur des plus grands, une rue commerçante (échoppes, petits immeubles)
    batiments: {
      recul: 7, ecart: [2, 5], rang1: 0.8, rang2: 0.6, fond: { cellule: 40, probabilite: 0.35 },
      types: { rang1: [['minka', 1]], rang2: [['minka', 1]], fond: [['minka', 1]] },
      quartiers: {
        echelle: 260, seuil: 0.56, ville: 0.64,
        typesVille: { rang1: [['machiya', 0.65], ['immeubleJp', 0.35]], rang2: [['immeubleJp', 0.5], ['machiya', 0.5]], fond: [['immeubleJp', 0.5], ['minka', 0.5]] },
      },
    },
    fond: [{ kind: 'pagode', cellule: 190, probabilite: 0.7, dMin: 70, dMax: 320, penteMax: 0.5, altitudeMin: 4, echelle: [1, 0.3] }],
    objets: { arbre: 'cerisier', sapin: 'bambou', rocher: 'rocher', pneus: 'toro', panneau: 'torii' },
    nomsObjets: { arbre: 'Cerisier', sapin: 'Bambou', pneus: 'Lanterne de pierre', panneau: 'Torii' },
  },
  cyberpunk: {
    nom: 'Cyberpunk',
    description: 'Mégapole de nuit : tours couvertes d’écrans, néons magenta et cyan, hologrammes au-dessus de la route, échoppes de ramen.',
    fondEditeur: '#3a3550',
    relief: 0.25,
    // quelques arbres en bac, parcs très rares ; pas de rochers
    arbres: { essences: [{ kind: 'arbreVille', bas: 1, haut: 1, echelle: [0.65, 0.4] }], pForet: 0.3, pHors: 0, seuilMin: 0.7 },
    rochers: { base: 0, pente: 0, normal: 'blocBeton', haut: 'blocBeton', partHauts: 0, echelle: [1, 0] },
    bord: {
      chevron: 'chevron', borne: null, sansChevauchement: true,
      extras: [
        { kind: 'lampadaireNeon', tousLes: 24, decalage: 3.2, probabilite: 0.9, orientation: 'route', echelle: [1, 0] },
        { kind: 'enseigneNeon', tousLes: 28, decalage: 3.8, probabilite: 0.55, orientation: 'travers', echelle: [0.9, 0.3] },
        { kind: 'kiosque', tousLes: 110, decalage: 4.2, probabilite: 0.6, orientation: 'travers', echelle: [1, 0] },
        { kind: 'borneRecharge', tousLes: 60, decalage: 3.4, probabilite: 0.4, orientation: 'travers', echelle: [1, 0] },
        { kind: 'voiture', tousLes: 26, decalage: 3.4, probabilite: 0.35, orientation: 'routeSym', echelle: [1, 0] },
        { kind: 'plot', tousLes: 20, decalage: 3.4, probabilite: 0.3, echelle: [0.9, 0.3] },
        { kind: 'blocBeton', tousLes: 70, decalage: 3.5, probabilite: 0.3, orientation: 'routeSym', echelle: [1, 0] },
        { kind: 'poubelle', tousLes: 50, decalage: 3.5, probabilite: 0.35, echelle: [1, 0] },
      ],
      // panneaux holographiques flottant au-dessus de la route
      suspendus: [{ kind: 'holo', tousLes: 55, probabilite: 0.7, lateral: 9, echelle: [0.9, 0.4] }],
    },
    batiments: {
      recul: 8, ecart: [1, 4], rang1: 0.9, rang2: 0.8, fond: { cellule: 44, probabilite: 0.6 },
      types: { rang1: [['immeubleNeon', 1]], rang2: [['tourNeon', 0.55], ['immeubleNeon', 0.45]], fond: [['tourNeon', 0.7], ['immeubleNeon', 0.3]] },
    },
    objets: { arbre: 'arbreVille', sapin: 'lampadaireNeon', rocher: 'blocBeton', pneus: 'kiosque', panneau: 'enseigneNeon' },
    nomsObjets: { arbre: 'Arbre en bac', sapin: 'Lampadaire néon', rocher: 'Bloc béton', pneus: 'Échoppe de ramen', panneau: 'Enseigne' },
  },
};

/** Tous les types de décor qu'un thème peut produire (sert aux tests d'intégrité et au rendu). */
export function typesDuTheme(t: ThemeRegles): DecorKind[] {
  const s = new Set<DecorKind>();
  for (const e of t.arbres.essences) s.add(e.kind);
  s.add(t.rochers.normal); s.add(t.rochers.haut);
  if (t.bord.chevron) s.add(t.bord.chevron);
  if (t.bord.borne) s.add(t.bord.borne);
  for (const x of t.bord.extras) s.add(x.kind);
  for (const x of t.bord.suspendus ?? []) s.add(x.kind);
  for (const x of t.fond ?? []) s.add(x.kind);
  for (const k of Object.values(t.objets)) s.add(k);
  if (t.batiments) for (const k of typesBatiments(t.batiments)) s.add(k);
  return [...s];
}

/** Types de bâtiments par défaut (ville) : immeubles au 1er rang, tours au 2e rang et au fond. */
export const TYPES_VILLE: TypesBatiments = { rang1: [['immeuble', 1]], rang2: [['tour', 0.4], ['immeuble', 0.6]], fond: [['tour', 0.35], ['immeuble', 0.65]] };

/** Tous les types de bâtiments qu'une règle peut poser. */
export function typesBatiments(b: RegleBatiments): DecorKind[] {
  const out = new Set<DecorKind>();
  for (const t of [b.types ?? TYPES_VILLE, ...(b.quartiers ? [b.quartiers.typesVille] : [])]) for (const l of [t.rang1, t.rang2, t.fond]) for (const [k] of l) out.add(k);
  return [...out];
}

/** Type tiré dans une liste de parts (`r` dans [0, 1[ ; le dernier type si les parts n'atteignent pas `r`). */
export function tirerType(parts: PartsBatiments, r: number): DecorKind {
  let acc = 0;
  for (const [k, p] of parts) { acc += p; if (r < acc) return k; }
  return parts[parts.length - 1][0];
}
