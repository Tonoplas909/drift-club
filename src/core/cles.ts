import type { CarId } from './physics/types';
import { estMotoId } from './physics/cars';

/**
 * Classements séparés des voitures et des motos : une course à moto est rangée sous la clé du niveau précédée de
 * « moto: » (« moto:off:col-du-loup », « moto:perso:… », « moto:jour:… » pour le défi du jour à moto). Records,
 * fantômes, médailles et classement en ligne des motos sont ainsi à part de ceux des voitures.
 */
export const PREFIXE_MOTO = 'moto:';

/** Clé de classement d'une course sur le niveau `cle` avec ce véhicule. */
export function cleVehicule(cle: string, voiture: CarId): string {
  return estMotoId(voiture) && !cle.startsWith(PREFIXE_MOTO) ? PREFIXE_MOTO + cle : cle;
}

export const estCleMoto = (cle: string): boolean => cle.startsWith(PREFIXE_MOTO);

/** Clé du niveau lui-même (sans le préfixe des motos). */
export const cleDuNiveau = (cle: string): string => (estCleMoto(cle) ? cle.slice(PREFIXE_MOTO.length) : cle);

/** Format des clés de classement en ligne (niveau officiel, perso, défi du jour ; motos à part). */
export const FORMAT_CLE_EN_LIGNE = /^(moto:)?((off|perso):[A-Za-z0-9_-]{1,80}|jour:\d{4}-\d{2}-\d{2})$/;
