import * as THREE from 'three';
import type { Ambiance } from '../core/level/types';
import { mulberry32 } from '../core/math/rng';
import { IMMEUBLES_JP, MACHIYAS, MINKAS, type Batiment } from '../core/env/ville';
import { Assemblage, rgb, type Rgb } from './villeModeles';
import { Tampon, barre, boiteRot, coloredBox, lumineux, merge, tube, type Part } from './formes';
import { outlineGeometry } from './materials';

/**
 * Villages et rues du thème « japon » : maisons traditionnelles (minka) à toit de tuiles ou de chaume, échoppes de
 * ville (machiya) à claustras de bois et rideaux « noren », petits immeubles à enseignes verticales, distributeurs de
 * boissons et poteaux électriques. Les longues façades sont sur ±z (vers la route) ; les corps descendent de 4 m sous
 * le sol pour ne jamais flotter sur une pente.
 */

const TUILE = 0x3d4654, TUILE_FAITE = 0x2a313c, CHAUME = 0xb59a5e, CHAUME_FAITE = 0x7a6640;
const PIERRE = 0x8e8c86, BOIS_SOMBRE = 0x33241b, PAPIER = 0xf2e8cf, LUMIERE = 0xffd27a;

/** Toit en croupe (quatre pans, faîtage le long de x) de base w × d posée en y0, de hauteur h. */
function toitCroupe(w: number, d: number, h: number, y0: number, couleur: number): Part {
  const t = new Tampon(), c = new THREE.Color(couleur);
  const hw = w / 2, hd = d / 2, r = Math.max(0.2, hw - hd), y1 = y0 + h;
  const A = [-hw, y0, -hd], B = [hw, y0, -hd], C = [hw, y0, hd], D = [-hw, y0, hd], R1 = [-r, y1, 0], R2 = [r, y1, 0];
  t.quad(D, C, R2, R1, c, [0, y0, hd + 10]);
  t.quad(B, A, R1, R2, c, [0, y0, -hd - 10]);
  t.quad(A, D, R1, R1, c, [-hw - 10, y0, 0]);
  t.quad(C, B, R2, R2, c, [hw + 10, y0, 0]);
  // dessous des avant-toits (vu depuis la route)
  t.quad(A, B, C, D, new THREE.Color(couleur).multiplyScalar(0.6), [0, y0 - 10, 0]);
  return t.geometrie();
}

/** Toit à deux pans (faîtage le long de x) de base w × d posée en y0, de hauteur h. */
function toitPignon(w: number, d: number, h: number, y0: number, couleur: number): Part {
  const t = new Tampon(), c = new THREE.Color(couleur), s = new THREE.Color(couleur).multiplyScalar(0.6);
  const hw = w / 2, hd = d / 2, y1 = y0 + h;
  const A = [-hw, y0, -hd], B = [hw, y0, -hd], C = [hw, y0, hd], D = [-hw, y0, hd], R1 = [-hw, y1, 0], R2 = [hw, y1, 0];
  t.quad(D, C, R2, R1, c, [0, y0, hd + 10]);
  t.quad(B, A, R1, R2, c, [0, y0, -hd - 10]);
  // pignons (triangles) et dessous
  t.quad(A, D, R1, R1, s, [-hw - 10, y0, 0]);
  t.quad(C, B, R2, R2, s, [hw + 10, y0, 0]);
  t.quad(A, B, C, D, s, [0, y0 - 10, 0]);
  return t.geometrie();
}

/** Bâtiment fini : contour seulement autour du corps (pas autour des détails plaqués). */
function finir(corps: Part[], details: Part[]): Part {
  const c = merge(corps);
  const g = merge([c, ...details]);
  g.computeBoundingSphere();
  g.userData.contour = outlineGeometry(c);
  return g;
}

interface StyleMinka { mur: number; poteau: number; toit: number; faite: number; chaume?: boolean }
const STYLES_MINKA: StyleMinka[] = [
  { mur: 0x6a4a36, poteau: BOIS_SOMBRE, toit: TUILE, faite: TUILE_FAITE },
  { mur: 0xeee6d6, poteau: 0x3a2a20, toit: TUILE, faite: TUILE_FAITE },
  { mur: 0xb88a5a, poteau: 0x5a3e28, toit: CHAUME, faite: CHAUME_FAITE, chaume: true },
];

