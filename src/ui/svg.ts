/** Petites icônes SVG en ligne (Garage, caisses, résultats) : balisage statique, aucune donnée saisie n'y entre sauf des couleurs #rrggbb validées. */

import type { CarId } from '../core/physics/types';
import type { FumeeStyle } from '../core/fumees';
import type { Medaille } from '../core/medailles';

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

const TEINTES_MEDAILLES: Record<Medaille, [string, string]> = { bronze: ['#d08a4e', '#8a4f22'], argent: ['#e3e7ee', '#8b93a3'], or: ['#ffd23f', '#c48a00'] };

/** Médaille d'un niveau (bronze, argent, or). */
export function iconeMedaille(m: Medaille, classe = 'ico-medaille'): HTMLSpanElement {
  const [clair, fonce] = TEINTES_MEDAILLES[m];
  return enSpan(classe + ' ' + m, `<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M7 1.5h4l2 7h-4zM17 1.5h-4l-2 7h4z" fill="#e2483d" stroke="#15131c" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="15" r="7.3" fill="${clair}" stroke="#15131c" stroke-width="2"/><circle cx="12" cy="15" r="4.4" fill="none" stroke="${fonce}" stroke-width="1.6"/></svg>`);
}

/** Cadenas des livrées verrouillées. */
export function iconeCadenas(classe = 'ico-cadenas'): HTMLSpanElement {
  return enSpan(classe, '<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="#15131c" stroke-width="2.6" stroke-linecap="round"/><rect x="4.5" y="10.5" width="15" height="11" rx="2.5" fill="#ffd23f" stroke="#15131c" stroke-width="2"/><circle cx="12" cy="15.5" r="1.7" fill="#15131c"/></svg>');
}

/** Silhouettes de profil (l'avant est à droite) : corps, vitrage, essieux (x des roues) et détails propres au modèle. */
const SILHOUETTES: Record<CarId, { corps: string; vitre: string; roues: [number, number]; detail?: string }> = {
  equilibree: { corps: 'M3 21 L5 14 L19 12 L27 5 L45 5 L52 12 L61 14 L62 21 Z', vitre: 'M28.5 7.5 L43.5 7.5 L48.5 12 L24 12 Z', roues: [17, 49] },
  legere: { corps: 'M3 21 L4 12 L17 11 L24 4.5 L44 4.5 L52 13 L61 15 L62 21 Z', vitre: 'M25.5 6.5 L42.5 6.5 L48.5 12 L22 12 Z', roues: [17, 49] },
  turbo: { corps: 'M3 21 L5 14 L19 12 L27 5 L45 5 L52 12 L61 14 L62 21 Z', vitre: 'M28.5 7.5 L43.5 7.5 L48.5 12 L24 12 Z', roues: [17, 49],
    detail: '<path d="M2 9 H12 M7 9 V13" fill="none" stroke="#15131c" stroke-width="3.6" stroke-linecap="round"/><path d="M2 9 H12" fill="none" stroke="#1d1d24" stroke-width="1.6" stroke-linecap="round"/>' },
  // kei : courte, haute et carrée
  kei: { corps: 'M9 21 L9 12 L14 11 L17 3.5 L46 3.5 L49 11 L56 12.5 L57 21 Z', vitre: 'M19.5 5.5 L44.5 5.5 L46.5 11 L17.5 11 Z', roues: [19, 47] },
  // muscle : capot interminable, arrière en pente douce, pare-chocs chromés
  muscle: { corps: 'M2 21 L3 13.5 L11 12 L22 5.5 L36 5.5 L44 11.5 L62 13 L63 21 Z', vitre: 'M24 7.5 L35 7.5 L40.5 11.5 L19 11.5 Z', roues: [14, 51],
    detail: '<rect x="58" y="16" width="6" height="2.6" rx="1" fill="#c9ced8" stroke="#15131c" stroke-width="1"/><rect x="1" y="16" width="5" height="2.6" rx="1" fill="#c9ced8" stroke="#15131c" stroke-width="1"/>' },
  // break : toit long, hayon droit
  break: { corps: 'M3 21 L3.5 12.5 L8 11.5 L10 5 L42 5 L49 11.5 L61 13.5 L62 21 Z', vitre: 'M12 7 L41 7 L46 11.5 L9 11.5 Z', roues: [16, 49] },
  // rotative : coin bas, phares escamotables sortis
  rotative: { corps: 'M3 21 L4 14.5 L21 12.5 L29 7.5 L42 7.5 L49 12.5 L62 15.5 L62 21 Z', vitre: 'M30.5 9 L41 9 L45.5 12.5 L26.5 12.5 Z', roues: [16, 48],
    detail: '<rect x="53" y="11.4" width="4.6" height="3.4" rx="0.8" fill="#dfe3ea" stroke="#15131c" stroke-width="1.2"/>' },
};

