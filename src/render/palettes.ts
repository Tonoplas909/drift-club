import * as THREE from 'three';
import type { Ambiance, Environnement } from '../core/level/types';

/** Anneau de reliefs lointains (fond de décor, sans brouillard). */
export interface Reliefs {
  /** couleur de la roche (avant fondu dans la brume) */
  roche: number;
  /** couleur du sommet (neige, strates claires…) */
  cime: number;
  /** fraction de la hauteur à partir de laquelle commence la cime (> 1 : jamais) */
  ligne: number;
  /** cônes pointus (montagnes), troncs de cône à sommet plat (mesas), blocs d'immeubles (ville), îles et galion (pirate),
   * panneaux de murs sans fin (backrooms), collines lunaires (espace) ou collines et volcan enneigé (japon) */
  forme: 'cones' | 'mesas' | 'ville' | 'iles' | 'murs' | 'lune' | 'fuji';
}

export interface Palette {
  skyTop: number; skyBottom: number; fog: number;
  sun: number; sunIntensity: number; sunDir: [number, number, number];
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  grassA: number; grassB: number; forestFloor: number; rock: number;
  asphalt: number; line: number;
  /** bord de la route (accotement et transition avec le sol) ; absent : asphalte assombri */
  epaule?: number;
  /** trottoir : bande claire au sol le long de la route (ville) ; absent : rien */
  trottoir?: number;
  /** couleur de la fumée des dérapages (poussière, poudreuse…) */
  fumee: number;
  /** multiplicateur de la distance de brouillard (< 1 : plus dense) */
  brume: number;
  reliefs: Reliefs;
  /** eau (mer du pirate, lacs) : couleur de la surface, de la plage au bord et du fond sous l'eau ; absents : bleu et sable par défaut */
  eau?: number; plage?: number; fondEau?: number;
  /** couleurs des deux bandes des vibreurs ; absent : rouge et blanc */
  vibreurs?: [number, number];
  /** ciel étoilé avec des astres (espace) */
  ciel?: { etoiles: number; astres: ('terre' | 'geante' | 'orange')[] };
  /** rizières en terrasses (japon) : bandes colorées sur les pentes, une tous les `pas` m d'altitude */
  terrasses?: { a: number; b: number; pas: number };
}

/** Couleur de l'accotement d'une palette (asphalte assombri à 70 % si la palette n'en fixe pas). */
export function epauleDe(p: Palette): THREE.Color {
  return p.epaule !== undefined ? new THREE.Color(p.epaule) : new THREE.Color(p.asphalt).multiplyScalar(0.7);
}

