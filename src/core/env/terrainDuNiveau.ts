import type { Level } from '../level/types';
import type { TrackData } from '../track/buildTrack';
import { Terrain } from '../track/terrain';
import { THEMES } from './themes';

/** Terrain d'un niveau avec tout ce que son décor impose : relief, lacs, et mer / cratères du thème. */
export function creerTerrain(track: TrackData, level: Level): Terrain {
  const t = THEMES[level.environnement];
  return new Terrain(track, level.decor.graine, t.relief, level.eau, t.terrain);
}