/** Petite voiture vue de profil (l'avant est à droite) : carrosserie `base`, filet `accent` ; la silhouette suit le modèle. */
export function iconeVoiture(base: string, accent: string, modele: CarId = 'equilibree', classe = 'ico-voiture'): HTMLSpanElement {
  const b = hexOk(base, '#e63b2e'), a = hexOk(accent, b);
  const m = SILHOUETTES[modele] ?? SILHOUETTES.equilibree;
  const [ra, rb] = m.roues;
  const roue = (x: number) => `<circle cx="${x}" cy="22" r="5" fill="#1d1d24" stroke="#15131c" stroke-width="1.5"/><circle cx="${x}" cy="22" r="1.8" fill="#c9ced8"/>`;
  return enSpan(classe, `<svg viewBox="0 0 64 30" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${modele === 'turbo' ? m.detail : ''}<path d="${m.corps}" fill="${b}" stroke="#15131c" stroke-width="2" stroke-linejoin="round"/><path d="${m.vitre}" fill="#28303f"/><rect x="6" y="15.2" width="54" height="3.2" fill="${a}"/>${roue(ra)}${roue(rb)}${modele === 'turbo' ? '' : m.detail ?? ''}</svg>`);
}

/** Caisse de livrées (coffre à cerclage doré). */
export function iconeCaisse(classe = 'ico-caisse'): HTMLSpanElement {
  return enSpan(classe, '<svg viewBox="0 0 64 56" width="100%" height="100%"><path d="M6 24 H58 V50 a3 3 0 0 1 -3 3 H9 a3 3 0 0 1 -3 -3 Z" fill="#8a5a2b" stroke="#15131c" stroke-width="3" stroke-linejoin="round"/><path d="M4 12 a3 3 0 0 1 3 -3 H57 a3 3 0 0 1 3 3 V24 H4 Z" fill="#b57a3a" stroke="#15131c" stroke-width="3" stroke-linejoin="round"/><rect x="14" y="9" width="6" height="44" fill="#ffd23f" stroke="#15131c" stroke-width="2.4"/><rect x="44" y="9" width="6" height="44" fill="#ffd23f" stroke="#15131c" stroke-width="2.4"/><rect x="26" y="19" width="12" height="13" rx="2.5" fill="#ffd23f" stroke="#15131c" stroke-width="2.6"/><circle cx="32" cy="25" r="2" fill="#15131c"/></svg>');
}

const hexRgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rgbHex = (c: number[]): string => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Couleur d'un dégradé de `couleurs` (#rrggbb) à la position t ∈ [0, 1]. */
function couleurSur(couleurs: string[], t: number): string {
  if (couleurs.length === 1) return couleurs[0];
  const x = Math.min(1, Math.max(0, t)) * (couleurs.length - 1), i = Math.min(couleurs.length - 2, Math.floor(x)), f = x - i;
  const a = hexRgb(couleurs[i]), b = hexRgb(couleurs[i + 1]);
  return rgbHex(a.map((v, k) => v + (b[k] - v) * f));
}

