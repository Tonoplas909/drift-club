/** Champs utiles d'une erreur Supabase (auth ou PostgREST) ou d'un échec réseau. */
interface ErreurLike { message?: unknown; code?: unknown; status?: unknown; name?: unknown }

export const MSG_INDISPONIBLE = 'Service en ligne indisponible pour le moment. Le jeu reste jouable hors ligne.';

/** Traduit une erreur Supabase courante en message français pour le joueur. */
export function messageErreur(err: unknown): string {
  const e: ErreurLike = err && typeof err === 'object' ? err : { message: String(err ?? '') };
  const msg = typeof e.message === 'string' ? e.message : '';
  const code = typeof e.code === 'string' ? e.code : '';
  const nom = typeof e.name === 'string' ? e.name : '';
  const bas = msg.toLowerCase();

  if (code === 'invalid_credentials' || bas.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (code === 'email_not_confirmed' || bas.includes('email not confirmed')) return "Email pas encore confirmé : clique sur le lien reçu par email.";
  if (code === 'user_already_exists' || code === 'email_exists' || bas.includes('already registered')) return 'Un compte existe déjà avec cet email. Connecte-toi.';
  if (code === 'weak_password' || bas.includes('password should be') || bas.includes('weak password')) return 'Mot de passe trop faible : 6 caractères minimum.';
  if (code === 'same_password') return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (code === 'email_address_invalid' || bas.includes('invalid email') || (bas.includes('email address') && bas.includes('invalid'))) return "Cette adresse email n'est pas acceptée.";
  if (code === 'signup_disabled') return 'Les inscriptions sont fermées pour le moment.';
  if (code.startsWith('over_') || code === 'too_many_requests' || bas.includes('rate limit') || e.status === 429) return 'Trop de tentatives ou d\'emails envoyés. Réessaie dans quelques minutes.';
  // serveur pas encore mis à jour pour une nouvelle voiture (migration 0007) : le score reste local
  if (bas.includes('voiture invalide') || (code === '23514' && bas.includes('scores_voiture_valide'))) return "Cette voiture n'est pas encore acceptée au classement en ligne : ton score n'a pas été envoyé.";
  if (code === '23505') return 'Ce pseudo est déjà pris.';
  if (code === '23514') return 'Pseudo invalide.';
  // tables ou fonctions absentes : le SQL de supabase/ n'a pas encore été appliqué
  if (code === '42P01' || code === '42883' || code.startsWith('PGRST2')) {
    if (/caisse|progression/.test(bas)) return "La progression en ligne n'est pas encore disponible.";
    if (/livree|admin/.test(bas)) return "L'Atelier en ligne n'est pas encore disponible.";
    return /niveau|publier|retirer|compter_partie/.test(bas) ? "Les niveaux en ligne ne sont pas encore disponibles." : "Le classement en ligne n'est pas encore disponible.";
  }
  // fonction réservée aux comptes connectés appelée sans session
  if (code === '42501' || code === 'PGRST301' || bas.includes('jwt')) return 'Connecte-toi pour faire cela.';
  if (nom === 'AuthRetryableFetchError' || nom === 'TypeError' || bas.includes('failed to fetch') || bas.includes('networkerror') || bas.includes('load failed') || bas.includes('network request failed') || e.status === 0) return MSG_INDISPONIBLE;
  // messages français levés par les fonctions SQL (ex. « Temps invalide. », « Limite atteinte : … »)
  if (code === 'P0001' && msg) return msg;
  return 'Une erreur est survenue. Réessaie plus tard.';
}
