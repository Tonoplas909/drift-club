import { mulberry32, type Rng } from '../core/math/rng';

/** Calculs de la roulette des caisses, sans DOM (testables) : courbe de décélération, arrêt et carte sous le repère. */

/** Durée de la roulette (ms) et version courte pour `prefers-reduced-motion`. */
export const DUREE_ROULETTE = 5600;
export const DUREE_ROULETTE_REDUITE = 1400;

const borne01 = (t: number): number => Math.max(0, Math.min(1, t));

/** Progression 0..1 du défilement à l'instant `t` ∈ [0, 1] : très rapide au départ, longue décélération (ease-out cubique) : les dernières cartes défilent lentement. */
export const easeOutRoulette = (t: number): number => 1 - Math.pow(1 - borne01(t), 3);

/**
 * Défilement final (px) de la bande : le repère (centre de la fenêtre) tombe sur la carte `index`, décalé de `decal` ∈ [-1, 1]
 * (fraction de 40 % de la largeur de la carte) — comme à CS:GO, on s'arrête rarement pile au milieu, mais toujours dans la carte.
 */
export function defilementFinal(index: number, pas: number, largeurCarte: number, largeurVue: number, decal: number): number {
  const d = Math.max(-1, Math.min(1, decal));
  return index * pas + largeurCarte / 2 + d * largeurCarte * 0.4 - largeurVue / 2;
}

/** Index de la carte sous le repère pour un défilement donné (une carte occupe `pas` px, écart compris). */
export function indexSousRepere(defilement: number, largeurVue: number, pas: number): number {
  return Math.max(0, Math.floor((defilement + largeurVue / 2) / pas));
}

/** Graine 32 bits aléatoire (crypto si disponible) : hors de core, le tirage réel n'est pas rejouable. */
export function graineAleatoire(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  } catch {
    return (Math.random() * 4294967296) >>> 0;
  }
}

export const nouvelRng = (): Rng => mulberry32(graineAleatoire());
