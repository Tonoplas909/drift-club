/**
 * Vérification d'une course côté serveur (Edge Function Supabase `verifier-course`).
 *
 * Ce module est empaqueté avec la simulation et les niveaux officiels par `tools/gen-fonction.ts` dans
 * `supabase/functions/verifier-course/course.js`. Il ne dépend ni du DOM ni de Deno : le même code tourne
 * dans les tests.
 */
import { NIVEAUX_OFFICIELS } from '../levels';
import { prepareLevel } from '../game/prepare';
import { empreinteNiveau } from '../core/level/fingerprint';
import { CAR_IDS } from '../core/physics/cars';
import { MODE_IDS } from '../core/physics/assists';
import type { CarId, ModeId } from '../core/physics/types';
import { depuisBase64, decompresserReplay } from '../core/replay/replay';
import { verifierCourse, PAS_MAX, type Verdict } from '../core/replay/verifier';

/** Ce que le jeu envoie à la fin d'une course. */
export interface DemandeCourse {
  /** empreinte de la simulation du jeu (voir `src/online/empreinteSimulation.ts`) */
  version: string;
  niveau: string;
  mode: string;
  voiture: string;
  score: number;
  temps: number;
  meilleurDrift: number;
  /** replay en base64 */
  replay: string;
  compression: 'deflate-raw' | 'aucune';
  /** contenu d'un niveau perso (absent pour un niveau officiel) */
  level?: unknown;
}

export type ReponseCourse =
  | { ok: true; verdict: Exclude<Verdict, { statut: 'refuse' }>; niveau: string; mode: ModeId; voiture: CarId }
  | { ok: false; code: 'version' | 'demande' | 'refuse'; message: string };

/** Taille maximale du replay envoyé (base64) et une fois décompressé. */
const MAX_BASE64 = 600_000;
const MAX_OCTETS = PAS_MAX * 6 + 16;

const refus = (code: 'version' | 'demande' | 'refuse', message: string): ReponseCourse => ({ ok: false, code, message });
const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nombreFini = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Valide la demande, retrouve le niveau, rejoue la course et rend le verdict. */
export async function traiterCourse(corps: unknown, empreinteServeur: string): Promise<ReponseCourse> {
  if (!estObjet(corps)) return refus('demande', 'Demande invalide.');
  const d = corps as Partial<DemandeCourse>;
  if (d.version !== empreinteServeur) {
    return refus('version', "Le jeu et le serveur de scores n'ont pas la même version : recharge la page pour envoyer tes scores.");
  }
  if (typeof d.niveau !== 'string' || !/^(off|perso):[A-Za-z0-9_-]{1,80}$/.test(d.niveau)) return refus('demande', 'Niveau invalide.');
  if (typeof d.mode !== 'string' || !(MODE_IDS as string[]).includes(d.mode)) return refus('demande', 'Mode invalide.');
  if (typeof d.voiture !== 'string' || !(CAR_IDS as string[]).includes(d.voiture)) return refus('demande', 'Voiture invalide.');
  if (!nombreFini(d.score) || !nombreFini(d.temps) || !nombreFini(d.meilleurDrift)) return refus('demande', 'Score invalide.');
  if (typeof d.replay !== 'string' || d.replay.length > MAX_BASE64) return refus('demande', 'Replay invalide.');

  // Le niveau : officiel (embarqué dans la fonction) ou perso (envoyé, et contrôlé par son empreinte).
  let brut: unknown;
  if (d.niveau.startsWith('off:')) {
    const id = d.niveau.slice(4);
    brut = NIVEAUX_OFFICIELS.find((n) => n.id === id)?.data;
    if (brut === undefined) return refus('demande', 'Niveau officiel inconnu.');
  } else {
    if (d.level === undefined) return refus('demande', 'Contenu du niveau manquant.');
    brut = d.level;
  }
  const prep = prepareLevel(d.niveau, brut);
  if (!prep.ok) return refus('refuse', 'Niveau invalide.');
  if (d.niveau.startsWith('perso:') && `perso:${await empreinteNiveau(prep.prepared.level)}` !== d.niveau) {
    return refus('refuse', 'Le niveau envoyé ne correspond pas à son empreinte.');
  }

  const compresse = depuisBase64(d.replay);
  if (!compresse) return refus('demande', 'Replay invalide.');
  const octets = d.compression === 'deflate-raw' ? await decompresserReplay(compresse, MAX_OCTETS)
    : d.compression === 'aucune' && compresse.length <= MAX_OCTETS ? compresse : null;
  if (!octets) return refus('demande', 'Replay invalide.');

  const mode = d.mode as ModeId, voiture = d.voiture as CarId;
  const verdict = verifierCourse(prep.prepared, voiture, mode, octets, { score: d.score, temps: d.temps, meilleurDrift: d.meilleurDrift });
  if (verdict.statut === 'refuse') return refus('refuse', verdict.raison);
  return { ok: true, verdict, niveau: d.niveau, mode, voiture };
}
