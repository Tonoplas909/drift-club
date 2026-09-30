import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Environment } from '../core/env/types';
import { loadLevel } from '../core/loadLevel';
import type { Terrain } from '../core/track/terrain';
import { creerTerrain } from '../core/env/terrainDuNiveau';
import { generateEnvironment } from '../core/env/generate';

export interface PreparedLevel { key: string; level: Level; track: TrackData; terrain: Terrain; env: Environment }

/** Valide le niveau puis calcule piste, terrain et décor (peut prendre quelques centaines de ms). */
export function prepareLevel(key: string, raw: unknown): { ok: true; prepared: PreparedLevel } | { ok: false; erreurs: string[] } {
  const r = loadLevel(raw);
  if (!r.ok) return r;
  const terrain = creerTerrain(r.track, r.level);
  const env = generateEnvironment(r.level, r.track, terrain);
  return { ok: true, prepared: { key, level: r.level, track: r.track, terrain, env } };
}
