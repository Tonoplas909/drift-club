import { ENVIRONNEMENTS, type Ambiance, type Environnement } from '../core/level/types';

/**
 * Aperçu des décors (développement) : `?theme=desert` remplace l'environnement de TOUT niveau au chargement,
 * `?ambiance=coucher` (ou `nuit`) son ambiance, `?meteo=pluie` y fait pleuvoir. Valeurs inconnues ignorées. Le niveau enregistré n'est pas modifié.
 */
export function decorDepuisUrl(search: string): { environnement?: Environnement; ambiance?: Ambiance; meteo?: 'pluie' } {
  const q = new URLSearchParams(search);
  const env = q.get('theme'), amb = q.get('ambiance');
  const out: { environnement?: Environnement; ambiance?: Ambiance; meteo?: 'pluie' } = {};
  if (q.get('meteo') === 'pluie') out.meteo = 'pluie';
  if (env && (ENVIRONNEMENTS as readonly string[]).includes(env)) out.environnement = env as Environnement;
  if (amb === 'jour' || amb === 'coucher' || amb === 'nuit') out.ambiance = amb;
  return out;
}

/** Niveau brut avec l'environnement / l'ambiance imposés par l'URL (le même objet s'il n'y a rien à changer). */
export function forcerDecor(raw: unknown, search: string): unknown {
  const o = decorDepuisUrl(search);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw;
  if (o.environnement === undefined && o.ambiance === undefined && o.meteo === undefined) return raw;
  return { ...raw, ...o };
}
