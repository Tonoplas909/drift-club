import type { Environnement, TypeObjet } from '../level/types';
import type { DecorKind } from './types';

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
}

export interface ThemeRegles {
  /** nom affiché (français) */
  nom: string;
  /** phrase pour l'éditeur */
  description: string;
  /** couleur du sol dans la vue de dessus de l'éditeur */
  fondEditeur: string;
  arbres: {
    essences: Essence[];
    /** probabilité de base par case en forêt / hors forêt (avant densité) */
    pForet: number;
    pHors: number;
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
  };
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
};

/** Tous les types de décor qu'un thème peut produire (sert aux tests d'intégrité et au rendu). */
export function typesDuTheme(t: ThemeRegles): DecorKind[] {
  const s = new Set<DecorKind>();
  for (const e of t.arbres.essences) s.add(e.kind);
  s.add(t.rochers.normal); s.add(t.rochers.haut);
  if (t.bord.chevron) s.add(t.bord.chevron);
  if (t.bord.borne) s.add(t.bord.borne);
  for (const x of t.bord.extras) s.add(x.kind);
  for (const k of Object.values(t.objets)) s.add(k);
  return [...s];
}