/** Teinte de repère d'une fumée : sa couleur du milieu de vie (pastilles du Garage). */
export function teinteFumee(style: FumeeStyle, decor = '#e9e6e1'): string {
  if (style.arcEnCiel) return '#ff7ad9';
  return style.couleurs.length === 0 ? decor : couleurSur(style.couleurs, 0.5);
}

/** Fond CSS d'une pastille de fumée : dégradé des couleurs (arc-en-ciel complet pour les fumées qui tournent). */
export function fondFumee(style: FumeeStyle, decor = '#e9e6e1'): string {
  if (style.arcEnCiel) return 'conic-gradient(#ff5d5d, #ffd93a, #6ee21a, #2fd0ff, #8a5cff, #ff5d5d)';
  const c = style.couleurs.length === 0 ? [decor] : style.couleurs;
  if (c.length === 1) return c[0];
  return style.mode === 'alterne'
    ? `linear-gradient(135deg, ${c.map((x, i) => `${x} ${(i / c.length) * 100}% ${((i + 1) / c.length) * 100}%`).join(', ')})`
    : `linear-gradient(135deg, ${c.join(', ')})`;
}

/**
 * Traînée de bouffées d'une fumée de pneus (remplace le dessin de voiture sur les cartes des caisses) :
 * couleurs du style le long de la vie, lueur, paillettes ; l'arc-en-ciel tourne (animation CSS, coupée si mouvement réduit).
 */
export function iconeFumee(style: FumeeStyle, classe = 'ico-voiture', decor = '#e9e6e1'): HTMLSpanElement {
  const xs = [9, 21, 33, 45, 56], rs = [4.6, 6.6, 8.2, 7.2, 5];
  const n = style.couleurs.length;
  const arc = ['#ff5d5d', '#ffb43a', '#f5e93a', '#4fd85a', '#3aa8ff'];
  const puffs = xs.map((x, i) => {
    const t = i / (xs.length - 1);
    const c = style.arcEnCiel ? arc[i] : style.mode === 'alterne' && n > 0 ? style.couleurs[i % n] : style.couleurs.length === 0 ? decor : couleurSur(style.couleurs, t);
    const trait = style.lueur ? 'none' : '#15131c';
    return `<circle cx="${x}" cy="${21 - rs[i]}" r="${rs[i]}" fill="${hexOk(c, '#e9e6e1')}" stroke="${trait}" stroke-width="1.8"/>`;
  }).join('');
  const etoiles = style.paillettes
    ? [[14, 6, 2.6, 0], [28, 3, 2, 1], [41, 5, 3, 2], [52, 9, 2.2, 3], [6, 15, 1.8, 4]].map(([x, y, r, k]) => {
      const c = style.paillettes!.couleurs[k % style.paillettes!.couleurs.length];
      return `<path class="fx-etincelle" style="animation-delay:${k * 0.23}s" d="M${x} ${y - r} L${x + r * 0.35} ${y - r * 0.35} L${x + r} ${y} L${x + r * 0.35} ${y + r * 0.35} L${x} ${y + r} L${x - r * 0.35} ${y + r * 0.35} L${x - r} ${y} L${x - r * 0.35} ${y - r * 0.35} Z" fill="${hexOk(c, '#ffffff')}"/>`;
    }).join('')
    : '';
  const fx = (style.arcEnCiel ? ' fx-arc' : '') + (style.lueur ? ' fx-lueur' : '');
  return enSpan(classe + fx, `<svg viewBox="0 0 64 30" width="100%" height="100%" preserveAspectRatio="xMidYMid meet"><rect x="2" y="23.2" width="60" height="2.6" rx="1.3" fill="#15131c" opacity=".35"/>${puffs}${etoiles}</svg>`);
}
