import type { Ambiance, Barriere, Environnement, Level, Meteo, PointRoute } from './level/types';
import { LIMITES } from './level/types';
import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import { mulberry32 } from './math/rng';
import { Dessinateur } from './zen/designer';
import { Regions } from './zen/regions';
import { buildTrack } from './track/buildTrack';
import { zonesAutomatiques } from './track/clipping';
import { validateLevel } from './level/validate';

/** espacement (m) des points de contrôle repris sur la route dessinée (défi du jour ; l'éditeur en prend moins) */
const PAS_POINTS = 16;

/** Niveau tracé à partir d'une graine, et la voiture tirée avec lui (imposée dans le défi du jour). */
export interface NiveauGenere {
  level: Level;
  voiture: CarId;
}

/**
 * Niveau tiré d'une graine : route tracée par le dessinateur du mode Zen dans le décor de la première région,
 * ambiance, météo, longueur et densité du décor tirées au sort, barrières à l'extérieur des épingles et zones de
 * clipping sur les plus grands virages. Sert au défi du jour (le serveur le reconstruit) et à l'éditeur.
 */
export function niveauGenere(graine: number, nom: string, pas = PAS_POINTS): NiveauGenere {
  const rng = mulberry32(graine ^ 0x5eed);
  const voiture = CAR_IDS[Math.floor(rng() * CAR_IDS.length)];
  const t = rng();
  const ambiance: Ambiance = t < 0.45 ? 'jour' : t < 0.75 ? 'coucher' : 'nuit';
  const meteo: Meteo | undefined = rng() < 0.25 ? 'pluie' : undefined;
  const longueur = 1200 + Math.floor(rng() * 700);
  const densite = Math.round((0.5 + rng() * 0.35) * 100) / 100;

  // la route : le dessinateur du mode Zen, dans le décor de la première région de la graine
  const regions = new Regions(graine);
  const environnement = regions.region(0).theme;
  const dessin = new Dessinateur(graine, regions);
  dessin.genererJusqua(longueur + 1);
  const route: PointRoute[] = [];
  for (let s = 0; s <= longueur; s += pas) {
    const sp = dessin.echantillon(Math.min(longueur, s));
    const l = Math.min(LIMITES.largeurMax, Math.max(LIMITES.largeurMin, Math.round(sp.w * 20) / 10));
    route.push({ x: Math.round(sp.x * 10) / 10, z: Math.round(sp.z * 10) / 10, y: Math.round(sp.y * 10) / 10, l });
  }

  const brouillon: Level = {
    format: 1, nom, auteur: 'Drift Club', environnement, ambiance,
    route, barrieres: [], decor: { graine: graine & 0x7fffffff, densite }, objets: [],
    ...(meteo ? { meteo } : {}),
  };
  // barrières à l'extérieur des épingles (rayon < 30 m), zones de clipping sur les plus grands virages
  const track = buildTrack(brouillon);
  const barrieres: Barriere[] = [];
  for (let i = 0; i < route.length - 1; i++) {
    let kMax = 0;
    for (let j = track.pointSample[i]; j <= track.pointSample[i + 1]; j++) kMax = Math.max(kMax, Math.abs(track.samples[j].k));
    if (kMax <= 1 / 30) continue;
    const der = barrieres[barrieres.length - 1];
    if (der && der.a === i) der.a = i + 1;
    else barrieres.push({ de: i, a: i + 1, cote: 'ext' });
  }
  const clipping = zonesAutomatiques(brouillon, track, Math.max(2, Math.min(4, Math.round(track.length / 400))));
  const level: Level = { ...brouillon, barrieres, ...(clipping.length > 0 ? { clipping } : {}) };
  const v = validateLevel(level);
  if (!v.ok) throw new Error(`Niveau généré (graine ${graine}) invalide : ${v.erreurs.join(' ')}`);
  return { level: v.level, voiture };
}

/** Essais au plus pour trouver une graine dont la première région a le décor voulu. */
const ESSAIS_DECOR = 400;

/**
 * Graine proche de `graine` (graine, graine + 1…) dont le niveau généré est dans le décor `environnement` : la route
 * garde ainsi le style de ce décor. `graine` elle-même si aucune ne convient.
 */
export function graineDuDecor(graine: number, environnement: Environnement): number {
  for (let k = 0; k < ESSAIS_DECOR; k++) {
    const g = (graine + k) >>> 0;
    if (new Regions(g).region(0).theme === environnement) return g;
  }
  return graine >>> 0;
}