/** Palettes de chaque décor et de chaque ambiance ; le décor est le choix `environnement` du niveau. */
export const PALETTES_THEMES: Record<Environnement, Record<Ambiance, Palette>> = {
  // Palettes historiques : ne pas y toucher
  montagne: {
    jour: {
      skyTop: 0x5ea8e8, skyBottom: 0xcfe8f7, fog: 0xcfe8f7,
      sun: 0xfff4e0, sunIntensity: 2.2, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xbfdcf5, hemiGround: 0x5f7a3a, hemiIntensity: 1.1,
      grassA: 0x7cc152, grassB: 0x5fa843, forestFloor: 0x4f8a3c, rock: 0x9a938a,
      asphalt: 0x4a4d57, line: 0xf4f1e8,
      fumee: 0xe9e6e1, brume: 1,
      reliefs: { roche: 0x9a938a, cime: 0xf4f6fa, ligne: 0.72, forme: 'cones' },
    },
    coucher: {
      skyTop: 0x3d4f8f, skyBottom: 0xffb37a, fog: 0xf2a877,
      sun: 0xffc38a, sunIntensity: 2.0, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffc9a0, hemiGround: 0x4a3f5c, hemiIntensity: 0.9,
      grassA: 0x8fae4a, grassB: 0x6f9440, forestFloor: 0x55723a, rock: 0xa08a80,
      asphalt: 0x4d4a58, line: 0xf7e9d8,
      fumee: 0xe9e6e1, brume: 1,
      reliefs: { roche: 0xa08a80, cime: 0xf4f6fa, ligne: 0.72, forme: 'cones' },
    },
  },
  neige: {
    jour: {
      skyTop: 0x86aed6, skyBottom: 0xe4edf5, fog: 0xdbe6f0,
      sun: 0xfff6ec, sunIntensity: 2.0, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xd4e5f5, hemiGround: 0x93a6c0, hemiIntensity: 1.3,
      grassA: 0xf1f6fb, grassB: 0xd9e5f1, forestFloor: 0xbccfe2, rock: 0x848d9c,
      asphalt: 0x3f434d, line: 0xf4f1e8, epaule: 0x7d8899,
      fumee: 0xf4f8ff, brume: 0.65,
      reliefs: { roche: 0x7b8799, cime: 0xffffff, ligne: 0.4, forme: 'cones' },
    },
    coucher: {
      skyTop: 0x4f5f92, skyBottom: 0xf6c5b2, fog: 0xe6c6c4,
      sun: 0xffc9a0, sunIntensity: 1.9, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffe0d4, hemiGround: 0x7d82ab, hemiIntensity: 1.3,
      grassA: 0xf7e8ec, grassB: 0xd9d0e6, forestFloor: 0xb8b0d0, rock: 0x8a8498,
      asphalt: 0x45434f, line: 0xf7e9d8, epaule: 0x857f9a,
      fumee: 0xf9eef2, brume: 0.7,
      reliefs: { roche: 0x8a8498, cime: 0xfff2f2, ligne: 0.4, forme: 'cones' },
    },
  },
  desert: {
    jour: {
      skyTop: 0x5fa8de, skyBottom: 0xf7e3bd, fog: 0xf0dcb4,
      sun: 0xfff0d0, sunIntensity: 2.4, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xfbe7c4, hemiGround: 0xb5643a, hemiIntensity: 1.1,
      grassA: 0xe8c47a, grassB: 0xd9ab5e, forestFloor: 0xbd8a4a, rock: 0xb4583c,
      asphalt: 0x55504e, line: 0xf4ecd8, epaule: 0x7a5d48,
      fumee: 0xeed3a0, brume: 0.9,
      reliefs: { roche: 0xc26b46, cime: 0xdca06a, ligne: 0.7, forme: 'mesas' },
    },
    coucher: {
      skyTop: 0x59407c, skyBottom: 0xff9a55, fog: 0xf0a373,
      sun: 0xff9f5a, sunIntensity: 2.2, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffc496, hemiGround: 0x8a5a54, hemiIntensity: 1.0,
      grassA: 0xdcae76, grassB: 0xc99a62, forestFloor: 0xa8704a, rock: 0xa9482f,
      asphalt: 0x4c4549, line: 0xf7e0c0, epaule: 0x6f4a3e,
      fumee: 0xf0c08a, brume: 0.9,
      reliefs: { roche: 0xa84c3a, cime: 0xd9804e, ligne: 0.7, forme: 'mesas' },
    },
  },
  automne: {
    jour: {
      skyTop: 0x72aadb, skyBottom: 0xf4e7c9, fog: 0xebdfc1,
      sun: 0xffe6b8, sunIntensity: 2.0, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xf3e2bd, hemiGround: 0x7a5a2c, hemiIntensity: 1.1,
      grassA: 0xa39a45, grassB: 0x8b7b3a, forestFloor: 0x7b5a30, rock: 0x8f7f70,
      asphalt: 0x4a4a50, line: 0xf4f1e8, epaule: 0x775535,
      fumee: 0xe6d5bb, brume: 0.9,
      reliefs: { roche: 0x8b6a4a, cime: 0xd9b06a, ligne: 9, forme: 'cones' },
    },
    coucher: {
      skyTop: 0x5a4a82, skyBottom: 0xffae6a, fog: 0xf0a56b,
      sun: 0xffb870, sunIntensity: 2.0, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffd8a8, hemiGround: 0x74503f, hemiIntensity: 1.05,
      grassA: 0xc09c46, grassB: 0xa8843c, forestFloor: 0x8c5c32, rock: 0x9a7a68,
      asphalt: 0x4d4750, line: 0xf7e9d8, epaule: 0x6e4630,
      fumee: 0xe9cfa8, brume: 0.9,
      reliefs: { roche: 0x8a5a48, cime: 0xd98a4a, ligne: 9, forme: 'cones' },
    },
  },
  ville: {
    // sol = béton gris ; « forêt » = parcs ; accotement = bordure claire ; reliefs = silhouettes d'immeubles
    jour: {
      skyTop: 0x6f9fd0, skyBottom: 0xd9dfe4, fog: 0xcfd6dc,
      sun: 0xfff1dc, sunIntensity: 2.1, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xc9d8e8, hemiGround: 0x8c8a86, hemiIntensity: 1.15,
      grassA: 0xa5a39d, grassB: 0x93908a, forestFloor: 0x76a85a, rock: 0x76757a,
      asphalt: 0x393b42, line: 0xf4f1e8, epaule: 0xc4c1ba, trottoir: 0xb1aea6,
      fumee: 0xdad7d2, brume: 0.85,
      reliefs: { roche: 0x8b96a4, cime: 0xb3bcc8, ligne: 0.8, forme: 'ville' },
    },
    coucher: {
      skyTop: 0x46508a, skyBottom: 0xffa574, fog: 0xe2a184,
      sun: 0xffb98a, sunIntensity: 1.9, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffc7a5, hemiGround: 0x5a4d66, hemiIntensity: 0.95,
      grassA: 0x9b8f8a, grassB: 0x8a7e7c, forestFloor: 0x6a8a4e, rock: 0x6a5f68,
      asphalt: 0x3f3d48, line: 0xf7e9d8, epaule: 0xb4a7a3, trottoir: 0xa39590,
      fumee: 0xe3cbbd, brume: 0.85,
      reliefs: { roche: 0x6a5f7a, cime: 0xd9907a, ligne: 0.8, forme: 'ville' },
    },
  },
  pirate: {
    // sable clair, mer turquoise (l'eau et la plage sont colorées par la palette), accotement de sable mouillé
    jour: {
      skyTop: 0x3a9be0, skyBottom: 0xfff0cf, fog: 0xf6e8c8,
      sun: 0xfff3d6, sunIntensity: 2.3, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xd8ecf7, hemiGround: 0xe0c48a, hemiIntensity: 1.15,
      grassA: 0xf0dc9a, grassB: 0xe2c57f, forestFloor: 0xbdb468, rock: 0xa89a80,
      asphalt: 0x57524f, line: 0xf6f0de, epaule: 0xc9a966,
      fumee: 0xf0e2bc, brume: 0.95,
      reliefs: { roche: 0x3f8a4f, cime: 0xd9c38a, ligne: 9, forme: 'iles' },
      eau: 0x1fc2c4, plage: 0xf6e7b4, fondEau: 0x1a7aa6, vibreurs: [0x1f6fb5, 0xf4f1e8],
    },
    coucher: {
      skyTop: 0x5a3f86, skyBottom: 0xffa060, fog: 0xf2b27c,
      sun: 0xffb070, sunIntensity: 2.1, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffc8a0, hemiGround: 0x8a5a60, hemiIntensity: 1.0,
      grassA: 0xe6bf84, grassB: 0xd4a66c, forestFloor: 0xa89c58, rock: 0x9a7f6c,
      asphalt: 0x524749, line: 0xf8e6cf, epaule: 0xb58a5c,
      fumee: 0xf0c897, brume: 0.92,
      reliefs: { roche: 0x3f6f58, cime: 0xd9a070, ligne: 9, forme: 'iles' },
      eau: 0x2aa6b8, plage: 0xf0cf9c, fondEau: 0x24508a, vibreurs: [0x1f6fb5, 0xf4f1e8],
    },
  },
  backrooms: {
    // moquette jaune humide, brume dense jaune-beige, pas de soleil (lumière plate), silhouettes de murs au fond
    jour: {
      skyTop: 0xdccd74, skyBottom: 0xd6c56c, fog: 0xd8cc84,
      sun: 0xfff2b0, sunIntensity: 0.45, sunDir: [0.2, 0.95, 0.1],
      hemiSky: 0xfff0a8, hemiGround: 0xc8b050, hemiIntensity: 2.0,
      grassA: 0xc2ae56, grassB: 0xb29d48, forestFloor: 0x9a8838, rock: 0x8a7a36,
      asphalt: 0x6a6248, line: 0xf2ecc4, epaule: 0x8a7d48,
      fumee: 0xd8cfa0, brume: 0.36,
      reliefs: { roche: 0xcbb96a, cime: 0xdccd86, ligne: 0.85, forme: 'murs' },
      vibreurs: [0x8a7a2e, 0xe8dfa4],
    },
    coucher: {
      skyTop: 0xc09a40, skyBottom: 0xb8944a, fog: 0xc09c50,
      sun: 0xffb060, sunIntensity: 0.4, sunDir: [-0.2, 0.95, 0.1],
      hemiSky: 0xffd27a, hemiGround: 0xaa8838, hemiIntensity: 1.85,
      grassA: 0xb09640, grassB: 0xa08838, forestFloor: 0x86722c, rock: 0x7a6a2c,
      asphalt: 0x575038, line: 0xeedd9e, epaule: 0x7b6d38,
      fumee: 0xc8b478, brume: 0.36,
      reliefs: { roche: 0xa48a48, cime: 0xc2a45a, ligne: 0.85, forme: 'murs' },
      vibreurs: [0x7a6626, 0xd8c886],
    },
  },
  espace: {
    // régolithe gris (jour) ou violet (coucher), ciel noir étoilé avec deux astres, lumière dure
    jour: {
      skyTop: 0x000004, skyBottom: 0x0c0b22, fog: 0x17142f,
      sun: 0xfffaf0, sunIntensity: 3.0, sunDir: [0.75, 0.42, 0.3],
      hemiSky: 0x7a80b0, hemiGround: 0x4a4560, hemiIntensity: 0.75,
      grassA: 0x9a95a6, grassB: 0x858092, forestFloor: 0x6d6880, rock: 0x504b60,
      asphalt: 0x2b2a33, line: 0xe8e6f0, epaule: 0x57536a,
      fumee: 0xb8b4c8, brume: 1,
      reliefs: { roche: 0x7c7890, cime: 0xa8a4ba, ligne: 9, forme: 'lune' },
      ciel: { etoiles: 1100, astres: ['terre', 'geante'] }, vibreurs: [0xff8a1f, 0xf4f1e8],
    },
    coucher: {
      skyTop: 0x06010f, skyBottom: 0x3a1452, fog: 0x3a1c58,
      sun: 0xffb8a0, sunIntensity: 2.6, sunDir: [-0.7, 0.3, 0.4],
      hemiSky: 0xa070c8, hemiGround: 0x482a62, hemiIntensity: 0.8,
      grassA: 0x8f6fa8, grassB: 0x7a5c94, forestFloor: 0x5f4678, rock: 0x3f2f58,
      asphalt: 0x26222e, line: 0xf0e6ff, epaule: 0x4d3f66,
      fumee: 0xc2a4d8, brume: 1,
      reliefs: { roche: 0x6f4f8c, cime: 0xa27cc4, ligne: 9, forme: 'lune' },
      ciel: { etoiles: 1200, astres: ['orange', 'geante'] }, vibreurs: [0xff5ab0, 0xf4f1e8],
    },
  },
  japon: {
    // ciel pastel, rose des pétales au sol des bosquets, rizières en terrasses, volcan enneigé au fond
    jour: {
      skyTop: 0x86b8ec, skyBottom: 0xfde9ef, fog: 0xf5e6ee,
      sun: 0xfff2e0, sunIntensity: 2.0, sunDir: [0.5, 0.8, 0.3],
      hemiSky: 0xf3dcea, hemiGround: 0x8fae6a, hemiIntensity: 1.15,
      grassA: 0x9ccb6a, grassB: 0x84b85a, forestFloor: 0xe8b8c8, rock: 0x8d8a86,
      asphalt: 0x46474f, line: 0xf6f2e8, epaule: 0xb5b0a0,
      fumee: 0xe8dcd8, brume: 0.88,
      reliefs: { roche: 0x6f84a8, cime: 0xffffff, ligne: 0.62, forme: 'fuji' },
      terrasses: { a: 0x6cae4e, b: 0xb3d264, pas: 1.4 },
    },
    coucher: {
      skyTop: 0x5d5aa0, skyBottom: 0xffc27a, fog: 0xf4bf94,
      sun: 0xffc27a, sunIntensity: 2.0, sunDir: [-0.6, 0.35, 0.5],
      hemiSky: 0xffd8b0, hemiGround: 0x7a5a6a, hemiIntensity: 0.95,
      grassA: 0xb4b964, grassB: 0x9da956, forestFloor: 0xe0a0a8, rock: 0x8a7a7a,
      asphalt: 0x4a4452, line: 0xf8e6cf, epaule: 0xa89888,
      fumee: 0xeccdb4, brume: 0.88,
      reliefs: { roche: 0x7a6a9a, cime: 0xffe6dd, ligne: 0.62, forme: 'fuji' },
      terrasses: { a: 0x8ea648, b: 0xd2c070, pas: 1.4 },
    },
  },
};

