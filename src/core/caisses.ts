import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import type { Rng } from './math/rng';
import { RARETES, RARETE_IDS, type Rarete } from './raretes';
import { SKINS, SKIN_DEFAUT, type SkinId } from './skins';

/** Une livrée d'une voiture, telle qu'elle sort d'une caisse. */
export interface Objet { car: CarId; skin: SkinId; rarete: Rarete }

/** Livrées débloquées par voiture (« unie » l'est toujours, qu'elle figure ou non dans la liste). */
export type Inventaire = Partial<Record<CarId, SkinId[]>>;

export interface Tirage { objet: Objet; doublon: boolean }

/** Nombre de cartes de la bande de la roulette, et place de la gagnante (quelques cartes avant la fin, comme à CS:GO). */
export const TAILLE_BANDE = 60;
export const INDEX_GAGNANT = TAILLE_BANDE - 8;

/** Contenu des caisses : toutes les livrées de toutes les voitures, sauf « unie », rangées par rareté. */
function construireParRarete(): Record<Rarete, Objet[]> {
  const out = Object.fromEntries(RARETE_IDS.map((r) => [r, [] as Objet[]])) as Record<Rarete, Objet[]>;
  for (const car of CAR_IDS) {
    for (const s of SKINS[car]) if (s.id !== SKIN_DEFAUT) out[s.rarete].push({ car, skin: s.id, rarete: s.rarete });
  }
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

export const estDebloque = (inv: Inventaire, car: CarId, skin: SkinId): boolean =>
  skin === SKIN_DEFAUT || (inv[car]?.includes(skin) ?? false);

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
