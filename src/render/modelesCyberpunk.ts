import * as THREE from 'three';
import type { Ambiance } from '../core/level/types';
import { mulberry32 } from '../core/math/rng';
import { HAUTEUR_ETAGE, IMMEUBLES_NEON, TOURS_NEON, type Batiment } from '../core/env/ville';
import { Assemblage, arbreVilleGeometry, blocBetonGeometry, plotGeometry, poubelleGeometry, rgb, voitureGeometry, type Rgb } from './villeModeles';
import { barre, boiteRot, coloredBox, lumineux, merge, tube, type Part } from './formes';
import { outlineGeometry } from './materials';

/**
 * Modèles du thème « cyberpunk » : immeubles et mégatours sombres striés de néons, écrans géants, lampadaires à tube,
 * enseignes, échoppes de ramen, bornes de recharge et panneaux holographiques flottant au-dessus de la route.
 * Les néons sont des couleurs « allumées » (composantes > 1) : ils brillent malgré la nuit.
 */

/** Couleurs des néons par style : magenta, cyan, ambre, vert acide. */
const NEONS = [0xff2fa6, 0x1fd8ff, 0xffb02e, 0x7dff3a];
const SECONDES = [0x1fd8ff, 0xff2fa6, 0xff4a4a, 0xb04aff];
const MURS = [0x221f30, 0x1d2230, 0x2a2228, 0x1f2624];
const VITRE = 0x15131f;

/** Intensité des néons : pleine nuit (« jour ») ou smog du soir (« coucher »). */
const eclat = (ambiance: Ambiance): number => (ambiance === 'coucher' ? 2.0 : 2.5);

function finir(corps: Part[], details: Part[]): Part {
  const c = merge(corps);
  const g = merge([c, ...details]);
  g.computeBoundingSphere();
  g.userData.contour = outlineGeometry(c);
  return g;
}

/** Façades : grille de fenêtres (une part allumée en couleurs), bandes de néon, arêtes lumineuses. */
function facades(det: Assemblage, w: number, d: number, y0: number, H: number, style: number, rng: () => number, gain: number, pasEtage = HAUTEUR_ETAGE): void {
  const hw = w / 2, hd = d / 2, neon = NEONS[style % NEONS.length], seconde = SECONDES[style % SECONDES.length];
  const etages = Math.max(1, Math.floor(H / pasEtage));
  const allume = (): Rgb => {
    const r = rng();
    if (r < 0.1) return rgb(neon, gain * 0.7);
    if (r < 0.2) return rgb(0x8ab8ff, gain * 0.75);
    if (r < 0.34) return rgb(0xffd27a, gain * 0.7);
    return rgb(VITRE);
  };
  for (const f of ['pz', 'nz', 'px', 'nx'] as const) {
    const W = f === 'pz' || f === 'nz' ? w : d;
    const cols = Math.max(1, Math.floor((W - 1) / 2.6));
    for (let e = 1; e < etages; e++) {
      for (let i = 0; i < cols; i++) det.fenetre(f, hw, hd, -W / 2 + (W * (i + 0.5)) / cols, y0 + e * pasEtage + 0.7, 1.9, 1.6, 0.05, allume());
      if (e % 2 === 0) det.fenetre(f, hw, hd, 0, y0 + e * pasEtage - 0.12, W, 0.16, 0.08, rgb(e % 4 === 0 ? seconde : neon, gain * 0.9));
    }
    // arêtes : tubes de néon verticaux aux deux bouts de la face
    for (const u of [-W / 2 + 0.12, W / 2 - 0.12]) det.fenetre(f, hw, hd, u, y0 + 0.4, 0.14, H - 0.6, 0.1, rgb(neon, gain));
  }
}

