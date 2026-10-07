import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import { lireStatistiques, type Statistiques } from '../game/statistiques';

export type ResultatStats<T> = { ok: true; valeur: T } | { ok: false; raison: 'absent' | 'reseau' | 'erreur'; message: string };

const absent = (e: { code?: unknown } | null): boolean => {
  const code = typeof e?.code === 'string' ? e.code : '';
  return code === '42883' || code === '42P01' || code.startsWith('PGRST2');
};

/** Statistiques du pilote rattachées au compte (fonctions SQL de la migration 0013). */
export class StatistiquesEnLigne {
  constructor(private readonly fournisseur: Fournisseur) {}

  private async appeler<T>(fonction: string, args: Record<string, unknown>, lire: (d: unknown) => T): Promise<ResultatStats<T>> {
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, raison: 'reseau', message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc(fonction, args);
      if (error) return { ok: false, raison: absent(error) ? 'absent' : 'erreur', message: messageErreur(error) };
      return { ok: true, valeur: lire(data) };
    } catch (e) {
      return { ok: false, raison: 'reseau', message: messageErreur(e) };
    }
  }

  /** Total du compte connecté, ou null s'il n'a encore rien envoyé. */
  charger(): Promise<ResultatStats<Statistiques | null>> {
    return this.appeler('mes_statistiques', {}, (d) => (d && typeof d === 'object' ? lireStatistiques(d) : null));
  }

  /** Ajoute au total du compte (le serveur additionne) et renvoie le nouveau total. */
  ajouter(ajout: Statistiques): Promise<ResultatStats<Statistiques>> {
    return this.appeler('ajouter_statistiques', { p_ajout: ajout }, (d) => lireStatistiques(d));
  }
}
