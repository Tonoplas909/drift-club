import * as THREE from 'three';
import type { Ambiance } from '../core/level/types';
import { mulberry32 } from '../core/math/rng';
import { HAUTEUR_ETAGE, IMMEUBLES, TOURS, type Batiment } from '../core/env/ville';
import { coloredBox, colorize, merge } from './procedural';
import { outlineGeometry } from './materials';

/**
 * Modèles du thème « ville », dessinés en formes simples (aplats + contours comme le reste) : immeubles à grille de
 * fenêtres, tours vitrées, lampadaires, voitures garées, abribus… Base à y = 0 ; les bâtiments descendent de 4 m
 * sous le sol pour ne jamais flotter sur une pente.
 */

type Part = THREE.BufferGeometry;
type Rgb = [number, number, number];

const rgb = (hex: number, gain = 1): Rgb => {
  const c = new THREE.Color(hex);
  return [c.r * gain, c.g * gain, c.b * gain];
};

/** Assemblage direct de boîtes et de quads colorés (un seul tampon, normales plates). */
class Assemblage {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];

  private quad(p: number[][], n: number[], c: Rgb): void {
    for (const k of [0, 1, 2, 0, 2, 3]) {
      this.pos.push(p[k][0], p[k][1], p[k][2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(c[0], c[1], c[2]);
    }
  }

  /** Boîte centrée en (x, z), posée sur y0 ; `bas` : dessiner la face du dessous. */
  boite(w: number, h: number, d: number, x: number, y0: number, z: number, c: Rgb, bas = false): void {
    const x0 = x - w / 2, x1 = x + w / 2, y1 = y0 + h, z0 = z - d / 2, z1 = z + d / 2;
    this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], c);
    this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], c);
    this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], c);
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], c);
    this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], c);
    if (bas) this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], c);
  }

  /** Rectangle plaqué à `off` m devant la face `f` (px, nx, pz, nz) d'une boîte de demi-dimensions (hw, hd) ; `u` = position le long de la face. */
  fenetre(f: 'px' | 'nx' | 'pz' | 'nz', hw: number, hd: number, u: number, y0: number, wu: number, hv: number, off: number, c: Rgb): void {
    const a = u - wu / 2, b = u + wu / 2, y1 = y0 + hv;
    if (f === 'pz') this.quad([[a, y0, hd + off], [b, y0, hd + off], [b, y1, hd + off], [a, y1, hd + off]], [0, 0, 1], c);
    else if (f === 'nz') this.quad([[b, y0, -hd - off], [a, y0, -hd - off], [a, y1, -hd - off], [b, y1, -hd - off]], [0, 0, -1], c);
    else if (f === 'px') this.quad([[hw + off, y0, b], [hw + off, y0, a], [hw + off, y1, a], [hw + off, y1, b]], [1, 0, 0], c);
    else this.quad([[-hw - off, y0, a], [-hw - off, y0, b], [-hw - off, y1, b], [-hw - off, y1, a]], [-1, 0, 0], c);
  }

  geometrie(): Part {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

interface StyleFacade { mur: number; corniche: number; socle: number; vitre: number; vitreClair: number; verre?: boolean }

/** 0 brique, 1 beige, 2 béton, 3 bleu pastel, 4 rose, 5 jaune, 6 menthe, 7 verre bleu, 8 verre gris. */
const STYLES: StyleFacade[] = [
  { mur: 0xb4583f, corniche: 0xd9cbb5, socle: 0x7d3f30, vitre: 0x33455c, vitreClair: 0x7396b5 },
  { mur: 0xdcc9a3, corniche: 0xf2e6cc, socle: 0xb39d78, vitre: 0x3a4a60, vitreClair: 0x7396b5 },
  { mur: 0xa7abb0, corniche: 0x7e848b, socle: 0x82878e, vitre: 0x2f3d52, vitreClair: 0x7396b5 },
  { mur: 0x9cc3d8, corniche: 0xeaf2f6, socle: 0x6f97ad, vitre: 0x35485e, vitreClair: 0x8fb2cc },
  { mur: 0xe8b6bb, corniche: 0xfaeaec, socle: 0xc48a91, vitre: 0x3d4a5e, vitreClair: 0x8fb2cc },
  { mur: 0xf0d98a, corniche: 0xfff2c6, socle: 0xc9b060, vitre: 0x3d4a5e, vitreClair: 0x8fb2cc },
  { mur: 0xa9dbbf, corniche: 0xe9f7ef, socle: 0x76b493, vitre: 0x34495a, vitreClair: 0x8fb2cc },
  { mur: 0x5f86a8, corniche: 0x3f5f7d, socle: 0x40546a, vitre: 0x1e364f, vitreClair: 0x6fa0c8, verre: true },
  { mur: 0x8794a3, corniche: 0x5c6773, socle: 0x596470, vitre: 0x27384a, vitreClair: 0x82a8c2, verre: true },
];

const LUMIERE = 0xffd27a;

/**
 * Immeuble ou tour : corps + socle + corniche, grille de fenêtres sur les 4 faces (sombres le jour, une part allumée
 * au coucher : couleur > 1, elle « brille » malgré l'ombrage), détails de toit. Le contour n'est tracé que sur le corps.
 */
export function batimentGeometry(b: Batiment, graine: number, ambiance: Ambiance): Part {
  const st = STYLES[b.style];
  const rng = mulberry32(graine * 977 + 13);
  const corps = new Assemblage(), fen = new Assemblage();
  const H = b.etages * HAUTEUR_ETAGE, hw = b.w / 2, hd = b.d / 2;
  const mur = rgb(st.mur), corniche = rgb(st.corniche), socle = rgb(st.socle);

  corps.boite(b.w, H + 4, b.d, 0, -4, 0, mur);
  corps.boite(b.w + 0.2, 5.1, b.d + 0.2, 0, -4, 0, socle); // soubassement
  corps.boite(b.w + 0.5, 0.45, b.d + 0.5, 0, H, 0, corniche); // corniche / dalle de toit
  const toit = H + 0.45;
  const gris = rgb(0x9aa0a6), sombre = rgb(0x5b606b);
  if (st.verre) {
    // couronnement en retrait + mât
    corps.boite(b.w * 0.62, 2.6, b.d * 0.62, 0, toit, 0, rgb(st.corniche));
    corps.boite(0.35, 9, 0.35, b.w * 0.15, toit + 2.6, 0, sombre);
    corps.boite(0.5, 0.5, 0.5, b.w * 0.15, toit + 11.6, 0, rgb(0xe63b2e));
  } else {
    const nb = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < nb; k++) {
      corps.boite(1.7, 0.9, 1.2, (rng() - 0.5) * (b.w - 4), toit, (rng() - 0.5) * (b.d - 3), gris); // climatiseur
    }
    if (b.etages >= 4 && rng() < 0.6) {
      // château d'eau : cuve sur pieds
      const gx = (rng() - 0.5) * (b.w - 5), gz = (rng() - 0.5) * (b.d - 5);
      for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) corps.boite(0.14, 1.2, 0.14, gx + dx, toit, gz + dz, sombre);
      corps.boite(1.9, 1.6, 1.9, gx, toit + 1.2, gz, rgb(0x8a6a4a));
      corps.boite(2.1, 0.2, 2.1, gx, toit + 2.8, gz, sombre);
    } else if (rng() < 0.7) {
      corps.boite(2.6, 2.4, 2.6, (rng() - 0.5) * (b.w - 6), toit, (rng() - 0.5) * (b.d - 6), rgb(st.socle)); // cage d'escalier
    }
  }

  // Auvents au rez-de-chaussée sur les deux grandes faces (styles non vitrés à numéro pair)
  if (!st.verre && b.style % 2 === 0) {
    const cA = rgb(b.style === 0 ? 0x2f6f5a : 0xc0463a);
    for (const s of [-1, 1]) corps.boite(b.w * 0.7, 0.14, 1.3, 0, 2.7, s * (hd + 0.65), cA);
  }

  // Fenêtres
  const larg = st.verre ? 2.2 : 1.5, haut = st.verre ? 2.0 : 1.5, pas = 3.0;
  const lit = ambiance === 'coucher';
  const pLit = st.verre ? 0.3 : 0.4;
  const teinte = (rez: boolean): Rgb => {
    const r = rng();
    if (lit && r < (rez ? 0.7 : pLit)) return rgb(LUMIERE, 1.9);
    if (!lit && r < 0.16) return rgb(st.vitreClair);
    return rgb(rez ? 0x2c4054 : st.vitre);
  };
  for (const f of ['pz', 'nz', 'px', 'nx'] as const) {
    const W = f === 'pz' || f === 'nz' ? b.w : b.d;
    const cols = Math.max(1, Math.floor((W - 1.0) / pas));
    const ecart = W / cols;
    for (let i = 0; i < cols; i++) {
      const u = -W / 2 + ecart * (i + 0.5);
      // rez-de-chaussée : vitrine plus grande
      fen.fenetre(f, hw, hd, u, 0.45, larg + 0.5, 1.9, 0.07, teinte(true));
      for (let e = 1; e < b.etages; e++) fen.fenetre(f, hw, hd, u, e * HAUTEUR_ETAGE + 0.9, larg, haut, 0.07, teinte(false));
    }
  }

  const gCorps = corps.geometrie(), gFen = fen.geometrie();
  const g = merge([gCorps, gFen]);
  g.computeBoundingSphere();
  g.userData.contour = outlineGeometry(gCorps);
  return g;
}

