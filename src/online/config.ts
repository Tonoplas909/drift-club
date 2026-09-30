/** Projet Supabase du jeu. La clé publiable peut être publique : la sécurité repose sur les règles RLS (supabase/). */
export const SUPABASE_URL = 'https://studzxweqmgpuhgsvxmi.supabase.co';
export const SUPABASE_CLE_PUBLIABLE = 'sb_publishable_0vuryOn2nuaYrx7RbfcPqQ_j7rJHg2b';

/** Adresse du jeu publié, utilisée pour les liens des emails hors navigateur. */
export const SITE_URL = 'https://tonoplas909.github.io/drift-club/';

/** Adresse de retour des emails (confirmation, mot de passe oublié) : le site où tourne le jeu. */
export function urlRetour(): string {
  return typeof window !== 'undefined' && window.location ? window.location.origin + import.meta.env.BASE_URL : SITE_URL;
}
