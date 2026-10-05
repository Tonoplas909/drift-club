import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import type { Progression } from '../core/economie';
import type { Objet } from '../core/caisses';
import { lireObjetServeur, lireProgressionCompte, type ProgressionCompte } from '../core/progressionCompte';

/** Pourquoi un appel a échoué : `absent` = le SQL de la progression n'est pas installé, `reseau` = injoignable. */
export type RaisonEchec = 'absent' | 'reseau' | 'autre';
export type EchecProgression = { ok: false; message: string; raison: RaisonEchec };
export type ResultatProgression<T> = { ok: true; valeur: T } | EchecProgression;

/** Livrée tirée par le serveur et clés restantes. */
export interface OuvertureServeur { objet: Objet; doublon: boolean; cles: number }

const premiere = (data: unknown): unknown => (Array.isArray(data) ? data[0] : data);

function echec(err: unknown): EchecProgression {
  const message = messageErreur(err);
  const code = err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : '';
  // fonction ou table absente : les migrations 0005/0006 ne sont pas encore passées
  const absent = code === '42883' || code === '42P01' || code.startsWith('PGRST2');
  return { ok: false, message, raison: absent ? 'absent' : message === MSG_INDISPONIBLE ? 'reseau' : 'autre' };
}

const INDISPONIBLE: EchecProgression = { ok: false, message: MSG_INDISPONIBLE, raison: 'reseau' };
const INATTENDU: EchecProgression = { ok: false, message: 'Réponse inattendue du serveur.', raison: 'autre' };

/**
 * Progression du compte (clés, livrées) : fonctions SQL `ma_progression` et `ouvrir_caisse`.
 * Le serveur fait foi ; le client ne fait que lire et demander. Chaque méthode échoue en douceur (message français).
 */
export class ProgressionEnLigne {
  constructor(private readonly fournisseur: Fournisseur) {}

  /** Lit la progression du compte (créée avec les 3 clés offertes à la première demande). */
  async charger(): Promise<ResultatProgression<ProgressionCompte>> {
    return this.appelerLigne('ma_progression', {});
  }

  /** Ouvre une caisse : le serveur paie 3 clés, tire la livrée et la débloque ; l'écran n'a plus qu'à l'animer. */
  async ouvrirCaisse(): Promise<ResultatProgression<OuvertureServeur>> {
    try {
      const client = await this.fournisseur();
      if (!client) return INDISPONIBLE;
      const { data, error } = await client.rpc('ouvrir_caisse');
      if (error) return echec(error);
      const o = lireObjetServeur(premiere(data));
      return o ? { ok: true, valeur: o } : { ok: false, message: 'Cette livrée est trop récente pour ta version du jeu : recharge la page.', raison: 'autre' };
    } catch (e) {
      return echec(e);
    }
  }

  private async appelerLigne(fonction: string, args: Record<string, unknown>): Promise<ResultatProgression<ProgressionCompte>> {
    try {
      const client = await this.fournisseur();
      if (!client) return INDISPONIBLE;
      const { data, error } = await client.rpc(fonction, args);
      if (error) return echec(error);
      const c = lireProgressionCompte(premiere(data));
      return c ? { ok: true, valeur: c } : INATTENDU;
    } catch (e) {
      return echec(e);
    }
  }
}