/** Mobilier de rue. */
const tube = (rBas: number, rHaut: number, h: number, x: number, y0: number, z: number, color: number, seg = 8): Part =>
  colorize(new THREE.CylinderGeometry(rHaut, rBas, h, seg, 1).translate(x, y0 + h / 2, z), color);

/** Rgb → hexadécimal linéaire ignoré : les couleurs « brillantes » passent par ce helper (composantes > 1). */
function colorizeGain(g: Part, hex: number, gain: number): Part {
  const out = colorize(g, hex);
  const col = out.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * gain, col.getY(i) * gain, col.getZ(i) * gain);
  return out;
}

/** Lampadaire : mât de 6,2 m, bras vers la route (−x), tête allumée au coucher. */
export function lampadaireGeometry(ambiance: Ambiance): Part {
  const tete = new THREE.BoxGeometry(0.7, 0.14, 0.3).translate(-1.45, 6.15, 0);
  return merge([
    coloredBox(0.4, 0.5, 0.4, 0, 0.25, 0, 0x5b606b),
    tube(0.1, 0.07, 6.2, 0, 0, 0, 0x6b7280, 6),
    coloredBox(1.6, 0.1, 0.1, -0.75, 6.2, 0, 0x6b7280),
    ambiance === 'coucher' ? colorizeGain(tete, 0xffd98a, 2.2) : colorize(tete, 0xe6eaee),
  ]);
}

