import type { Ambiance, Barriere, Level, Meteo, PointRoute } from './level/types';
import { LIMITES } from './level/types';
import type { CarId } from './physics/types';
import { CAR_IDS } from './physics/cars';
import { mulberry32 } from './math/rng';
import { Dessinateur } from './zen/designer';
import { Regions } from './zen/regions';
import { buildTrack } from './track/buildTrack';
import { zonesAutomatiques } from './track/clipping';
import { validateLevel } from './level/validate';

/**
 * Défi du jour : chaque jour, un niveau tiré de la date (route tracée par le dessinateur du mode Zen), avec une
 * voiture, une ambiance et une météo imposées. Pur et déterministe : le serveur reconstruit le même niveau pour
 * vérifier les scores. Le jour est une date « AAAA-MM-JJ » (heure de Paris, choisie hors de ce module).
 */
export interface DefiDuJour {
  jour: string;
  level: Level;
  voiture: CarId;
}

/** Clé du classement d'un défi : « jour:AAAA-MM-JJ ». */
export const cleDefi = (jour: string): string => `jour:${jour}`;
export const estJourValide = (jour: string): boolean => /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(jour);

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 7 octobre » pour « 2026-10-07 ». */
export function jourEnClair(jour: string): string {
  const [, m, d] = jour.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MOIS[m - 1] ?? ''}`.trim();
}

/** Graine tirée de la date (FNV-1a 32 bits). */
export function graineDuJour(jour: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < jour.length; i++) { h ^= jour.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** espacement (m) des points de contrôle repris sur la route dessinée */
const PAS_POINTS = 16;

/** Niveau du défi d'un jour (et sa voiture imposée). */
export function defiDuJour(jour: string): DefiDuJour {
  const graine = graineDuJour(jour);
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
  for (let s = 0; s <= longueur; s += PAS_POINTS) {
    const sp = dessin.echantillon(Math.min(longueur, s));
    const l = Math.min(LIMITES.largeurMax, Math.max(LIMITES.largeurMin, Math.round(sp.w * 20) / 10));
    route.push({ x: Math.round(sp.x * 10) / 10, z: Math.round(sp.z * 10) / 10, y: Math.round(sp.y * 10) / 10, l });
  }

  const brouillon: Level = {
    format: 1, nom: `Défi du ${jourEnClair(jour)}`, auteur: 'Drift Club', environnement, ambiance,
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
  if (!v.ok) throw new Error(`Défi du ${jour} invalide : ${v.erreurs.join(' ')}`);
  return { jour, level: v.level, voiture };
}
