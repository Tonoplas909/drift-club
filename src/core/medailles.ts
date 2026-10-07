/**
 * Médailles des niveaux officiels : bronze, argent et or selon le score.
 * Seuils fixés par niveau, calés sur le temps cible (≈ 800, 1 500 et 2 300 points par seconde de temps cible,
 * arrondis au millier) : l'or demande une course du niveau des meilleurs du classement en ligne.
 */

export type Medaille = 'bronze' | 'argent' | 'or';

export const MEDAILLES: readonly Medaille[] = ['bronze', 'argent', 'or'];

export const NOMS_MEDAILLES: Record<Medaille, string> = { bronze: 'Bronze', argent: 'Argent', or: 'Or' };

/** [bronze, argent, or] par identifiant de niveau officiel. */
export const SEUILS_MEDAILLES: Record<string, readonly [number, number, number]> = {
  'premiers-virages': [39000, 73000, 111000],
  'foret-des-pins': [52000, 97000, 149000],
  'col-du-loup': [73000, 137000, 209000],
  'lacets-du-belvedere': [46000, 86000, 132000],
  'vallee-des-cretes': [40000, 75000, 116000],
  'circuit-du-lac': [44000, 83000, 128000],
  'epingles-du-diable': [51000, 95000, 145000],
  'cretes-nord': [74000, 138000, 212000],
  'descente-du-moulin': [54000, 100000, 154000],
  'grand-huit': [62000, 117000, 179000],
  'serpentin-des-aigles': [75000, 140000, 215000],
  'angles-droits': [70000, 132000, 202000],
  'spirale-du-belvedere': [78000, 147000, 225000],
  'trois-epingles': [58000, 108000, 166000],
  'chicanes-du-port': [70000, 131000, 201000],
  'grande-descente': [75000, 142000, 217000],
  'virages-en-cascade': [68000, 128000, 197000],
  'route-des-vignes': [52000, 97000, 149000],
  'touge-de-minuit': [64000, 119000, 183000],
  'tire-bouchon': [52000, 97000, 149000],
  'sentier-des-cerisiers': [42000, 78000, 120000],
  'col-du-torii': [59000, 110000, 169000],
  'dragon-de-jade': [93000, 175000, 268000],
  'baie-des-naufrages': [37000, 70000, 107000],
  'crique-du-perroquet': [47000, 88000, 135000],
  'recif-du-kraken': [70000, 131000, 201000],
  'orbite-basse': [46000, 85000, 131000],
  'cratere-rouge': [63000, 117000, 180000],
  'couloirs-jaunes': [50000, 94000, 144000],
  'labyrinthe-de-neons': [73000, 137000, 210000],
  'neo-shinjuku': [57000, 107000, 164000],
};

/** Meilleure médaille obtenue avec ce score, ou null. */
export function medaille(score: number, seuils: readonly [number, number, number]): Medaille | null {
  for (let i = MEDAILLES.length - 1; i >= 0; i--) if (score >= seuils[i]) return MEDAILLES[i];
  return null;
}

/** Prochaine médaille à viser et les points qui manquent, ou null si l'or est déjà là. */
export function prochaineMedaille(score: number, seuils: readonly [number, number, number]): { medaille: Medaille; manque: number } | null {
  const i = seuils.findIndex((s) => score < s);
  return i < 0 ? null : { medaille: MEDAILLES[i], manque: seuils[i] - score };
}
