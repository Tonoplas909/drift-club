import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import type { Resultat } from './classement';
import type { Rarete } from '../core/raretes';
import { lireLivreeOfficielle, validerLivree, type LivreeAtelier, type LivreeOfficielle } from '../core/atelier';

export type StatutProposition = 'proposee' | 'validee' | 'refusee';

/** Proposition du joueur (écran « Mes propositions ») ou à modérer (administrateur). */
export interface Proposition {
  id: string;
  livree: LivreeAtelier;
  statut: StatutProposition;
  rarete: Rarete | null;
  motifRefus: string | null;
  /** pseudo de l'auteur (modération seulement) */
  pseudo: string;
  creeLe: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUTS: StatutProposition[] = ['proposee', 'validee', 'refusee'];
const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);

/** Ligne de `mes_livrees` ou `livrees_a_moderer` ; null si elle n'a pas la forme attendue ou si la livrée est invalide. */
function lireProposition(r: unknown): Proposition | null {
  const o = objet(r);
  if (!o || typeof o.id !== 'string' || !UUID.test(o.id)) return null;
  const d = objet(o.donnees) ?? {};
  const v = validerLivree({ ...d, voiture: o.voiture, nom: o.nom, description: o.description });
  if (!v.ok) return null;
  const statut = STATUTS.includes(o.statut as StatutProposition) ? (o.statut as StatutProposition) : 'proposee';
  return {
    id: o.id.toLowerCase(), livree: v.livree, statut,
    rarete: typeof o.rarete === 'string' ? (o.rarete as Rarete) : null,
    motifRefus: typeof o.motif_refus === 'string' ? o.motif_refus.slice(0, 200) : null,
    pseudo: typeof o.pseudo === 'string' ? o.pseudo : '',
    creeLe: typeof o.cree_le === 'string' ? o.cree_le : '',
  };
}

const lignes = <T>(data: unknown, lire: (r: unknown) => T | null): T[] =>
  (Array.isArray(data) ? data : []).map(lire).filter((x): x is T => x !== null);

/**
 * Atelier en ligne (fonctions SQL de `0010_atelier.sql`). Chaque méthode échoue en douceur : tant que la migration
 * n'est pas passée, le jeu garde simplement ses livrées habituelles.
 */
export class AtelierEnLigne {
  constructor(private readonly fournisseur: Fournisseur) {}

  private async appeler<T>(fonction: string, args: Record<string, unknown>, lire: (data: unknown) => T): Promise<Resultat<T>> {
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc(fonction, args);
      if (error) return { ok: false, message: messageErreur(error) };
      return { ok: true, valeur: lire(data) };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Livrées validées (lisibles sans compte) ; celles qui ne passent pas la validation locale sont ignorées. */
  officielles(): Promise<Resultat<LivreeOfficielle[]>> {
    return this.appeler('livrees_officielles', {}, (d) => lignes(d, lireLivreeOfficielle));
  }

  /** Envoie une proposition (déjà validée par l'éditeur ; le serveur re-contrôle et limite le nombre d'envois). */
  proposer(l: LivreeAtelier): Promise<Resultat<string>> {
    const v = validerLivree(l);
    if (!v.ok) return Promise.resolve({ ok: false, message: v.erreurs[0] });
    const { voiture, nom, description, couleurForcee, elements } = v.livree;
    return this.appeler('proposer_livree', {
      p_voiture: voiture, p_nom: nom, p_description: description, p_donnees: { elements, ...(couleurForcee ? { couleurForcee } : {}) },
    }, (d) => String(d ?? ''));
  }

  mesPropositions(): Promise<Resultat<Proposition[]>> {
    return this.appeler('mes_livrees', {}, (d) => lignes(d, lireProposition));
  }

  /** Vrai si le compte connecté peut modérer (faux si la migration n'est pas passée ou hors connexion). */
  async estAdmin(): Promise<boolean> {
    const r = await this.appeler('est_admin', {}, (d) => d === true);
    return r.ok && r.valeur;
  }

  aModerer(): Promise<Resultat<Proposition[]>> {
    return this.appeler('livrees_a_moderer', {}, (d) => lignes(d, lireProposition));
  }

  /** Valide (avec la rareté choisie) ou refuse (avec un motif facultatif) une proposition. */
  moderer(id: string, decision: { valider: true; rarete: Rarete } | { valider: false; motif: string }): Promise<Resultat<null>> {
    return this.appeler('moderer_livree', {
      p_id: id, p_valider: decision.valider,
      p_rarete: decision.valider ? decision.rarete : null,
      p_motif: decision.valider ? null : decision.motif,
    }, () => null);
  }
}

