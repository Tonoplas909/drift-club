import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_CLE_PUBLIABLE } from './config';

/** Donne le client Supabase, ou null si le service est injoignable (le jeu reste jouable hors ligne). */
export type Fournisseur = () => Promise<SupabaseClient | null>;

let promesse: Promise<SupabaseClient | null> | null = null;

/** Client créé à la demande : la bibliothèque est chargée à part, hors du paquet principal du jeu. */
export const clientParDefaut: Fournisseur = () => {
  promesse ??= import('@supabase/supabase-js')
    .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_CLE_PUBLIABLE, {
      // detectSessionInUrl : le lien de confirmation de l'email connecte le joueur à son retour dans le jeu
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'driftclub.v1.auth' },
    }))
    .catch(() => {
      promesse = null; // hors ligne : on retentera plus tard
      return null;
    });
  return promesse;
};
