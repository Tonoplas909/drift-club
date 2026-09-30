/** Liens et saisies de partage : fonctions pures (pas de DOM), l'adresse du jeu est passée en paramètre. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE = /^\d{1,3}\.[A-Za-z0-9_-]+$/;

/** Ce qu'un joueur a collé ou ce que contient l'adresse d'ouverture. */
export type Partage =
  | { type: 'code'; code: string }
  | { type: 'en-ligne'; id: string }
  | { type: 'json'; texte: string };

/** `https://site/base/#n=<code>` : `base` = `import.meta.env.BASE_URL`. */
export function lienNiveau(origine: string, base: string, code: string): string {
  return `${origine}${base}#n=${code}`;
}

/** `https://site/base/#en-ligne=<uuid>` : lien court vers un niveau publié. */
export function lienEnLigne(origine: string, base: string, id: string): string {
  return `${origine}${base}#en-ligne=${id}`;
}

/** Lit `n=<code>` ou `en-ligne=<uuid>` dans un fragment d'adresse (avec ou sans « # »). Autre chose : null. */
export function lireFragment(fragment: string): Partage | null {
  const f = fragment.replace(/^#/, '');
  const n = /^n=([^&]*)$/.exec(f);
  if (n) return CODE.test(n[1]) ? { type: 'code', code: n[1] } : null;
  const e = /^en-ligne=([^&]*)$/.exec(f);
  if (e) return UUID.test(e[1]) ? { type: 'en-ligne', id: e[1].toLowerCase() } : null;
  return null;
}

/**
 * Interprète une saisie : lien complet (`…#n=…` ou `…#en-ligne=…`), code seul, JSON collé.
 * Espaces et retours à la ligne autour (ou dans un code coupé par un message) sont ignorés. Autre chose : null.
 */
export function analyserSaisie(saisie: string): Partage | null {
  const t = saisie.trim();
  if (t === '') return null;
  if (t.startsWith('{')) return { type: 'json', texte: t };
  const dieze = t.indexOf('#');
  if (dieze >= 0) return lireFragment(t.slice(dieze + 1).replace(/\s+/g, ''));
  const sansEspaces = t.replace(/\s+/g, '');
  if (/^n=/.test(sansEspaces) || /^en-ligne=/.test(sansEspaces)) return lireFragment(sansEspaces);
  return CODE.test(sansEspaces) ? { type: 'code', code: sansEspaces } : null;
}

/** Nombre de caractères au-delà duquel certaines applis risquent de tronquer un lien. */
export const LONGUEUR_LIEN_SURE = 8000;
