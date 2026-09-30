import type { Level } from './level/types';
import { validateLevel } from './level/validate';
import { buildTrack, type TrackData } from './track/buildTrack';
import { checkGeometry } from './track/checkGeometry';
import { problemesEau } from './env/eau';

export type ResultatChargement = { ok: true; level: Level; track: TrackData } | { ok: false; erreurs: string[] };

/** Valide la structure, construit la piste et vérifie sa géométrie. */
export function loadLevel(raw: unknown): ResultatChargement {
  const v = validateLevel(raw);
  if (!v.ok) return v;
  const track = buildTrack(v.level);
  const geo = [...checkGeometry(track), ...problemesEau(v.level.eau, track.samples)];
  if (geo.length > 0) return { ok: false, erreurs: geo };
  return { ok: true, level: v.level, track };
}
