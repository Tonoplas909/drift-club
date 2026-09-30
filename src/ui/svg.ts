/** Petites icônes SVG en ligne (Garage, caisses, résultats) : balisage statique, aucune donnée saisie n'y entre sauf des couleurs #rrggbb validées. */

const enSpan = (classe: string, svg: string): HTMLSpanElement => {
  const s = document.createElement('span');
  s.className = classe;
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = svg;
  return s;
};

const hexOk = (c: string, repli: string): string => (/^#[0-9a-f]{6}$/i.test(c) ? c : repli);

/** Clé (monnaie du jeu). */
export function iconeCle(classe = 'ico-cle'): HTMLSpanElement {
  return enSpan(classe, '<svg viewBox="0 0 24 24" width="1em" height="1em"><circle cx="8" cy="12" r="5" fill="#ffd23f" stroke="#15131c" stroke-width="2"/><circle cx="8" cy="12" r="1.6" fill="#15131c"/><path d="M12.5 12H22M18 12v4M21 12v3" fill="none" stroke="#15131c" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12.5 12H22M18 12v4M21 12v3" fill="none" stroke="#ffd23f" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>');
}

/** Cadenas des livrées verrouillées. */
export function iconeCadenas(classe = 'ico-cadenas'): HTMLSpanElement {
  return enSpan(classe, '<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#15131c" stroke-width="2.6" stroke-linecap="round"/><rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="#ffd23f" stroke="#15131c" stroke-width="2"/><circle cx="12" cy="15.5" r="1.7" fill="#15131c"/></svg>');
}

/** Petite voiture vue de profil (l'avant est à droite) : carrosserie `base`, filet `accent` ; la silhouette suit le modèle. */
export function iconeVoiture(base: string, accent: string, modele: 'equilibree' | 'legere' | 'turbo' = 'equilibree', classe = 'ico-voiture'): HTMLSpanElement {
  const b = hexOk(base, '#e63b2e'), a = hexOk(accent, b);
  const carrosserie = modele === 'legere'
    ? { corps: 'M3 21 L4 12 L17 11 L24 4.5 L44 4.5 L52 13 L61 15 L62 21 Z', vitre: 'M25.5 6.5 L42.5 6.5 L48.5 12 L22 12 Z' }
    : { corps: 'M3 21 L5 14 L19 12 L27 5 L45 5 L52 12 L61 14 L62 21 Z', vitre: 'M28.5 7.5 L43.5 7.5 L48.5 12 L24 12 Z' };
  const aileron = modele === 'turbo' ? '<path d="M2 9 H12 M7 9 V13" fill="none" stroke="#15131c" stroke-width="3.6" stroke-linecap="round"/><path d="M2 9 H12" fill="none" stroke="#1d1d24" stroke-width="1.6" stroke-linecap="round"/>' : '';
  return enSpan(classe, `<svg viewBox="0 0 64 30" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${aileron}<path d="${carrosserie.corps}" fill="${b}" stroke="#15131c" stroke-width="2" stroke-linejoin="round"/><path d="${carrosserie.vitre}" fill="#28303f"/><rect x="6" y="15.2" width="54" height="3.2" fill="${a}"/><circle cx="17" cy="22" r="5" fill="#1d1d24" stroke="#15131c" stroke-width="1.5"/><circle cx="49" cy="22" r="5" fill="#1d1d24" stroke="#15131c" stroke-width="1.5"/><circle cx="17" cy="22" r="1.8" fill="#c9ced8"/><circle cx="49" cy="22" r="1.8" fill="#c9ced8"/></svg>`);
}

/** Caisse de livrées (coffre à cerclage doré). */
export function iconeCaisse(classe = 'ico-caisse'): HTMLSpanElement {
  return enSpan(classe, '<svg viewBox="0 0 64 56" width="100%" height="100%"><path d="M6 24 H58 V50 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#8a5a2b" stroke="#15131c" stroke-width="3" stroke-linejoin="round"/><path d="M4 12 a3 3 0 0 1 3 -3 H57 a3 3 0 0 1 3 3 V24 H4 Z" fill="#b57a3a" stroke="#15131c" stroke-width="3" stroke-linejoin="round"/><rect x="14" y="9" width="6" height="44" fill="#ffd23f" stroke="#15131c" stroke-width="2.4"/><rect x="44" y="9" width="6" height="44" fill="#ffd23f" stroke="#15131c" stroke-width="2.4"/><rect x="26" y="19" width="12" height="13" rx="2.5" fill="#ffd23f" stroke="#15131c" stroke-width="2.6"/><circle cx="32" cy="25" r="2" fill="#15131c"/></svg>');
}