/** Plot de chantier orange et blanc sur socle noir. */
export function plotGeometry(): Part {
  return merge([
    coloredBox(0.46, 0.05, 0.46, 0, 0.025, 0, 0x2b2b30),
    tube(0.17, 0.04, 0.68, 0, 0.05, 0, 0xff7a1a),
    tube(0.125, 0.1, 0.1, 0, 0.27, 0, 0xf4f1e8),
  ]);
}

/** Séparateur de voies en béton (profil à gradins), 3 m de long selon z, 0,9 m de haut. */
export function blocBetonGeometry(): Part {
  return merge([
    coloredBox(0.62, 0.3, 3, 0, 0.0, 0, 0xc4c1ba),
    coloredBox(0.44, 0.3, 3, 0, 0.3, 0, 0xb4b1aa),
    coloredBox(0.26, 0.3, 3, 0, 0.6, 0, 0xc4c1ba),
    coloredBox(0.28, 0.06, 3.02, 0, 0.9, 0, 0xf08a24),
  ]);
}

export function poubelleGeometry(): Part {
  return merge([tube(0.3, 0.33, 0.95, 0, 0, 0, 0x3f6b52), tube(0.36, 0.34, 0.1, 0, 0.95, 0, 0x2b3a33)]);
}

/** Abribus : toit, dos vitré (+x), banc, poteau d'arrêt à un bout ; côté route = −x. Emprise 1,6 × 3,6. */
export function arretBusGeometry(): Part {
  const parts: Part[] = [
    coloredBox(1.6, 0.12, 3.6, 0, 0, 0, 0x8d919a),
    coloredBox(1.8, 0.14, 3.8, 0, 2.35, 0, 0x3f6f9a),
    coloredBox(0.06, 2.2, 3.4, 0.72, 0.12, 0, 0x9fc8d9),
    coloredBox(0.06, 0.12, 3.4, 0.72, 2.3, 0, 0x3a4250),
    coloredBox(0.5, 0.08, 2.4, 0.4, 0.5, 0, 0xb5651d),
    coloredBox(0.4, 0.4, 0.08, 0.4, 0.12, 1.0, 0x3a4250),
    coloredBox(0.4, 0.4, 0.08, 0.4, 0.12, -1.0, 0x3a4250),
    coloredBox(0.08, 2.2, 0.08, -0.72, 0.12, 1.7, 0x3a4250),
    coloredBox(0.08, 2.2, 0.08, -0.72, 0.12, -1.7, 0x3a4250),
    // panneau d'arrêt
    coloredBox(0.06, 2.6, 0.06, -0.72, 0, 2.6, 0x6b7280),
    coloredBox(0.05, 0.55, 0.5, -0.72, 2.3, 2.6, 0x2a63c8),
    coloredBox(0.06, 0.28, 0.28, -0.74, 2.44, 2.6, 0xf4f1e8),
  ];
  return merge(parts);
}

const VOITURES = [0xc0392b, 0x2f6fb5, 0xe9e9e6, 0xe8b923];