/** Maison traditionnelle : socle de pierre, poteaux sombres, panneaux de papier (allumés au coucher), véranda, grand toit. */
export function minkaGeometry(b: Batiment, ambiance: Ambiance): Part {
  const st = STYLES_MINKA[b.style % STYLES_MINKA.length];
  const corps = new Assemblage(), det = new Assemblage();
  const hw = b.w / 2, hd = b.d / 2, socle = 0.6, H1 = 2.9;
  corps.boite(b.w + 0.4, 4 + socle, b.d + 0.4, 0, -4, 0, rgb(PIERRE));
  corps.boite(b.w, H1, b.d, 0, socle, 0, rgb(st.mur));
  const lit = ambiance !== 'jour';
  const papier = (): Rgb => (lit ? rgb(LUMIERE, 1.7) : rgb(PAPIER));
  // façades ±z : poteaux tous les ~1,8 m, panneaux de papier entre eux ; pignons ±x : poteaux seulement
  for (const f of ['pz', 'nz'] as const) {
    const n = Math.max(2, Math.round(b.w / 1.8));
    for (let i = 0; i <= n; i++) det.fenetre(f, hw, hd, -hw + (b.w * i) / n, socle, 0.18, H1, 0.04, rgb(st.poteau));
    for (let i = 0; i < n; i++) {
      const u = -hw + (b.w * (i + 0.5)) / n;
      det.fenetre(f, hw, hd, u, socle + 0.35, b.w / n - 0.3, H1 - 0.75, 0.03, papier());
      for (const y of [socle + 1.1, socle + 1.75]) det.fenetre(f, hw, hd, u, y, b.w / n - 0.3, 0.05, 0.035, rgb(st.poteau));
    }
    det.fenetre(f, hw, hd, 0, socle + H1 - 0.3, b.w, 0.3, 0.045, rgb(st.poteau)); // linteau
  }
  for (const f of ['px', 'nx'] as const) for (const u of [-hd, 0, hd]) det.fenetre(f, hw, hd, u, socle, 0.18, H1, 0.04, rgb(st.poteau));
  // véranda (engawa) le long des deux façades
  for (const s of [-1, 1]) corps.boite(b.w * 0.85, 0.16, 1.1, 0, socle, s * (hd + 0.55), rgb(0x8a6440));
  const parts: Part[] = [];
  let y = socle + H1;
  if (b.etages >= 2) {
    // jupe de toit, puis étage en retrait
    parts.push(toitCroupe(b.w + 1.8, b.d + 1.8, 1.1, y - 0.15, st.toit));
    corps.boite(b.w - 2.6, 2.4, b.d - 2.6, 0, y, 0, rgb(st.mur));
    for (const f of ['pz', 'nz'] as const) {
      const n = Math.max(2, Math.round((b.w - 2.6) / 1.8));
      for (let i = 0; i < n; i++) det.fenetre(f, hw - 1.3, hd - 1.3, -(hw - 1.3) + ((b.w - 2.6) * (i + 0.5)) / n, y + 1.25, (b.w - 2.6) / n - 0.5, 0.9, 0.03, papier());
    }
    y += 2.4;
    parts.push(toitCroupe(b.w - 0.8, b.d - 0.8, st.chaume ? 3.2 : 2.1, y - 0.1, st.toit));
    y += st.chaume ? 3.1 : 2.0;
  } else {
    parts.push(toitCroupe(b.w + 1.9, b.d + 1.9, st.chaume ? 3.6 : 2.4, y - 0.15, st.toit));
    y += st.chaume ? 3.45 : 2.25;
  }
  // faîtage
  const longueur = Math.max(0.6, b.w - b.d) + (b.etages >= 2 ? -0.6 : 1);
  parts.push(coloredBox(longueur + 0.6, 0.32, 0.5, 0, y - 0.1, 0, st.faite));
  if (st.chaume) for (const x of [-longueur / 2, 0, longueur / 2]) parts.push(coloredBox(0.14, 0.2, 0.9, x, y + 0.1, 0, 0x3a2a20));
  return finir([corps.geometrie(), ...parts], [det.geometrie()]);
}

interface StyleMachiya { mur: number; bois: number; noren: number; enseigne: number }
const STYLES_MACHIYA: StyleMachiya[] = [
  { mur: 0x4a3326, bois: 0x2e2018, noren: 0x23397a, enseigne: 0x2e2018 },
  { mur: 0xe6dccb, bois: 0x3e2c20, noren: 0xa8322a, enseigne: 0xf2ecd8 },
  { mur: 0x6a6e78, bois: 0x2a2a30, noren: 0xe8e2d0, enseigne: 0x8a2a22 },
  { mur: 0x8a3a2a, bois: 0x3a2018, noren: 0x1e2a48, enseigne: 0xf2ecd8 },
];

