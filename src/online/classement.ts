import type { SupabaseClient } from '@supabase/supabase-js';
import type { Fournisseur } from './client';
import { messageErreur, MSG_INDISPONIBLE } from './erreurs';
import { EMPREINTE_SIMULATION } from './empreinteSimulation';
import { compresserReplay, versBase64 } from '../core/replay/replay';
import { MSG_DEFI_PAS_PRET } from './defi';

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
  /** replay de la course (vérifiée par le serveur) et, pour un niveau perso, son contenu */
  course?: { replay: Uint8Array; level?: unknown };
}

/** Résultat de la vérification du score par le serveur (course rejouée). */
export interface Verification {
  /** conforme : le score envoyé est gardé ; corrige : le serveur a gardé le score de la course rejouée */
  statut: 'conforme' | 'corrige';
  /** score enregistré */
  score: number;
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
  /** absent si le score a été envoyé sans vérification (serveur pas encore équipé) */
  verification?: Verification;
}

/** Place du joueur connecté sur un niveau (meilleur score tous modes). */
export interface MaPlace {
  rang: number;
  total: number;
  score: number;
  mode: string;
}

/** Seuls les niveaux officiels, perso et les défis du jour ont un classement (même règle que le SQL). */
export function cleEnLigne(cle: string): boolean {
  return /^((off|perso):[A-Za-z0-9_-]{1,80}|jour:\d{4}-\d{2}-\d{2})$/.test(cle);
}

const nombre = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const premiere = (data: unknown): Record<string, unknown> | null => {
  const l = Array.isArray(data) ? data[0] : data;
  return l && typeof l === 'object' ? (l as Record<string, unknown>) : null;
};

/** Ligne renvoyée par `soumettre_score` (ou par la vérification, qui renvoie les mêmes colonnes). */
function lireRang(data: unknown): RangEnLigne | null {
  const l = premiere(data);
  if (!l) return null;
  const valeur: RangEnLigne = { ameliore: l.ameliore === true, rang: nombre(l.rang), total: nombre(l.total) };
  // colonnes ajoutées par la migration 0005 (progression du compte) : absentes des anciens serveurs
  if (l.cles_gagnees !== undefined && l.cles_gagnees !== null && Number.isFinite(nombre(l.cles_gagnees))) {
    valeur.clesGagnees = nombre(l.cles_gagnees);
    valeur.clesRecord = nombre(l.cles_record ?? 0);
    if (Number.isFinite(nombre(l.cles))) valeur.cles = nombre(l.cles);
  }
  return valeur;
}

/** Envoi des scores et lecture du classement (fonctions SQL `soumettre_score` et `classement_niveau`). */
export class ClassementService {
  constructor(private readonly fournisseur: Fournisseur) {}

  /**
   * Envoie un score. Avec un replay, la course est vérifiée par l'Edge Function `verifier-course`, qui la rejoue ;
   * si la fonction n'est pas (encore) déployée, on retombe sur l'ancienne fonction SQL `soumettre_score`.
   */
  async soumettreScore(s: ScoreEnvoye): Promise<Resultat<RangEnLigne>> {
    const r = await this.soumettre(s);
    // défi du jour refusé par un serveur sans la migration 0011 : on le dit clairement
    if (!r.ok && s.niveau.startsWith('jour:') && r.message === 'Niveau invalide.') return { ok: false, message: MSG_DEFI_PAS_PRET };
    return r;
  }

  private async soumettre(s: ScoreEnvoye): Promise<Resultat<RangEnLigne>> {
    if (!cleEnLigne(s.niveau)) return { ok: false, message: "Ce niveau n'a pas de classement en ligne." };
    try {
      const client = await this.fournisseur();
      if (!client) return { ok: false, message: MSG_INDISPONIBLE };
      if (s.course) {
        const r = await this.envoyerCourse(client, s, s.course);
        if (r !== 'indisponible') return r;
      }
      const score = Math.round(s.score);
      const { data, error } = await client.rpc('soumettre_score', {
        p_niveau: s.niveau, p_mode: s.mode, p_score: score, p_temps: s.temps, p_voiture: s.voiture,
        p_meilleur_drift: Math.min(Math.round(s.meilleurDrift), score),
      });
      if (error) {
        // fonction SQL fermée (migration 0008) alors que la vérification ne répond pas
        if ((error as { code?: unknown }).code === '42501') return { ok: false, message: "La vérification des scores ne répond pas : score gardé en local. Réessaie plus tard." };
        return { ok: false, message: messageErreur(error) };
      }
      const valeur = lireRang(data);
      return valeur ? { ok: true, valeur } : { ok: false, message: 'Réponse inattendue du classement.' };
    } catch (e) {
      return { ok: false, message: messageErreur(e) };
    }
  }

  /** Envoi vérifié ; 'indisponible' si la fonction ou son SQL ne sont pas installés (on passe à l'ancien envoi). */
  private async envoyerCourse(client: SupabaseClient, s: ScoreEnvoye, c: { replay: Uint8Array; level?: unknown }): Promise<Resultat<RangEnLigne> | 'indisponible'> {
    const compresse = await compresserReplay(c.replay);
    const corps = {
      version: EMPREINTE_SIMULATION, niveau: s.niveau, mode: s.mode, voiture: s.voiture,
      score: s.score, temps: s.temps, meilleurDrift: s.meilleurDrift,
      replay: versBase64(compresse ?? c.replay), compression: compresse ? 'deflate-raw' : 'aucune',
      ...(c.level !== undefined && s.niveau.startsWith('perso:') ? { level: c.level } : {}),
    };
    const { data, error } = await client.functions.invoke('verifier-course', { body: corps });
    if (error) {
      // hors ligne : inutile d'essayer l'ancien envoi
      const nom = (error as { name?: unknown }).name;
      if (nom === 'FunctionsFetchError') return { ok: false, message: MSG_INDISPONIBLE };
      return 'indisponible';
    }
    const d = data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
    if (!d) return 'indisponible';
    if (d.ok !== true) {
      if (d.code === 'indisponible') return 'indisponible';
      return { ok: false, message: typeof d.message === 'string' && d.message ? d.message : 'Score refusé par le serveur.' };
    }
    const valeur = lireRang(d);
    if (!valeur) return { ok: false, message: 'Réponse inattendue du classement.' };
    if ((d.statut === 'conforme' || d.statut === 'corrige') && Number.isFinite(nombre(d.score))) {
      valeur.verification = { statut: d.statut, score: nombre(d.score) };
    }
    return { ok: true, valeur };
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
