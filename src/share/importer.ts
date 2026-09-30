import type { Level } from '../core/level/types';
import { loadLevel } from '../core/loadLevel';
import { decoderNiveau } from '../core/level/encode';
import { analyserSaisie } from './lien';

/** Résultat de la lecture d'un code, d'un lien, d'un JSON ou d'un fichier. Un niveau renvoyé est toujours valide. */
export type Lecture =
  | { type: 'niveau'; level: Level }
  | { type: 'en-ligne'; id: string }
  | { type: 'erreur'; erreurs: string[] };

/** Taille maximale d'un fichier .json importé. */
export const TAILLE_MAX_FICHIER = 1_000_000;

/** JSON (§5.1) → niveau validé, ou erreurs lisibles en français. */
export function lireJson(texte: string): Lecture {
  let raw: unknown;
  try { raw = JSON.parse(texte); } catch { return { type: 'erreur', erreurs: ["Ce fichier n'est pas un JSON valide."] }; }
  const r = loadLevel(raw);
  return r.ok ? { type: 'niveau', level: r.level } : { type: 'erreur', erreurs: r.erreurs };
}

/** Code, lien complet (`…#n=…` ou `…#en-ligne=…`) ou JSON collé. */
export async function lireSaisie(saisie: string): Promise<Lecture> {
  const p = analyserSaisie(saisie);
  if (!p) return { type: 'erreur', erreurs: ['Ni code ni lien de niveau reconnu. Colle un code, un lien de partage ou charge un fichier .json.'] };
  if (p.type === 'en-ligne') return { type: 'en-ligne', id: p.id };
  if (p.type === 'json') return lireJson(p.texte);
  const r = await decoderNiveau(p.code);
  return r.ok ? { type: 'niveau', level: r.level } : { type: 'erreur', erreurs: r.erreurs };
}

/** Fichier choisi par le joueur : .json du §5.1 (un fichier contenant un code ou un lien est accepté aussi). */
export async function lireFichier(f: { size: number; text(): Promise<string> }): Promise<Lecture> {
  if (f.size > TAILLE_MAX_FICHIER) return { type: 'erreur', erreurs: ['Ce fichier est trop gros pour être un niveau.'] };
  let texte: string;
  try { texte = await f.text(); } catch { return { type: 'erreur', erreurs: ['Ce fichier est illisible.'] }; }
  const t = texte.replace(/^﻿/, '').trim();
  return t.startsWith('{') ? lireJson(t) : lireSaisie(t);
}
