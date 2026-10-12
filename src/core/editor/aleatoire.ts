import type { Environnement, Level } from '../level/types';
import { niveauGenere, graineDuDecor } from '../niveauGenere';
import { analyseLevel } from './analyse';

/** Espacements (m) essayés pour les points de contrôle : le plus large qui donne un niveau valide (moins de points à retoucher). */
const PAS_ESSAYES = [32, 24, 16];

/**
 * Niveau de départ de l'éditeur tiré de `tirage` (nombre au hasard choisi par l'appelant), dans le décor voulu ou
 * celui du tirage : route du mode Zen, barrières, zones de clipping. Pur et déterministe.
 */
export function niveauAleatoire(tirage: number, environnement?: Environnement): Level {
  const graine = environnement ? graineDuDecor(tirage, environnement) : tirage >>> 0;
  let dernier: Level | null = null;
  for (const pas of PAS_ESSAYES) {
    try {
      dernier = niveauGenere(graine, 'Niveau aléatoire', pas).level;
      if (analyseLevel(dernier).ok) break;
    } catch { /* espacement trop large : on essaie plus serré */ }
  }
  return dernier ?? niveauGenere(graine, 'Niveau aléatoire').level;
}
