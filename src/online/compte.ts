import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import { urlRetour } from './config';

export { messageErreur } from './erreurs';

export const PSEUDO_MIN = 3;
export const PSEUDO_MAX = 20;
export const MOT_DE_PASSE_MIN = 6;

/** Message d'erreur en français, ou null si le pseudo est valide (mêmes règles que le SQL). */
export function validerPseudo(p: string): string | null {
  const t = p.trim();
  if (t.length < PSEUDO_MIN) return `Le pseudo doit faire au moins ${PSEUDO_MIN} caractères.`;
  if (t.length > PSEUDO_MAX) return `Le pseudo doit faire au plus ${PSEUDO_MAX} caractères.`;
  if (!/^[A-Za-z0-9_ -]+$/.test(t)) return 'Pseudo : lettres sans accent, chiffres, espace, « _ » et « - » uniquement.';
  return null;
}

export function validerEmail(e: string): string | null {
  const t = e.trim();
  if (!t) return "Entre ton adresse email.";
  if (t.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) return "Cette adresse email n'a pas l'air valide.";
  return null;
}

export function validerMotDePasse(m: string): string | null {
  if (m.length < MOT_DE_PASSE_MIN) return `Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`;
  if (m.length > 72) return 'Le mot de passe est trop long (72 caractères maximum).';
  return null;
}

export type EtatCompte =
  | { statut: 'deconnecte' }
  | {
    statut: 'connecte'; id: string; email: string; pseudo: string | null;
    /** vrai après un clic sur le lien « mot de passe oublié » : le joueur doit choisir un nouveau mot de passe */
    recuperation?: boolean;
    /** explication quand le pseudo n'a pas pu être créé automatiquement */
    note?: string;
  };

export type Issue = { ok: true } | { ok: false; message: string };
export type IssueInscription = { ok: true; confirmation: boolean } | { ok: false; message: string };

const DECONNECTE: EtatCompte = { statut: 'deconnecte' };

/** Compte joueur : session Supabase + pseudo (table `profils`). Chaque méthode échoue en douceur (message français). */
export class CompteService {
  private etatCourant: EtatCompte = DECONNECTE;
  private readonly ecouteurs = new Set<(e: EtatCompte) => void>();
  private file: Promise<void> = Promise.resolve();
  private demarre = false;

  constructor(private readonly fournisseur: Fournisseur) {}

  get etat(): EtatCompte { return this.etatCourant; }

  /** S'abonne aux changements ; renvoie la fonction de désabonnement. */
  onChange(f: (e: EtatCompte) => void): () => void {
    this.ecouteurs.add(f);
    return () => { this.ecouteurs.delete(f); };
  }

  /** Restaure la session enregistrée (ou celle du lien d'un email) et suit ses changements. Ne lève jamais. */
  async demarrer(): Promise<void> {
    if (this.demarre) return;
    try {
      const client = await this.fournisseur();
      if (!client) return;
      this.demarre = true;
      client.auth.onAuthStateChange((evt, session) => {
        // pas d'appel Supabase directement dans ce rappel (risque de blocage) : on passe par la file
        setTimeout(() => { void this.enfiler(session, evt === 'PASSWORD_RECOVERY'); }, 0);
      });
    } catch { /* hors ligne : le jeu reste jouable */ }
  }

