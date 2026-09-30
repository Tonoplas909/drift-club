import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; message: string };

export interface LigneClassement {
  rang: number;
  pseudo: string;
  /** mode de conduite du score */
  mode: string;
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
  /** clés créditées par le serveur pour cette arrivée (arrivée + record) ; absent si le serveur n'a pas la progression en ligne */
  clesGagnees?: number;
  /** part « record » de ces clés (0 ou 1) */
  clesRecord?: number;
  /** total de clés du compte après l'envoi */
  cles?: number;
}

/** Place du joueur connecté sur un niveau (meilleur score tous modes). */
export interface MaPlace {
  rang: number;
  total: number;
  score: number;
  mode: string;
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

/** Envoi des scores et lecture du classement (fonctions SQL `soumettre_score` et `classement_niveau`). */
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
      const valeur: RangEnLigne = { ameliore: l.ameliore === true, rang: nombre(l.rang), total: nombre(l.total) };
      // colonnes ajoutées par la migration 0005 (progression du compte) : absentes des anciens serveurs
      if (l.cles_gagnees !== undefined && l.cles_gagnees !== null && Number.isFinite(nombre(l.cles_gagnees))) {
        valeur.clesGagnees = nombre(l.cles_gagnees);
        valeur.clesRecord = nombre(l.cles_record ?? 0);
        if (Number.isFinite(nombre(l.cles))) valeur.cles = nombre(l.cles);
      }
      return { ok: true, valeur };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Classement d'un niveau, tous modes confondus. */
  async chargerClassement(niveau: string, limite = 20): Promise<Resultat<LigneClassement[]>> {
    if (!cleEnLigne(niveau)) return { ok: false, message: "Ce niveau n'a pas de classement en ligne." };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('classement_niveau', { p_niveau: niveau, p_limite: limite });
      if (error) return { ok: false, message: messageErreur(error) };
      const lignes = (Array.isArray(data) ? data : []).map((r: Record<string, unknown>): LigneClassement => ({
        rang: nombre(r.rang), pseudo: String(r.pseudo ?? '?'), mode: String(r.mode ?? ''), score: nombre(r.score), temps: nombre(r.temps),
        voiture: String(r.voiture ?? ''), maj: String(r.maj ?? ''), joueur: String(r.joueur ?? ''),
      }));
      return { ok: true, valeur: lignes };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Places du joueur connecté sur plusieurs niveaux en un appel (niveaux sans score absents de la carte). */
  async mesPlaces(niveaux: string[]): Promise<Resultat<Map<string, MaPlace>>> {
    const cles = [...new Set(niveaux.filter(cleEnLigne))].slice(0, 200);
    if (cles.length === 0) return { ok: true, valeur: new Map() };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      const { data, error } = await client.rpc('mes_places', { p_niveaux: cles });
      if (error) return { ok: false, message: messageErreur(error) };
      const places = new Map<string, MaPlace>();
      for (const r of (Array.isArray(data) ? data : []) as Record<string, unknown>[]) {
        const rang = nombre(r.rang), total = nombre(r.total), score = nombre(r.score);
        if (typeof r.niveau === 'string' && rang >= 1 && total >= rang && Number.isFinite(score)) {
          places.set(r.niveau, { rang, total, score, mode: String(r.mode ?? '') });
        }
      }
      return { ok: true, valeur: places };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }
}
