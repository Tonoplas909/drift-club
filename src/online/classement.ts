import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; message: string };

export interface LigneClassement {
  rang: number;
  pseudo: string;
  score: number;
  temps: number;
  voiture: string;
  maj: string;
  joueur: string;
}

export interface ScoreEnvoye {
  niveau: string;
  mode: string;
  score: number;
  temps: number;
  voiture: string;
  meilleurDrift: number;
}

export interface RangEnLigne {
  /** vrai si ce score bat le meilleur score en ligne du joueur */
  ameliore: boolean;
  rang: number;
  total: number;
}

/** Seuls les niveaux officiels et perso ont un classement (même règle que le SQL). */
export function cleEnLigne(cle: string): boolean {
  return /^(off|perso):[A-Za-z0-9_-]{1,80}$/.test(cle);
}

const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const premiere = (data: unknown): Record<string, unknown> | null => {
  const l = Array.isArray(data) ? data[0] : data;
  return l && typeof l === 'object' ? (l as Record<string, unknown>) : null;
};

/** Envoi des scores et lecture du classement (fonctions SQL `soumettre_score` et `classement`). */
export class ClassementService {
  constructor(private readonly fournisseur: Fournisseur) {}

  async soumettreScore(s: ScoreEnvoye): Promise<Resultat<RangEnLigne>> {
    if (!cleEnLigne(s.niveau)) return { ok: false, message: "Ce niveau n'a pas de classement en ligne." };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const score = Math.round(s.score);
      const { data, error } = await client.rpc('soumettre_score', {
        p_niveau: s.niveau, p_mode: s.mode, p_score: score, p_temps: s.temps, p_voiture: s.voiture,
        p_meilleur_drift: Math.min(Math.round(s.meilleurDrift), score),
      });
      if (error) return { ok: false, message: messageErreur(error) };
      const l = premiere(data);
      if (!l) return { ok: false, message: 'Réponse inattendue du classement.' };
      return { ok: true, valeur: { ameliore: l.ameliore === true, rang: nombre(l.rang), total: nombre(l.total) } };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  async chargerClassement(niveau: string, mode: string, limite = 20): Promise<Resultat<LigneClassement[]>> {
    if (!cleEnLigne(niveau)) return { ok: false, message: "Ce niveau n'a pas de classement en ligne." };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('classement', { p_niveau: niveau, p_mode: mode, p_limite: limite });
      if (error) return { ok: false, message: messageErreur(error) };
      const lignes = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>): LigneClassement => ({
        rang: nombre(r.rang), pseudo: String(r.pseudo ?? '?'), score: nombre(r.score), temps: nombre(r.temps),
        voiture: String(r.voiture ?? ''), maj: String(r.maj ?? ''), joueur: String(r.joueur ?? ''),
      }));
      return { ok: true, valeur: lignes };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }
}