/** Palettes de la montagne (le décor historique). */
export const PALETTES: Record<Ambiance, Palette> = PALETTES_THEMES.montagne;

export const paletteDe = (env: Environnement, ambiance: Ambiance): Palette => PALETTES_THEMES[env][ambiance];

/** Couleur `a` → `b` à la fraction `t` (composantes sRGB interpolées, comme les couleurs de la palette). */
export function melangerCouleur(a: number, b: number, t: number): number {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/**
 * Palette intermédiaire entre `a` et `b` (mode Zen : transitions entre décors et entre jour et coucher). Couleurs et
 * nombres interpolés ; la forme des reliefs lointains et le trottoir suivent la palette dominante.
 */
export function melangerPalettes(a: Palette, b: Palette, t: number): Palette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const c = (x: number, y: number) => melangerCouleur(x, y, t);
  const n = (x: number, y: number) => x + (y - x) * t;
  const d = [0, 1, 2].map((i) => n(a.sunDir[i], b.sunDir[i]));
  const l = Math.hypot(d[0], d[1], d[2]) || 1;
  const dom = t < 0.5 ? a : b;
  return {
    skyTop: c(a.skyTop, b.skyTop), skyBottom: c(a.skyBottom, b.skyBottom), fog: c(a.fog, b.fog),
    sun: c(a.sun, b.sun), sunIntensity: n(a.sunIntensity, b.sunIntensity), sunDir: [d[0] / l, d[1] / l, d[2] / l],
    hemiSky: c(a.hemiSky, b.hemiSky), hemiGround: c(a.hemiGround, b.hemiGround), hemiIntensity: n(a.hemiIntensity, b.hemiIntensity),
    grassA: c(a.grassA, b.grassA), grassB: c(a.grassB, b.grassB), forestFloor: c(a.forestFloor, b.forestFloor), rock: c(a.rock, b.rock),
    asphalt: c(a.asphalt, b.asphalt), line: c(a.line, b.line),
    epaule: c(epauleDe(a).getHex(), epauleDe(b).getHex()),
    trottoir: dom.trottoir,
    fumee: c(a.fumee, b.fumee), brume: n(a.brume, b.brume),
    reliefs: { roche: c(a.reliefs.roche, b.reliefs.roche), cime: c(a.reliefs.cime, b.reliefs.cime), ligne: dom.reliefs.ligne, forme: dom.reliefs.forme },
  };
}