/** Écran géant sur les faces ±z : fond lumineux en bandes, « pixels » et cadre. */
function ecran(det: Assemblage, hw: number, hd: number, largeur: number, hauteur: number, y0: number, style: number, rng: () => number, gain: number): void {
  const a = NEONS[(style + 1) % NEONS.length], b = SECONDES[(style + 2) % SECONDES.length];
  for (const f of ['pz', 'nz'] as const) {
    det.fenetre(f, hw, hd, 0, y0 - 0.25, largeur + 0.5, hauteur + 0.5, 0.12, rgb(0x0c0b12));
    const n = 5;
    for (let k = 0; k < n; k++) det.fenetre(f, hw, hd, 0, y0 + (hauteur * k) / n, largeur, hauteur / n, 0.16, rgb(k % 2 ? a : b, gain * (0.55 + 0.25 * rng())));
    for (let k = 0; k < 6; k++) det.fenetre(f, hw, hd, (rng() - 0.5) * largeur * 0.8, y0 + rng() * hauteur * 0.8, largeur * 0.12, hauteur * 0.14, 0.2, rgb(0xffffff, gain * 0.8));
  }
}

/** Immeuble à néons : corps sombre, fenêtres colorées, bandes et arêtes de néon, vitrines, écran, antenne. */
export function immeubleNeonGeometry(b: Batiment, ambiance: Ambiance, graine: number): Part {
  const rng = mulberry32(graine * 977 + 31), gain = eclat(ambiance);
  const corps = new Assemblage(), det = new Assemblage();
  const H = b.etages * HAUTEUR_ETAGE, hw = b.w / 2, hd = b.d / 2, neon = NEONS[b.style % NEONS.length];
  corps.boite(b.w, H + 4, b.d, 0, -4, 0, rgb(MURS[b.style % MURS.length]));
  corps.boite(b.w + 0.4, 0.4, b.d + 0.4, 0, H, 0, rgb(0x14121c));
  facades(det, b.w, b.d, 0, H, b.style, rng, gain);
  // rez-de-chaussée : vitrines éclairées et auvent lumineux
  for (const f of ['pz', 'nz'] as const) {
    det.fenetre(f, hw, hd, 0, 0.2, b.w - 1.4, 2.6, 0.06, rgb(rng() < 0.5 ? 0xffc8e8 : 0xc8f0ff, gain * 0.7));
    det.fenetre(f, hw, hd, 0, 2.95, b.w - 0.8, 0.35, 0.3, rgb(neon, gain));
  }
  if (b.etages >= 5) ecran(det, hw, hd, b.w * 0.6, Math.min(H * 0.35, 9), H * 0.5, b.style, rng, gain);
  // toit : climatiseurs, antenne à feu rouge, panneau lumineux
  const parts: Part[] = [];
  for (let k = 0; k < 2; k++) corps.boite(1.8, 1.0, 1.3, (rng() - 0.5) * (b.w - 4), H + 0.4, (rng() - 0.5) * (b.d - 3), rgb(0x3a3848));
  parts.push(tube(0.12, 0.06, 7, hw * 0.5, H + 0.4, 0, 0x2a2836, 5), lumineux(new THREE.IcosahedronGeometry(0.25, 0).translate(hw * 0.5, H + 7.5, 0), 0xff2a2a, gain));
  if (rng() < 0.6) {
    const c = SECONDES[b.style % SECONDES.length];
    for (const x of [-b.w * 0.28, b.w * 0.28]) parts.push(coloredBox(0.14, 2.2, 0.14, x, H + 0.4, 0, 0x2a2836));
    parts.push(lumineux(new THREE.BoxGeometry(b.w * 0.7, 2.4, 0.16).translate(0, H + 3.8, 0), c, gain * 0.85));
  }
  return finir([corps.geometrie()], [det.geometrie(), ...parts]);
}

