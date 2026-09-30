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
  /** cônes pointus (montagnes) ou troncs de cône à sommet plat (mesas) */
  forme: 'cones' | 'mesas';
}

export interface Palette {
  skyTop: number; skyBottom: number; fog: number;
  sun: number; sunIntensity: number; sunDir: [number, number, number];
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  grassA: number; grassB: number; forestFloor: number; rock: number;
  asphalt: number; line: number;
  /** bord de la route (accotement et transition avec le sol) ; absent : asphalte assombri */
  epaule?: number;
  /** couleur de la fumée des dérapages (poussière, poudreuse…) */
  fumee: number;
  /** multiplicateur de la distance de brouillard (< 1 : plus dense) */
  brume: number;
  reliefs: Reliefs;
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
};

/** Palettes de la montagne (le décor historique). */
export const PALETTES: Record<Ambiance, Palette> = PALETTES_THEMES.montagne;

export const paletteDe = (env: Environnement, ambiance: Ambiance): Palette => PALETTES_THEMES[env][ambiance];