/** Échoppe de ville : claustras de bois au rez-de-chaussée, noren, lanternes rouges, auvent de tuiles, étage blanc, toit à deux pans. */
export function machiyaGeometry(b: Batiment, ambiance: Ambiance, graine: number): Part {
  const st = STYLES_MACHIYA[b.style % STYLES_MACHIYA.length];
  const rng = mulberry32(graine * 31 + 7);
  const corps = new Assemblage(), det = new Assemblage();
  const hw = b.w / 2, hd = b.d / 2, H1 = 3.0, H = b.etages * H1;
  corps.boite(b.w, H + 4, b.d, 0, -4, 0, rgb(st.mur));
  corps.boite(b.w + 0.1, 4.35, b.d + 0.1, 0, -4, 0, rgb(0x5a5650)); // soubassement
  const lit = ambiance !== 'jour';
  const parts: Part[] = [];
  for (const [f, s] of [['pz', 1], ['nz', -1]] as const) {
    // claustra (koshi) : lattes verticales serrées devant un fond sombre (ou éclairé de l'intérieur au coucher)
    det.fenetre(f, hw, hd, -hw * 0.25, 0.35, b.w * 0.62, 2.1, 0.02, lit ? rgb(LUMIERE, 1.4) : rgb(0x2a2420));
    const n = Math.floor((b.w * 0.62) / 0.16);
    for (let i = 0; i < n; i++) det.fenetre(f, hw, hd, -hw * 0.25 - b.w * 0.31 + (i + 0.5) * (b.w * 0.62) / n, 0.35, 0.07, 2.1, 0.05, rgb(st.bois));
    // entrée : porte sombre et noren (trois pans)
    const ue = hw * 0.62;
    det.fenetre(f, hw, hd, ue, 0.35, 1.5, 2.2, 0.03, rgb(0x1e1a18));
    for (let k = 0; k < 3; k++) det.fenetre(f, hw, hd, ue - 0.5 + k * 0.5, 1.55, 0.46, 0.95, 0.07, rgb(st.noren));
    // auvent de tuiles entre les étages
    parts.push(boiteRot(b.w + 0.3, 0.12, 1.5, s * 0.32, 0, 0, 0, H1 - 0.05, s * (hd + 0.62), TUILE));
    // enseigne en bois (kanban) au-dessus de l'auvent, « caractères » clairs ou sombres
    const clair = st.enseigne !== 0xf2ecd8;
    parts.push(coloredBox(2.4, 0.62, 0.12, -hw * 0.15, H1 + 0.45, s * (hd + 0.08), st.enseigne));
    for (let k = 0; k < 4; k++) parts.push(coloredBox(0.32, 0.36, 0.04, -hw * 0.15 - 0.81 + k * 0.54, H1 + 0.58, s * (hd + 0.15), clair ? 0xf2ecd8 : 0x2a1a14));
    // lanternes rouges (chōchin) de part et d'autre de l'entrée
    for (const dx of [-0.95, 0.95]) {
      const lx = ue + dx, lz = s * (hd + 0.45);
      parts.push(barre([lx, H1 - 0.3, lz], [lx, H1 - 0.6, lz], 0.02, 0x2a2018, 4));
      parts.push(lumineux(new THREE.IcosahedronGeometry(0.26, 1).scale(1, 1.35, 1).translate(lx, H1 - 0.95, lz), 0xd8352a, lit ? 2.1 : 1.15));
      parts.push(coloredBox(0.3, 0.06, 0.3, lx, H1 - 0.62, lz, 0x1e1a18), coloredBox(0.3, 0.06, 0.3, lx, H1 - 1.34, lz, 0x1e1a18));
    }
    // étages : enduit blanc et fenêtres à barreaux (mushiko)
    for (let e = 1; e < b.etages; e++) {
      det.fenetre(f, hw, hd, 0, e * H1 + 0.3, b.w - 0.4, H1 - 0.6, 0.02, rgb(0xeee8da));
      const nf = Math.max(1, Math.round(b.w / 3));
      for (let k = 0; k < nf; k++) {
        const u = -hw + (b.w * (k + 0.5)) / nf;
        det.fenetre(f, hw, hd, u, e * H1 + 0.9, 1.6, 1.0, 0.04, lit && rng() < 0.6 ? rgb(LUMIERE, 1.6) : rgb(0x3a3430));
        for (let j = 0; j < 7; j++) det.fenetre(f, hw, hd, u - 0.7 + j * 0.233, e * H1 + 0.9, 0.06, 1.0, 0.06, rgb(st.bois));
      }
    }
  }
  // poteaux d'angle et toit à deux pans
  for (const f of ['pz', 'nz'] as const) for (const u of [-hw, hw]) det.fenetre(f, hw, hd, u, 0, 0.22, H, 0.06, rgb(st.bois));
  parts.push(toitPignon(b.w + 0.8, b.d + 1.6, 1.9, H - 0.1, TUILE));
  parts.push(coloredBox(b.w + 1.0, 0.3, 0.42, 0, H + 1.7, 0, TUILE_FAITE));
  return finir([corps.geometrie(), ...parts], [det.geometrie()]);
}