/** Mégatour : socle large, fût en retrait, couronne lumineuse et flèche ; écran vertical sur une face. */
export function tourNeonGeometry(b: Batiment, ambiance: Ambiance, graine: number): Part {
  const rng = mulberry32(graine * 613 + 71), gain = eclat(ambiance);
  const corps = new Assemblage(), det = new Assemblage();
  const H = b.etages * HAUTEUR_ETAGE, H1 = Math.round(H * 0.55), neon = NEONS[b.style % NEONS.length];
  const w2 = b.w * 0.72, d2 = b.d * 0.72;
  corps.boite(b.w, H1 + 4, b.d, 0, -4, 0, rgb(MURS[b.style % MURS.length]));
  corps.boite(w2, H - H1 + 0.5, d2, 0, H1 - 0.5, 0, rgb(MURS[(b.style + 1) % MURS.length]));
  facades(det, b.w, b.d, 0, H1, b.style, rng, gain);
  // fût : colonnes de lumière verticales
  const det2 = new Assemblage();
  for (const f of ['pz', 'nz', 'px', 'nx'] as const) {
    const W = f === 'pz' || f === 'nz' ? w2 : d2;
    const n = Math.max(2, Math.floor(W / 3));
    for (let i = 0; i <= n; i++) det2.fenetre(f, w2 / 2, d2 / 2, -W / 2 + (W * i) / n, H1, 0.12, H - H1, 0.06, rgb(i % 2 ? neon : 0x8ab8ff, gain * (i % 2 ? 0.9 : 0.6)));
    for (let e = H1 + 3; e < H; e += 3.4) det2.fenetre(f, w2 / 2, d2 / 2, 0, e, W - 0.4, 0.9, 0.04, rgb(rng() < 0.4 ? 0xffd27a : VITRE, rng() < 0.4 ? gain * 0.6 : 1));
  }
  // écran vertical sur ±z du fût
  ecran(det2, w2 / 2, d2 / 2, w2 * 0.5, (H - H1) * 0.6, H1 + (H - H1) * 0.2, b.style, rng, gain);
  // couronne et flèche
  corps.boite(w2 + 0.6, 0.8, d2 + 0.6, 0, H, 0, rgb(0x14121c));
  const parts: Part[] = [
    lumineux(new THREE.BoxGeometry(w2 + 0.7, 0.3, d2 + 0.7).translate(0, H + 0.3, 0), neon, gain),
    tube(0.35, 0.08, 14, 0, H + 0.8, 0, 0x2a2836, 6),
    lumineux(new THREE.IcosahedronGeometry(0.35, 0).translate(0, H + 15, 0), 0xff2a2a, gain),
  ];
  return finir([corps.geometrie()], [det.geometrie(), det2.geometrie(), ...parts]);
}

/** Lampadaire à tube : mât sombre de 7 m, bras vers la route (−x), long tube lumineux, anneau au pied. */
export function lampadaireNeonGeometry(ambiance: Ambiance): Part {
  const g = eclat(ambiance);
  return merge([
    coloredBox(0.45, 0.4, 0.45, 0, 0, 0, 0x2a2836),
    lumineux(new THREE.BoxGeometry(0.5, 0.06, 0.5).translate(0, 0.42, 0), 0xff2fa6, g * 0.8),
    tube(0.1, 0.06, 7, 0, 0, 0, 0x34324a, 6),
    barre([0, 6.9, 0], [-1.9, 7.2, 0], 0.06, 0x34324a, 5),
    lumineux(new THREE.BoxGeometry(1.7, 0.1, 0.12).translate(-1.2, 7.0, 0), 0x6ff4ff, g),
  ]);
}

