import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import type { Rng } from './math/rng';
import { SKIN_DEFAUT, type SkinId, type SkinsChoisies } from './skins';
import { FUMEE_DEFAUT, CLE_FUMEE, type FumeeId } from './fumees';
import { tirer, estDebloque, idValide, defautDe, COLLECTIONS, type CleCollection, type Tirage } from './caisses';

/** Toute l'économie du jeu au même endroit, pour l'ajuster facilement. */
export const ECONOMIE = {
  /** clés gagnées à chaque arrivée */
  clesParArrivee: 1,
  /** clés en plus pour un nouveau record local */
  clesRecord: 1,
  /** prix d'une caisse, en clés */
  coutCaisse: 3,
  /** caisses offertes au premier lancement (créditées en clés) */
  caissesOffertes: 1,
  /** clés rendues quand la livrée tirée est déjà débloquée */
  remboursementDoublon: 1,
} as const;

/** Progression locale du joueur (clés, livrées et fumées gagnées) ; « unie » et « classique » n'y figurent pas, toujours débloquées. */
export interface Progression {
  cles: number;
  debloques: Record<CleCollection, SkinId[]>;
  /** true quand la caisse offerte du premier lancement a déjà été créditée */
  caisseOfferte: boolean;
  /** nombre de caisses ouvertes */
  ouvertes: number;
}

const debloquesVides = (): Record<CleCollection, SkinId[]> => Object.fromEntries(COLLECTIONS.map((c) => [c, [] as SkinId[]])) as Record<CleCollection, SkinId[]>;

export const progressionVide = (): Progression => ({ cles: 0, debloques: debloquesVides(), caisseOfferte: false, ouvertes: 0 });

/** Ajoute `skin` aux objets débloqués de `car` (voiture ou `fumee` ; sans doublon, « unie » et « classique » ignorées). */
function avecDebloque(d: Record<CleCollection, SkinId[]>, car: CleCollection, skin: SkinId): Record<CleCollection, SkinId[]> {
  if (skin === defautDe(car) || !idValide(car, skin) || d[car].includes(skin)) return d;
  return { ...d, [car]: [...d[car], skin] };
}

/**
 * Première progression d'un joueur : les livrées déjà choisies au Garage restent débloquées (migration).
 * La caisse offerte n'est pas encore créditée : voir `offrirCaisse`.
 */
export function progressionInitiale(skinsChoisies: SkinsChoisies | undefined): Progression {
  let d = debloquesVides();
  for (const car of CAR_IDS) d = avecDebloque(d, car, skinsChoisies?.[car] ?? SKIN_DEFAUT);
  return { ...progressionVide(), debloques: d };
}

/** Nettoie une valeur lue du stockage : ids inconnus ou en double retirés, nombres bornés. */
export function validerProgression(raw: unknown): Progression {
  const p = progressionVide();
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return p;
  const o = raw as Record<string, unknown>;
  const entier = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
  p.cles = entier(o.cles);
  p.ouvertes = entier(o.ouvertes);
  p.caisseOfferte = o.caisseOfferte === true;
  const d = o.debloques;
  if (typeof d === 'object' && d !== null && !Array.isArray(d)) {
    for (const car of COLLECTIONS) {
      const l = (d as Record<string, unknown>)[car];
      if (Array.isArray(l)) for (const id of l) p.debloques = avecDebloque(p.debloques, car, id as SkinId);
    }
  }
  return p;
}

/** Crédite la caisse offerte du premier lancement, une seule fois. */
export function offrirCaisse(p: Progression): Progression {
  if (p.caisseOfferte) return p;
  return { ...p, caisseOfferte: true, cles: p.cles + ECONOMIE.caissesOffertes * ECONOMIE.coutCaisse };
}

export const livreeDebloquee = (p: Progression, car: CleCollection, skin: SkinId): boolean => estDebloque(p.debloques, car, skin);

/** Fumée de pneus débloquée ? (« classique » l'est toujours.) */
export const fumeeDebloquee = (p: Progression, id: FumeeId): boolean => estDebloque(p.debloques, CLE_FUMEE, id);

/** Ramène la fumée choisie à « classique » si elle n'est pas débloquée. */
export const fumeeAutorisee = (id: FumeeId, p: Progression): FumeeId => (fumeeDebloquee(p, id) ? id : FUMEE_DEFAUT);

/** Ramène chaque livrée choisie à « unie » si elle n'est pas débloquée. */
export function skinsAutorises(skins: SkinsChoisies, p: Progression): SkinsChoisies {
  const out: SkinsChoisies = {};
  for (const car of CAR_IDS) {
    const id = skins[car];
    if (id !== undefined) out[car] = id !== SKIN_DEFAUT && !livreeDebloquee(p, car, id) ? SKIN_DEFAUT : id;
  }
  return out;
}

export interface GainCourse { arrivee: number; record: number; total: number }

/** Clés gagnées à l'arrivée d'une course (bonus si nouveau record local). */
export function gagnerCourse(p: Progression, record: boolean): { progression: Progression; gain: GainCourse } {
  const arrivee = ECONOMIE.clesParArrivee, bonus = record ? ECONOMIE.clesRecord : 0;
  return { progression: { ...p, cles: p.cles + arrivee + bonus }, gain: { arrivee, record: bonus, total: p.cles + arrivee + bonus } };
}

export const peutOuvrir = (p: Progression): boolean => p.cles >= ECONOMIE.coutCaisse;

export interface Ouverture { progression: Progression; tirage: Tirage; remboursement: number }

/** Ouvre une caisse : paie le prix, tire une livrée, la débloque (ou rembourse le doublon). `null` si pas assez de clés. */
export function ouvrirCaisse(p: Progression, rng: Rng): Ouverture | null {
  if (!peutOuvrir(p)) return null;
  const tirage = tirer(rng, p.debloques);
  const remboursement = tirage.doublon ? ECONOMIE.remboursementDoublon : 0;
  const debloques = tirage.doublon ? p.debloques : avecDebloque(p.debloques, tirage.objet.car, tirage.objet.skin);
  return {
    progression: { ...p, debloques, cles: p.cles - ECONOMIE.coutCaisse + remboursement, ouvertes: p.ouvertes + 1 },
    tirage, remboursement,
  };
}