interface StyleImmeubleJp { mur: number; vitre: number; enseignes: number[] }
const STYLES_IMMEUBLE_JP: StyleImmeubleJp[] = [
  { mur: 0xd8cbb0, vitre: 0x34465a, enseignes: [0xf2f0e8, 0xffd23f] },
  { mur: 0xa0a4aa, vitre: 0x2c3a4c, enseignes: [0xe03a3a, 0xf2f0e8] },
  { mur: 0xe8e6e0, vitre: 0x384a5e, enseignes: [0x2a63c8, 0xffd23f] },
  { mur: 0x9a7a62, vitre: 0x2e3a48, enseignes: [0xffd23f, 0xe03a3a] },
];

/** Petit immeuble de ville : grille de fenêtres, climatiseurs, vitrine et store, enseignes verticales en saillie (allumées au coucher). */
export function immeubleJpGeometry(b: Batiment, ambiance: Ambiance, graine: number): Part {
  const st = STYLES_IMMEUBLE_JP[b.style % STYLES_IMMEUBLE_JP.length];
  const rng = mulberry32(graine * 53 + 11);
  const corps = new Assemblage(), det = new Assemblage();
  const hw = b.w / 2, hd = b.d / 2, HE = 3.2, H = b.etages * HE;
  const lit = ambiance !== 'jour';
  corps.boite(b.w, H + 4, b.d, 0, -4, 0, rgb(st.mur));
  corps.boite(b.w + 0.3, 0.35, b.d + 0.3, 0, H, 0, rgb(0x6a6a6a)); // acrotère
  // château d'eau ou panneau sur le toit
  if (rng() < 0.5) {
    corps.boite(1.6, 1.4, 1.6, (rng() - 0.5) * (b.w - 3), H + 0.35, (rng() - 0.5) * (b.d - 3), rgb(0x9aa0a6));
  } else {
    corps.boite(b.w * 0.7, 2.2, 0.15, 0, H + 1.2, 0, rgb(st.enseignes[0], lit ? 1.6 : 1));
    for (const x of [-b.w * 0.3, b.w * 0.3]) corps.boite(0.12, 1.3, 0.12, x, H + 0.35, 0, rgb(0x4a4a50));
  }
  for (const f of ['pz', 'nz'] as const) {
    // rez-de-chaussée : vitrine claire, store coloré
    det.fenetre(f, hw, hd, 0, 0.2, b.w - 1.2, 2.4, 0.03, lit ? rgb(0xfff2c8, 1.6) : rgb(0x8fb2cc));
    det.fenetre(f, hw, hd, 0, 2.6, b.w - 0.6, 0.45, 0.25, rgb(st.enseignes[1]));
    const cols = Math.max(1, Math.floor((b.w - 0.8) / 2.4));
    for (let e = 1; e < b.etages; e++) {
      for (let i = 0; i < cols; i++) {
        const u = -hw + (b.w * (i + 0.5)) / cols;
        det.fenetre(f, hw, hd, u, e * HE + 0.8, 1.6, 1.4, 0.04, lit && rng() < 0.5 ? rgb(LUMIERE, 1.8) : rgb(st.vitre));
        if (rng() < 0.35) det.fenetre(f, hw, hd, u + 0.55, e * HE + 0.25, 0.7, 0.5, 0.3, rgb(0xd8d8d0)); // climatiseur
      }
      det.fenetre(f, hw, hd, 0, e * HE - 0.1, b.w, 0.12, 0.05, rgb(0x8a8a86)); // bandeau d'étage
    }
  }
  // enseignes verticales en saillie, vers la route (des deux côtés)
  const parts: Part[] = [];
  const gain = lit ? 1.9 : 1.1;
  for (const s of [-1, 1]) {
    const x = (rng() < 0.5 ? -1 : 1) * (hw - 0.7), h = Math.min(H - 2, 3 + rng() * (H - 4)), y0 = 3.4;
    const fond = st.enseignes[Math.floor(rng() * st.enseignes.length)], encre = fond === 0xf2f0e8 || fond === 0xffd23f ? 0xc0302a : 0xf2f0e8;
    parts.push(coloredBox(0.14, 0.2, 0.9, x, y0 + h / 2, s * (hd + 0.45), 0x4a4a50));
    parts.push(lumineux(new THREE.BoxGeometry(0.8, h, 0.3).translate(x, y0 + h / 2, s * (hd + 0.75)), fond, gain));
    const n = Math.max(2, Math.floor(h / 0.75));
    for (let k = 0; k < n; k++) {
      for (const dx of [-0.41, 0.41]) parts.push(lumineux(new THREE.BoxGeometry(0.02, 0.5, 0.2).translate(x + dx, y0 + h - 0.45 - k * (h - 0.4) / n, s * (hd + 0.75)), encre, gain));
    }
  }
  return finir([corps.geometrie()], [det.geometrie(), ...parts]);
}

