import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import type { Resultat } from './classement';
import type { Level } from '../core/level/types';
import { loadLevel } from '../core/loadLevel';
import { empreinteNiveau } from '../core/level/fingerprint';
import { normaliserNiveau } from '../core/level/encode';
import { longueurRoute } from '../editor/format';

export type TriNiveaux = 'recent' | 'populaire';

/** Ligne de la liste « En ligne » (sans les données du niveau). */
export interface NiveauEnLigne {
  id: string;
  nom: string;
  /** id du compte de l'auteur (pour proposer « Retirer ») */
  auteur: string;
  auteurPseudo: string;
  empreinte: string;
  longueur: number;
  creeLe: string;
  parties: number;
}

/** Niveau en ligne chargé et re-validé : prêt à être joué. */
export interface NiveauCharge {
  meta: NiveauEnLigne;
  level: Level;
  /** empreinte recalculée localement (clé du classement) */
  empreinte: string;
}

export interface PageNiveaux { niveaux: NiveauEnLigne[]; plus: boolean }

export const TAILLE_PAGE = 12;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;

const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const premiere = (data: unknown): Record<string, unknown> | null => objet(Array.isArray(data) ? data[0] : data);

/** Ligne du serveur → NiveauEnLigne ; null si elle n'a pas la forme attendue (on ne fait pas confiance à la base). */
function lireLigne(r: unknown): NiveauEnLigne | null {
  const o = objet(r);
  if (!o || typeof o.id !== 'string' || !UUID.test(o.id) || typeof o.nom !== 'string' || typeof o.empreinte !== 'string' || !HEX64.test(o.empreinte)) return null;
  return {
    id: o.id.toLowerCase(),
    nom: o.nom.slice(0, 40),
    auteur: typeof o.auteur === 'string' ? o.auteur : '',
    auteurPseudo: typeof o.auteur_pseudo === 'string' ? o.auteur_pseudo : '?',
    empreinte: o.empreinte,
    longueur: Number.isFinite(nombre(o.longueur)) ? nombre(o.longueur) : 0,
    creeLe: typeof o.cree_le === 'string' ? o.cree_le : '',
    parties: Number.isFinite(nombre(o.parties)) ? Math.max(0, Math.round(nombre(o.parties))) : 0,
  };
}

/** Niveaux publiés en ligne (fonctions SQL de `0003_niveaux_publics.sql`). Chaque méthode échoue en douceur. */
export class NiveauxEnLigneService {
  constructor(private readonly fournisseur: Fournisseur) {}

  /** Publie un niveau (arrondi comme dans un lien : tous les joueurs jouent le même). Renvoie l'id en ligne. */
  async publier(level: Level): Promise<Resultat<{ id: string; empreinte: string }>> {
    const niveau = normaliserNiveau(level);
    const v = loadLevel(niveau);
    if (!v.ok) return { ok: false, message: `Niveau invalide : ${v.erreurs[0]}` };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const empreinte = await empreinteNiveau(v.level);
      const { data, error } = await client.rpc('publier_niveau', {
        p_donnees: v.level, p_empreinte: empreinte, p_longueur: Math.round(longueurRoute(v.level) * 10) / 10,
      });
      if (error) return { ok: false, message: messageErreur(error) };
      if (typeof data !== 'string' || !UUID.test(data)) return { ok: false, message: 'Réponse inattendue du serveur.' };
      return { ok: true, valeur: { id: data.toLowerCase(), empreinte } };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Une page de niveaux ; `plus` indique qu'il en reste (on demande un niveau de plus que la page). */
  async lister(tri: TriNiveaux, page: number, taille = TAILLE_PAGE): Promise<Resultat<PageNiveaux>> {
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('niveaux_en_ligne', { p_tri: tri, p_limite: taille + 1, p_decalage: Math.max(0, page) * taille });
      if (error) return { ok: false, message: messageErreur(error) };
      const lignes = (Array.isArray(data) ? data : []).map(lireLigne).filter((n): n is NiveauEnLigne => n !== null);
      return { ok: true, valeur: { niveaux: lignes.slice(0, taille), plus: Array.isArray(data) && data.length > taille } };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Charge un niveau et le re-valide entièrement : un niveau altéré ou piégé est refusé. */
  async charger(id: string): Promise<Resultat<NiveauCharge>> {
    if (!UUID.test(id)) return { ok: false, message: 'Lien de niveau invalide.' };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('niveau_en_ligne', { p_id: id });
      if (error) return { ok: false, message: messageErreur(error) };
      const ligne = premiere(data);
      if (!ligne) return { ok: false, message: "Ce niveau n'existe pas ou a été retiré." };
      const meta = lireLigne(ligne);
      if (!meta) return { ok: false, message: 'Réponse inattendue du serveur.' };
      const v = loadLevel(ligne.donnees);
      if (!v.ok) return { ok: false, message: `Ce niveau en ligne est invalide : ${v.erreurs[0]}` };
      const empreinte = await empreinteNiveau(v.level);
      if (empreinte !== meta.empreinte) return { ok: false, message: 'Ce niveau en ligne est corrompu.' };
      return { ok: true, valeur: { meta, level: v.level, empreinte } };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Retire un niveau publié (réservé à son auteur, contrôlé par le serveur). */
  async retirer(id: string): Promise<Resultat<null>> {
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { error } = await client.rpc('retirer_niveau', { p_id: id });
      return error ? { ok: false, message: messageErreur(error) } : { ok: true, valeur: null };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** +1 partie (compteur approximatif) ; ne lève jamais et ne bloque jamais le jeu. */
  async compterPartie(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    try {
      const client = await this.fournisseur();
      await client?.rpc('compter_partie', { p_id: id });
    } catch { /* hors ligne : sans importance */ }
  }
}
