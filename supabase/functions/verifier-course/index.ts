// Edge Function Supabase « verifier-course » : vérifie un score en rejouant la course côté serveur.
//
// Le jeu envoie le score ET les commandes de chaque pas de simulation (replay). La fonction rejoue la course avec
// le même code que le jeu (course.js, généré par tools/gen-fonction.ts) :
//   * score rejoué proche du score envoyé  → on garde le score envoyé (statut « conforme ») ;
//   * score envoyé trop éloigné            → on garde le score rejoué (statut « corrige ») ;
//   * course qui n'atteint pas l'arrivée   → rien n'est enregistré.
// Puis elle appelle enregistrer_score_verifie() (migration 0008), réservée à la clé secrète du serveur.
//
// Déploiement : voir supabase/README.md (supabase functions deploy verifier-course --no-verify-jwt).
// Le jeton du joueur est vérifié ici (auth/v1/user), d'où --no-verify-jwt (sinon la requête CORS préalable est refusée).
// @ts-nocheck : fichier Deno, hors du tsconfig du jeu.
import { traiterCourse, EMPREINTE } from './course.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (corps: unknown, status = 200): Response =>
  new Response(JSON.stringify(corps), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const URL_PROJET = Deno.env.get('SUPABASE_URL') ?? '';

/** Première clé d'un dictionnaire JSON de clés (SUPABASE_SECRET_KEYS / SUPABASE_PUBLISHABLE_KEYS), sinon l'ancienne clé. */
function cle(dictionnaire: string, ancienne: string): string {
  try {
    const d = JSON.parse(Deno.env.get(dictionnaire) ?? '');
    const v = Object.values(d ?? {}).find((x) => typeof x === 'string' && x);
    if (v) return v as string;
  } catch { /* variable absente */ }
  return Deno.env.get(ancienne) ?? '';
}
const CLE_SECRETE = cle('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const CLE_PUBLIQUE = cle('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

/** En-têtes pour appeler l'API avec la clé secrète (nouvelle clé « sb_secret_… » ou ancienne clé JWT). */
function enTetesServeur(): Record<string, string> {
  const h: Record<string, string> = { apikey: CLE_SECRETE, 'Content-Type': 'application/json' };
  if (CLE_SECRETE.startsWith('eyJ')) h.Authorization = `Bearer ${CLE_SECRETE}`;
  return h;
}

/** id du joueur connecté, ou null si le jeton est absent ou invalide. */
async function joueur(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  const r = await fetch(`${URL_PROJET}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: req.headers.get('apikey') ?? CLE_PUBLIQUE },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  return typeof u?.id === 'string' ? u.id : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, code: 'demande', message: 'Méthode non acceptée.' }, 405);

  const id = await joueur(req);
  if (!id) return json({ ok: false, code: 'connexion', message: 'Connecte-toi pour envoyer un score.' });

  const corps = await req.json().catch(() => null);
  const rep = await traiterCourse(corps, EMPREINTE);
  if (!rep.ok) return json(rep);

  const v = rep.verdict;
  const r = await fetch(`${URL_PROJET}/rest/v1/rpc/enregistrer_score_verifie`, {
    method: 'POST',
    headers: enTetesServeur(),
    body: JSON.stringify({
      p_joueur: id, p_niveau: rep.niveau, p_mode: rep.mode, p_voiture: rep.voiture,
      p_score: v.score, p_temps: v.temps, p_meilleur_drift: Math.min(v.meilleurDrift, v.score),
      p_statut: v.statut, p_score_annonce: Math.round(Number(corps.score)), p_score_rejoue: v.scoreRejoue,
    }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    // fonction SQL absente : migration 0008 pas encore appliquée, le jeu se rabat sur l'ancien envoi
    if (err?.code === 'PGRST202' || err?.code === '42883') return json({ ok: false, code: 'indisponible', message: 'Vérification pas encore installée.' });
    // messages français levés par le SQL (« Choisis un pseudo… », « Score invalide. »…)
    const message = err?.code === 'P0001' && typeof err.message === 'string' ? err.message : "Le score n'a pas pu être enregistré.";
    return json({ ok: false, code: 'refuse', message });
  }
  const lignes = await r.json();
  const ligne = Array.isArray(lignes) ? lignes[0] : lignes;
  return json({ ok: true, statut: v.statut, score: v.score, ...ligne });
});
