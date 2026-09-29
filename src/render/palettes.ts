import type { Ambiance } from '../core/level/types';

export interface Palette {
  skyTop: number; skyBottom: number; fog: number;
  sun: number; sunIntensity: number; sunDir: [number, number, number];
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  grassA: number; grassB: number; forestFloor: number; rock: number;
  asphalt: number; line: number;
}

export const PALETTES: Record<Ambiance, Palette> = {
  jour: {
    skyTop: 0x5ea8e8, skyBottom: 0xcfe8f7, fog: 0xcfe8f7,
    sun: 0xfff4e0, sunIntensity: 2.2, sunDir: [0.5, 0.8, 0.3],
    hemiSky: 0xbfdcf5, hemiGround: 0x5f7a3a, hemiIntensity: 1.1,
    grassA: 0x7cc152, grassB: 0x5fa843, forestFloor: 0x4f8a3c, rock: 0x9a938a,
    asphalt: 0x4a4d57, line: 0xf4f1e8,
  },
  coucher: {
    skyTop: 0x3d4f8f, skyBottom: 0xffb37a, fog: 0xf2a877,
    sun: 0xffc38a, sunIntensity: 2.0, sunDir: [-0.6, 0.35, 0.5],
    hemiSky: 0xffc9a0, hemiGround: 0x4a3f5c, hemiIntensity: 0.9,
    grassA: 0x8fae4a, grassB: 0x6f9440, forestFloor: 0x55723a, rock: 0xa08a80,
    asphalt: 0x4d4a58, line: 0xf7e9d8,
  },
};
