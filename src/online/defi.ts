import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import type { Resultat } from './classement';

/** Message quand la migration 0011 (défi du jour) n'est pas encore appliquée sur le serveur. */
export const MSG_DEFI_PAS_PRET = 'Le classement des défis n\'est pas encore ouvert sur le serveur : ton score reste sur l\'appareil.';

export interface DefiPasse { jour: string; pseudo: string | null; score: number | null; voiture: string | null; joueurs: number }
export interface RecompenseDefi { jour: string; rang: number; cles: number }

const absent = (e: { code?: unknown } | null): boolean => {
  const code = typeof e?.code === 'string' ? e.code : '';
  return code === '42883' || code.startsWith('PGRST2');
};

/** Défis passés (vainqueurs) et récompenses du podium (fonctions SQL de la migration 0011). */
export class DefiService {
  constructor(private readonly fournisseur: Fournisseur) {}

  async passes(jours = 7): Promise<Resultat<DefiPasse[]>> {
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('defis_passes', { p_jours: jours });
      if (error) return { ok: false, message: absent(error) ? 'Historique des défis bientôt disponible.' : messageErreur(error) };
      const lignes = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>): DefiPasse => ({
        jour: String(r.jour ?? '').slice(0, 10),
        pseudo: typeof r.pseudo === 'string' ? r.pseudo : null,
        score: r.score === null || r.score === undefined ? null : Number(r.score),
        voiture: typeof r.voiture === 'string' ? r.voiture : null,
        joueurs: Number(r.joueurs ?? 0) || 0,
      }));
      return { ok: true, valeur: lignes };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Crédite les clés du podium des défis terminés (une fois par défi) ; liste vide si rien de nouveau. */
  async reclamer(): Promise<Resultat<RecompenseDefi[]>> {
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('reclamer_recompenses_defi');
      if (error) return absent(error) ? { ok: true, valeur: [] } : { ok: false, message: messageErreur(error) };
      return {
        ok: true,
        valeur: (Array.isArray(data) ? data : []).map((r: Record<string, unknown>) => ({ jour: String(r.jour ?? '').slice(0, 10), rang: Number(r.rang), cles: Number(r.cles) })),
      };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }
}