/** Enseigne sur pied, face vers la route (−z) et dos lumineux : 0 = colonne verticale, 1 = panneau sur deux poteaux, 2 = disque. */
export function enseigneNeonGeometry(variant: number, ambiance: Ambiance): Part {
  const g = eclat(ambiance), M = 0x2a2836;
  if (variant === 0) {
    const parts: Part[] = [tube(0.1, 0.08, 2.2, 0, 0, 0, M, 6), lumineux(new THREE.BoxGeometry(1.0, 3.4, 0.25).translate(0, 3.9, 0), 0xff2fa6, g * 0.8)];
    for (let k = 0; k < 5; k++) parts.push(lumineux(new THREE.BoxGeometry(0.55, 0.36, 0.3).translate(0, 5.25 - k * 0.66, 0), 0x6ff4ff, g));
    return merge(parts);
  }
  if (variant === 1) {
    const parts: Part[] = [tube(0.08, 0.08, 3.1, -1.4, 0, 0, M, 6), tube(0.08, 0.08, 3.1, 1.4, 0, 0, M, 6), lumineux(new THREE.BoxGeometry(3.2, 1.2, 0.2).translate(0, 3.5, 0), 0x1fd8ff, g * 0.75)];
    for (let k = 0; k < 4; k++) parts.push(lumineux(new THREE.BoxGeometry(0.42, 0.6, 0.26).translate(-1.05 + k * 0.62, 3.5, 0), 0xffffff, g * 0.9));
    parts.push(lumineux(new THREE.ConeGeometry(0.35, 0.6, 3).rotateZ(-Math.PI / 2).translate(1.35, 3.5, 0), 0xffb02e, g));
    return merge(parts);
  }
  return merge([
    tube(0.1, 0.08, 3.4, 0, 0, 0, M, 6),
    lumineux(new THREE.CylinderGeometry(1.1, 1.1, 0.22, 16).rotateX(Math.PI / 2).translate(0, 4.4, 0), 0xffb02e, g * 0.75),
    lumineux(new THREE.TorusGeometry(1.15, 0.08, 4, 20).translate(0, 4.4, 0), 0xff2fa6, g),
    lumineux(new THREE.BoxGeometry(0.9, 0.3, 0.3).translate(0, 4.4, 0), 0xffffff, g),
  ]);
}

/** Échoppe de ramen (0 rouge, 1 bleue) : comptoir face à la route (−z), auvent, noren, lanternes et menu lumineux, tabourets. */
export function kiosqueGeometry(variant: number, ambiance: Ambiance): Part {
  const g = eclat(ambiance), c = variant === 0 ? 0xc8282a : 0x2a5ac8, w = variant === 0 ? 3.4 : 3.0;
  const parts: Part[] = [
    coloredBox(w, 1.1, 2.0, 0, 0, 0.1, 0x3a2a24), coloredBox(w + 0.1, 0.1, 0.5, 0, 1.1, -0.75, 0x8a6a4a),
    coloredBox(w, 1.3, 0.12, 0, 1.2, 1.05, 0x2a2018),
    boiteRot(w + 0.8, 0.12, 2.8, -0.16, 0, 0, 0, 2.75, 0, c),
    lumineux(new THREE.BoxGeometry(w * 0.6, 0.55, 0.06).translate(0, 2.25, 1.0), 0xfff2c8, g * 0.7),
  ];
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) parts.push(coloredBox(0.1, 2.7, 0.1, x, 0, -1.0, 0x2a2018), coloredBox(0.1, 2.5, 0.1, x, 0, 1.0, 0x2a2018));
  const n = Math.round(w / 0.55);
  for (let k = 0; k < n; k++) parts.push(coloredBox(0.48, 0.55, 0.03, -w / 2 + 0.3 + k * ((w - 0.6) / Math.max(1, n - 1)), 2.05, -1.32, k % 2 ? c : 0xf2ecd8));
  for (const x of [-w / 2 + 0.25, w / 2 - 0.25]) parts.push(lumineux(new THREE.IcosahedronGeometry(0.24, 1).scale(1, 1.3, 1).translate(x, 2.0, -1.5), 0xff4a2a, g * 0.85));
  for (const x of [-0.9, 0, 0.9]) parts.push(tube(0.18, 0.18, 0.06, x, 0.7, -1.45, 0xd8352a, 8), tube(0.04, 0.04, 0.7, x, 0, -1.45, 0x2a2018, 5));
  return merge(parts);
}