/** Distributeur de boissons : 0 = blanc et bleu, 1 = rouge ; vitrine éclairée côté −z (vers la route). */
export function distributeurGeometry(variant: number, ambiance: Ambiance): Part {
  const corpsC = variant === 0 ? 0xe8ecf0 : 0xc8282a, bande = variant === 0 ? 0x2a5ac8 : 0xf2f0e8;
  const gain = ambiance !== 'jour' ? 2.2 : 1.35;
  const parts: Part[] = [
    coloredBox(1.0, 1.9, 0.75, 0, -0.05, 0, corpsC),
    coloredBox(1.02, 0.25, 0.77, 0, 1.6, 0, bande),
    lumineux(new THREE.BoxGeometry(0.82, 0.9, 0.02).translate(0, 1.15, -0.385), 0xf6f8ff, gain),
    coloredBox(0.6, 0.18, 0.04, 0, 0.25, -0.39, 0x1e1e24),
    coloredBox(0.2, 0.3, 0.04, 0.3, 0.75, -0.39, 0x3a3a44),
  ];
  const canettes = [0xe8402a, 0x2a8ae8, 0xf2c23a, 0x3ab85a, 0xf2f0e8, 0x8a4ad8];
  for (let r = 0; r < 3; r++) for (let k = 0; k < 6; k++) {
    parts.push(lumineux(new THREE.BoxGeometry(0.08, 0.16, 0.03).translate(-0.3 + k * 0.12, 0.82 + r * 0.29, -0.4), canettes[(r * 2 + k) % canettes.length], gain * 0.9));
  }
  return merge(parts);
}

/** Poteau électrique en béton : traverses, isolateurs, transformateur, hauban. Traverses selon x (perpendiculaires à la route). */
export function poteauJpGeometry(): Part {
  const B = 0xa8a6a0, F = 0x3a3a40;
  const parts: Part[] = [tube(0.17, 0.12, 9.6, 0, -0.4, 0, B, 8)];
  for (const [y, l] of [[8.6, 1.9], [7.8, 1.5]] as [number, number][]) {
    parts.push(coloredBox(l, 0.12, 0.12, 0, y, 0, F));
    for (const x of [-l / 2 + 0.1, 0, l / 2 - 0.1]) parts.push(tube(0.05, 0.04, 0.18, x, y + 0.06, 0, 0xe8e8e2, 5));
  }
  parts.push(tube(0.3, 0.3, 0.75, 0.38, 6.1, 0, 0x8a9096, 8), coloredBox(0.2, 0.08, 0.2, 0.38, 6.85, 0, F));
  // hauban côté extérieur (+x), gaine jaune
  parts.push(barre([0, 7.4, 0], [2.6, 0, 0], 0.02, F, 4), coloredBox(0.14, 1.6, 0.06, 0, 2.2, 0.15, 0xf2d22a));
  // plaque d'adresse bleue
  parts.push(coloredBox(0.3, 0.55, 0.03, 0, 2.6, -0.16, 0x2a5ac8));
  return merge(parts);
}

/** Modèles des villages et rues du japon, par clé `kind + variante`. */
export function decorJaponVille(ambiance: Ambiance): Record<string, Part> {
  const d: Record<string, Part> = {};
  MINKAS.forEach((b, i) => { d[`minka${i}`] = minkaGeometry(b, ambiance); });
  MACHIYAS.forEach((b, i) => { d[`machiya${i}`] = machiyaGeometry(b, ambiance, i + 1); });
  IMMEUBLES_JP.forEach((b, i) => { d[`immeubleJp${i}`] = immeubleJpGeometry(b, ambiance, i + 1); });
  for (let i = 0; i < 2; i++) d[`distributeur${i}`] = distributeurGeometry(i, ambiance);
  d.poteauJp0 = poteauJpGeometry();
  return d;
}
