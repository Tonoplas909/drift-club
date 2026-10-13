import type { Level } from './level/types';
import type { CarId, MotoId } from './physics/types';
import { niveauGenere } from './niveauGenere';

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

/** Clé du classement d'un défi : « jour:AAAA-MM-JJ », et « moto:jour:AAAA-MM-JJ » pour le défi à moto. */
export const cleDefi = (jour: string, moto = false): string => `${moto ? 'moto:' : ''}jour:${jour}`;

/**
 * Motos tirées pour le défi du jour à moto. Liste FIGÉE (comme `VEHICULES_DEFI`) : une nouvelle moto y entrerait à
 * partir d'une date fixée, sans changer les défis déjà joués.
 */
export const MOTOS_DEFI: readonly MotoId[] = ['supermotard', 'sportive'];

/** Moto imposée au défi à moto d'un jour (tirée de la date, indépendamment de la voiture). */
export function motoDuJour(jour: string): MotoId {
  return MOTOS_DEFI[(graineDuJour(jour) >>> 11) % MOTOS_DEFI.length];
}
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

/** Niveau du défi d'un jour et son véhicule imposé : la voiture tirée avec le niveau, ou la moto du jour. Même niveau pour les deux. */
export function defiDuJour(jour: string, moto = false): DefiDuJour {
  const { level, voiture } = niveauGenere(graineDuJour(jour), `Défi du ${jourEnClair(jour)}`);
  return { jour, level, voiture: moto ? motoDuJour(jour) : voiture };
}
