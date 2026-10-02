import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import type { Rng } from './math/rng';
import { RARETES, RARETE_IDS, type Rarete } from './raretes';
import { SKINS, SKIN_DEFAUT, skinDef, skinValide, type SkinId } from './skins';
import { CLE_FUMEE, FUMEES, FUMEE_DEFAUT, fumeeDef, fumeeValide } from './fumees';

/** Collection d'objets des caisses : une voiture (ses livrées) ou `fumee` (les fumées de pneus). */
export type CleCollection = CarId | typeof CLE_FUMEE;

/** Toutes les collections, dans l'ordre du catalogue. */
export const COLLECTIONS: CleCollection[] = [...CAR_IDS, CLE_FUMEE];

export const estCollection = (v: unknown): v is CleCollection => typeof v === 'string' && (COLLECTIONS as string[]).includes(v);

/** Objet « par défaut » de la collection : toujours débloqué, absent des caisses (« unie », « classique »). */
export const defautDe = (cle: CleCollection): SkinId => (cle === CLE_FUMEE ? FUMEE_DEFAUT : SKIN_DEFAUT);

/** `id` existe-t-il dans la collection `cle` ? */
export const idValide = (cle: CleCollection, id: unknown): id is SkinId => (cle === CLE_FUMEE ? fumeeValide(id) : skinValide(cle, id));

/** Un objet des caisses : une livrée d'une voiture, ou une fumée (`car` vaut alors `fumee`), tel qu'il sort d'une caisse. */
export interface Objet { car: CleCollection; skin: SkinId; rarete: Rarete }

export const estFumee = (o: Pick<Objet, 'car'>): boolean => o.car === CLE_FUMEE;

/** Nom et description d'un objet des caisses (livrée ou fumée). */
export function infoObjet(o: Pick<Objet, 'car' | 'skin'>): { nom: string; description: string } {
  const d = o.car === CLE_FUMEE ? fumeeDef(o.skin) : skinDef(o.car, o.skin);
  return { nom: d.nom, description: d.description };
}

/** Objets débloqués par collection (« unie » et « classique » le sont toujours, qu'ils figurent ou non dans la liste). */
export type Inventaire = Partial<Record<CleCollection, SkinId[]>>;

export interface Tirage { objet: Objet; doublon: boolean }

/** Nombre de cartes de la bande de la roulette, et place de la gagnante (quelques cartes avant la fin, comme à CS:GO). */
export const TAILLE_BANDE = 60;
export const INDEX_GAGNANT = TAILLE_BANDE - 8;

/** Contenu des caisses par collection : les livrées de chaque voiture et les fumées, sans « unie » ni « classique ». */
export function contenuCaisses(): Record<string, { id: string; rarete: Rarete }[]> {
  const out: Record<string, { id: string; rarete: Rarete }[]> = {};
  for (const car of CAR_IDS) out[car] = SKINS[car].filter((s) => s.id !== SKIN_DEFAUT).map((s) => ({ id: s.id, rarete: s.rarete }));
  out[CLE_FUMEE] = FUMEES.filter((f) => f.id !== FUMEE_DEFAUT).map((f) => ({ id: f.id, rarete: f.rarete }));
  return out;
}

/** Contenu des caisses : toutes les livrées de toutes les voitures et toutes les fumées, rangées par rareté. */
function construireParRarete(): Record<Rarete, Objet[]> {
  const out = Object.fromEntries(RARETE_IDS.map((r) => [r, [] as Objet[]])) as Record<Rarete, Objet[]>;
  const contenu = contenuCaisses();
  for (const car of COLLECTIONS) for (const s of contenu[car]) out[s.rarete].push({ car, skin: s.id, rarete: s.rarete });
  return out;
}

const PAR_RARETE = construireParRarete();

export const catalogue = (): Objet[] => RARETE_IDS.flatMap((r) => PAR_RARETE[r]);
export const objetsDeRarete = (r: Rarete): readonly Objet[] => PAR_RARETE[r];

/** Rareté tirée selon les poids ; une rareté sans livrée est ignorée (les poids restants sont renormalisés). */
export function tirerRarete(rng: Rng): Rarete {
  const dispo = RARETE_IDS.filter((r) => PAR_RARETE[r].length > 0);
  const total = dispo.reduce((s, r) => s + RARETES[r].poids, 0);
  let x = rng() * total;
  for (const r of dispo) {
    x -= RARETES[r].poids;
    if (x < 0) return r;
  }
  return dispo[dispo.length - 1];
}

/** Livrée tirée sans tenir compte de l'inventaire : rareté par poids, puis livrée au hasard dans la rareté. */
export function tirerObjet(rng: Rng): Objet {
  const liste = PAR_RARETE[tirerRarete(rng)];
  return liste[Math.min(liste.length - 1, Math.floor(rng() * liste.length))];
}

export const estDebloque = (inv: Inventaire, car: CleCollection, skin: SkinId): boolean =>
  skin === defautDe(car) || (inv[car]?.includes(skin) ?? false);

/** Ouverture d'une caisse : le tirage et s'il s'agit d'un doublon (déjà débloquée dans `inv`). */
export function tirer(rng: Rng, inv: Inventaire): Tirage {
  const objet = tirerObjet(rng);
  return { objet, doublon: estDebloque(inv, objet.car, objet.skin) };
}

/**
 * Bande de la roulette : cartes de remplissage tirées selon les poids, `gagnant` à l'index fixe `indexGagnant`
 * (près de la fin, pour que la roulette passe devant beaucoup de cartes avant de s'arrêter).
 */
export function construireBande(rng: Rng, gagnant: Objet, n = TAILLE_BANDE, indexGagnant = n - 8): Objet[] {
  const idx = Math.max(0, Math.min(n - 1, indexGagnant));
  const bande = Array.from({ length: n }, () => tirerObjet(rng));
  bande[idx] = gagnant;
  return bande;
}