/** Panneau holographique flottant (8 à 12 m au-dessus de la route) : 0 = large, 1 = vertical. Lumineux sur les deux faces. */
export function holoGeometry(variant: number, ambiance: Ambiance): Part {
  const g = eclat(ambiance);
  const [W, H, y0, a, b] = variant === 0 ? [7, 3.4, 8.6, 0x1fd8ff, 0xff2fa6] : [2.8, 5.2, 8.2, 0xffb02e, 0xb04aff];
  const parts: Part[] = [];
  const cadre = (x: number, y: number, w: number, h: number): Part => lumineux(new THREE.BoxGeometry(w, h, 0.1).translate(x, y, 0), a, g);
  parts.push(cadre(0, y0, W, 0.12), cadre(0, y0 + H, W, 0.12), cadre(-W / 2, y0 + H / 2, 0.12, H), cadre(W / 2, y0 + H / 2, 0.12, H));
  const n = variant === 0 ? 4 : 6;
  for (let k = 0; k < n; k++) parts.push(lumineux(new THREE.BoxGeometry(W - 0.4, (H / n) * 0.55, 0.05).translate(0, y0 + (H * (k + 0.5)) / n, 0), k % 2 ? a : b, g * 0.5));
  return merge(parts);
}

/** Borne de recharge : écran lumineux côté route (−z), câble enroulé. */
export function borneRechargeGeometry(ambiance: Ambiance): Part {
  const g = eclat(ambiance);
  return merge([
    coloredBox(0.7, 0.08, 0.5, 0, 0, 0, 0x3a3848), coloredBox(0.5, 1.5, 0.35, 0, 0.08, 0, 0xd8dce4),
    lumineux(new THREE.BoxGeometry(0.34, 0.3, 0.02).translate(0, 1.2, -0.18), 0x3affb0, g * 0.8),
    lumineux(new THREE.BoxGeometry(0.52, 0.06, 0.37).translate(0, 1.6, 0), 0x1fd8ff, g),
    barre([0.25, 0.9, 0], [0.38, 0.5, 0], 0.035, 0x1e1e24, 4), barre([0.38, 0.5, 0], [0.3, 0.2, -0.1], 0.035, 0x1e1e24, 4),
  ]);
}

/** Chevron de virage : flèches lumineuses sur un panneau sombre. */
export function chevronNeonGeometry(ambiance: Ambiance): Part {
  const g = eclat(ambiance);
  // panneau face à la route (z local), flèches sur les deux faces
  const parts: Part[] = [coloredBox(0.1, 1.6, 0.1, 0, -0.3, 0, 0x2a2836), coloredBox(0.9, 0.7, 0.06, 0, 0.95, 0, 0x14121c)];
  for (const z of [-0.05, 0.05]) for (const x of [-0.2, 0.15]) parts.push(lumineux(new THREE.ConeGeometry(0.26, 0.24, 3).rotateZ(-Math.PI / 2).translate(x, 1.3, z), 0xffe14a, g));
  return merge(parts);
}

/** Tous les modèles du cyberpunk, par clé `kind + variante`, avec quelques modèles de la ville (voitures, plots…). */
export function decorCyberpunk(ambiance: Ambiance): Record<string, Part> {
  const d: Record<string, Part> = {};
  IMMEUBLES_NEON.forEach((b, i) => { d[`immeubleNeon${i}`] = immeubleNeonGeometry(b, ambiance, i + 1); });
  TOURS_NEON.forEach((b, i) => { d[`tourNeon${i}`] = tourNeonGeometry(b, ambiance, i + 101); });
  d.lampadaireNeon0 = lampadaireNeonGeometry(ambiance);
  for (let i = 0; i < 3; i++) d[`enseigneNeon${i}`] = enseigneNeonGeometry(i, ambiance);
  for (let i = 0; i < 2; i++) { d[`kiosque${i}`] = kiosqueGeometry(i, ambiance); d[`holo${i}`] = holoGeometry(i, ambiance); }
  d.borneRecharge0 = borneRechargeGeometry(ambiance);
  d.chevron0 = chevronNeonGeometry(ambiance);
  for (let i = 0; i < 4; i++) d[`voiture${i}`] = voitureGeometry(i);
  d.plot0 = plotGeometry();
  d.blocBeton0 = blocBetonGeometry();
  d.poubelle0 = poubelleGeometry();
  d.arbreVille0 = arbreVilleGeometry(0);
  d.arbreVille1 = arbreVilleGeometry(1);
  return d;
}