  async inscription(email: string, motDePasse: string, pseudo: string): Promise<IssueInscription> {
    const err = validerEmail(email) ?? validerMotDePasse(motDePasse) ?? validerPseudo(pseudo);
    if (err) return { ok: false, message: err };
    const client = await this.client();
    if (!client) return { ok: false, message: MSG_INDISPONIBLE };
    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(), password: motDePasse,
        // le pseudo est gardé avec le compte : il servira à créer le profil à la première connexion
        options: { emailRedirectTo: urlRetour(), data: { pseudo: pseudo.trim() } },
      });
      if (error) return { ok: false, message: messageErreur(error) };
      // email déjà utilisé : Supabase renvoie un faux utilisateur sans identité (pour ne pas révéler les comptes)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return { ok: false, message: messageErreur({ code: 'user_already_exists' }) };
      }
      if (data.session) {
        await this.enfiler(data.session, false);
        return { ok: true, confirmation: false };
      }
      return { ok: true, confirmation: true };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  async connexion(email: string, motDePasse: string): Promise<Issue> {
    const err = validerEmail(email) ?? (motDePasse ? null : 'Entre ton mot de passe.');
    if (err) return { ok: false, message: err };
    const client = await this.client();
    if (!client) return { ok: false, message: MSG_INDISPONIBLE };
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: motDePasse });
      if (error) return { ok: false, message: messageErreur(error) };
      await this.enfiler(data.session, false);
      return { ok: true };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  async deconnexion(): Promise<void> {
    try {
      const client = await this.client();
      if (client) {
        const { error } = await client.auth.signOut();
        if (error) await client.auth.signOut({ scope: 'local' });
      }
    } catch { /* on se déconnecte quand même côté jeu */ }
    this.changer(DECONNECTE);
  }

  /** Crée ou change le pseudo du joueur connecté. */
  async definirPseudo(pseudo: string): Promise<Issue> {
    const err = validerPseudo(pseudo);
    if (err) return { ok: false, message: err };
    const etat = this.etatCourant;
    if (etat.statut !== 'connecte') return { ok: false, message: 'Connecte-toi pour choisir un pseudo.' };
    const client = await this.client();
    if (!client) return { ok: false, message: MSG_INDISPONIBLE };
    try {
      const { error } = await client.from('profils').upsert({ id: etat.id, pseudo: pseudo.trim() }, { onConflict: 'id' });
      if (error) return { ok: false, message: messageErreur(error) };
      this.changer({ ...etat, pseudo: pseudo.trim(), note: undefined });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Envoie un email de réinitialisation ; le lien ramène dans le jeu (connecté, avec un formulaire de nouveau mot de passe). */
  async motDePasseOublie(email: string): Promise<Issue> {
    const err = validerEmail(email);
    if (err) return { ok: false, message: err };
    const client = await this.client();
    if (!client) return { ok: false, message: MSG_INDISPONIBLE };
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: urlRetour() });
      return error ? { ok: false, message: messageErreur(error) } : { ok: true };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Nouveau mot de passe du joueur connecté (après « mot de passe oublié »). */
  async changerMotDePasse(motDePasse: string): Promise<Issue> {
    const err = validerMotDePasse(motDePasse);
    if (err) return { ok: false, message: err };
    const client = await this.client();
    if (!client) return { ok: false, message: MSG_INDISPONIBLE };
    try {
      const { error } = await client.auth.updateUser({ password: motDePasse });
      if (error) return { ok: false, message: messageErreur(error) };
      const etat = this.etatCourant;
      if (etat.statut === 'connecte') this.changer({ ...etat, recuperation: false });
      return { ok: true };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  private async client(): Promise<SupabaseClient | null> {
    try { return await this.fournisseur(); } catch { return null; }
  }

  private changer(e: EtatCompte): void {
    this.etatCourant = e;
    for (const f of [...this.ecouteurs]) {
      try { f(e); } catch { /* un écouteur défaillant ne bloque pas les autres */ }
    }
  }

  /** Les mises à jour de session passent une par une (évite deux créations de profil simultanées). */
  private enfiler(session: Session | null, recuperation: boolean): Promise<void> {
    const p = this.file.then(() => this.appliquer(session, recuperation)).catch(() => { /* jamais de rejet non géré */ });
    this.file = p;
    return p;
  }

  private async appliquer(session: Session | null, recuperation: boolean): Promise<void> {
    if (!session) { if (this.etatCourant.statut !== 'deconnecte') this.changer(DECONNECTE); return; }
    const courant = this.etatCourant;
    // simple renouvellement du jeton : rien à recharger
    if (courant.statut === 'connecte' && courant.id === session.user.id && courant.pseudo !== null && !recuperation) return;
    const email = session.user.email ?? '';
    const id = session.user.id;
    let pseudo: string | null = null;
    let note: string | undefined;
    const client = await this.client();
    if (client) {
      try {
        const { data, error } = await client.from('profils').select('pseudo').eq('id', id).maybeSingle();
        if (error) throw error;
        pseudo = data?.pseudo ?? null;
        if (pseudo === null) {
          // premier passage après la confirmation de l'email : on crée le profil avec le pseudo de l'inscription
          const souhaite = session.user.user_metadata?.pseudo;
          if (typeof souhaite === 'string' && validerPseudo(souhaite) === null) {
            const r = await client.from('profils').insert({ id, pseudo: souhaite.trim() });
            if (r.error) note = r.error.code === '23505' ? `Le pseudo « ${souhaite.trim()} » est déjà pris : choisis-en un autre.` : messageErreur(r.error);
            else pseudo = souhaite.trim();
          }
        }
      } catch (e) {
        note = messageErreur(e); // profil illisible (hors ligne, tables absentes) : connecté sans pseudo
      }
    }
    const rec = recuperation || (courant.statut === 'connecte' && courant.id === id && courant.recuperation === true);
    this.changer({ statut: 'connecte', id, email, pseudo, ...(rec ? { recuperation: true } : {}), ...(note ? { note } : {}) });
  }
}