/** Voiture garée (bloc simple, pas le générateur des voitures du joueur) : long axe selon z, 1,9 × 4,3 m. */
export function voitureGeometry(variant: number): Part {
  const couleur = VOITURES[variant % VOITURES.length];
  const roue = (x: number, z: number): Part =>
    colorize(new THREE.CylinderGeometry(0.33, 0.33, 0.24, 8).rotateZ(Math.PI / 2).translate(x, 0.33, z), 0x1d1d24);
  const parts: Part[] = [
    coloredBox(1.86, 0.56, 4.2, 0, 0.32, 0, couleur),
    coloredBox(1.6, 0.42, 2.1, 0, 0.88, -0.2, 0x2c3441),
    coloredBox(1.5, 0.07, 1.95, 0, 1.3, -0.2, couleur),
    coloredBox(1.5, 0.1, 0.5, 0, 0.9, 1.75, couleur), // capot
    coloredBox(0.34, 0.12, 0.05, 0.6, 0.62, 2.11, 0xfff2c6), coloredBox(0.34, 0.12, 0.05, -0.6, 0.62, 2.11, 0xfff2c6),
    coloredBox(0.34, 0.12, 0.05, 0.6, 0.62, -2.11, 0xd7263d), coloredBox(0.34, 0.12, 0.05, -0.6, 0.62, -2.11, 0xd7263d),
    coloredBox(1.9, 0.14, 4.24, 0, 0.3, 0, 0x2b2d35),
    roue(0.86, 1.3), roue(-0.86, 1.3), roue(0.86, -1.3), roue(-0.86, -1.3),
  ];
  if (variant === 3) parts.push(coloredBox(0.6, 0.18, 0.25, 0, 1.4, -0.2, 0xf4f1e8)); // taxi
  return merge(parts);
}

/** Arbre en bac : 0 = couronne ronde, 1 = couronne haute et étroite. */
export function arbreVilleGeometry(variant: number): Part {
  const blob = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, c: number): Part =>
    colorize(new THREE.IcosahedronGeometry(r, 1).scale(sx, sy, sz).translate(x, y, z), c);
  const bac = [coloredBox(0.95, 0.5, 0.95, 0, -0.05, 0, 0xa9a69f), coloredBox(0.8, 0.03, 0.8, 0, 0.45, 0, 0x4a3b2c), tube(0.1, 0.07, 1.4, 0, 0.45, 0, 0x6b4f36, 6)];
  return merge(variant === 0
    ? [...bac, blob(0.95, 1, 0.85, 1, 0, 2.35, 0, 0x4e9a45), blob(0.6, 1, 0.8, 1, 0.5, 2.9, 0.2, 0x63b455)]
    : [...bac, blob(0.85, 0.7, 1.45, 0.7, 0, 2.6, 0, 0x3f8a4a), blob(0.5, 0.7, 1.1, 0.7, -0.15, 3.2, 0.15, 0x58a558)]);
}

/** Grille de chantier / clôture : 4 m de long selon z, 1,5 m de haut. */
export function grillageGeometry(): Part {
  const parts: Part[] = [
    coloredBox(0.07, 0.07, 4, 0, 1.45, 0, 0x6d7580), coloredBox(0.07, 0.07, 4, 0, 0.2, 0, 0x6d7580),
  ];
  for (const z of [-1.95, 0, 1.95]) parts.push(coloredBox(0.09, 1.55, 0.09, 0, 0, z, 0x59606b));
  for (let i = 0; i < 12; i++) parts.push(coloredBox(0.03, 1.25, 0.03, 0, 0.2, -1.65 + i * 0.3, 0x9aa3ad));
  return merge(parts);
}

/** Tous les modèles de la ville, par clé `kind + variante` (la clé se construit avec `decorKey`). */
export function decorVille(ambiance: Ambiance): Record<string, Part> {
  const d: Record<string, Part> = {};
  IMMEUBLES.forEach((b, i) => { d[`immeuble${i}`] = batimentGeometry(b, i + 1, ambiance); });
  TOURS.forEach((b, i) => { d[`tour${i}`] = batimentGeometry(b, i + 101, ambiance); });
  d.lampadaire0 = lampadaireGeometry(ambiance);
  d.plot0 = plotGeometry();
  d.blocBeton0 = blocBetonGeometry();
  d.poubelle0 = poubelleGeometry();
  d.arretBus0 = arretBusGeometry();
  for (let i = 0; i < VOITURES.length; i++) d[`voiture${i}`] = voitureGeometry(i);
  d.arbreVille0 = arbreVilleGeometry(0);
  d.arbreVille1 = arbreVilleGeometry(1);
  d.grillage0 = grillageGeometry();
  return d;
}
