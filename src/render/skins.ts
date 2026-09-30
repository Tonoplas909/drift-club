import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resoudreTeinte, couleurEffective, type SkinDef, type SkinElement, type Teinte, type ZoneBande } from '../core/skins';
import { mulberry32 } from '../core/math/rng';
import { colorize } from './procedural';
import { arch, type CarShape } from './jdmCars';

type Pt = [number, number]; // (z, y) dans le plan de profil de la voiture

/** Chanfrein de la caisse (extrudeProfile) : les dessus sont décalés de ce bevel vers l'extérieur. */
const BEVEL = 0.04;
/** Épaisseur des décors au-dessus de la surface (m) : assez pour éviter le z-fighting, invisible à l'œil. */
const EPAIS = 0.012;
/** Profondeur dont les décors s'enfoncent dans la caisse (cachée) pour ne laisser aucun jour. */
const ENFONCE = 0.02;

/** Prisme d'un polygone (z, y) entre x0 et x1 (mêmes conventions que extrudeProfile : forme x→z monde, extrusion → x monde). */
function slab(poly: Pt[], x0: number, x1: number, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const shape = new THREE.Shape(poly.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(-Math.PI / 2);
  g.translate(x1, 0, 0);
  return colorize(g, color);
}

const rect = (z0: number, z1: number, y0: number, y1: number): Pt[] => [[z0, y0], [z1, y0], [z1, y1], [z0, y1]];

/** Bande le long d'une polyligne (avant → arrière) : dessus à `dHaut`, dessous à `dBas` de la surface, décalages à angle vif constants. */
function ruban(pts: Pt[], dHaut: number, dBas: number): Pt[] {
  const normale = (a: Pt, b: Pt): Pt => {
    const dz = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dz, dy) || 1;
    return [dy / l, -dz / l]; // vers le haut quand la polyligne va vers l'arrière (dz < 0)
  };
  const decale = (d: number): Pt[] => pts.map((p, i) => {
    const n0 = normale(pts[Math.max(0, i - 1)], pts[i]), n1 = normale(pts[i], pts[Math.min(pts.length - 1, i + 1)]);
    const mz = n0[0] + n1[0], my = n0[1] + n1[1], ml = Math.hypot(mz, my) || 1;
    const m: Pt = [mz / ml, my / ml];
    const k = d / Math.max(0.5, m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
  return [...decale(dHaut), ...decale(dBas).reverse()];
}

/** Interpolation linéaire d'une polyligne triée par z croissant ; valeur bornée aux extrémités. */
function interp(pts: Pt[], z: number): number {
  if (z <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (z <= pts[i][0]) {
      const [z0, y0] = pts[i - 1], [z1, y1] = pts[i];
      return z1 === z0 ? y1 : y0 + ((y1 - y0) * (z - z0)) / (z1 - z0);
    }
  }
  return pts[pts.length - 1][1];
}

/** Ligne haute de la caisse (plan latéral, sans chanfrein), z croissant. */
function hautCaisse(s: CarShape): Pt[] {
  const h = s.length / 2;
  return [[-h, s.tailY], [-h + 0.15, s.deckY], [s.deckZ, s.deckY], [s.cowlZ, s.cowlY], [h - 0.25, s.hoodFrontY + 0.04], [h - 0.03, s.hoodFrontY]];
}

/** Dessus du capot, de l'avant vers le pare-brise. */
const dessusCapot = (s: CarShape): Pt[] => [[s.length / 2 - 0.03, s.hoodFrontY], [s.length / 2 - 0.25, s.hoodFrontY + 0.04], [s.cowlZ, s.cowlY]];

/** Ligne basse de la caisse avec passages de roues (mêmes arches que bodyProfile), z croissant. */
function basCaisse(s: CarShape): Pt[] {
  const y0 = s.groundClear, ar = s.wheelR + 0.09;
  return [[-s.length / 2, y0], ...arch(s.rearAxle, y0, ar), ...arch(s.frontAxle, y0, ar), [s.length / 2, y0]];
}

/** Intervalle en z entre les passages de roues (marge `m`). */
const entreRoues = (s: CarShape, m: number): [number, number] => {
  const ar = s.wheelR + 0.09;
  return [s.rearAxle + ar + m, s.frontAxle - ar - m];
};

/** Plages x d'un décor plaqué sur le flanc `side` (±1), légèrement enfoncé dans la caisse. */
const xFlanc = (s: CarShape, side: number, epais = EPAIS): [number, number] =>
  side > 0 ? [s.width / 2 - 0.004, s.width / 2 + epais - 0.004] : [-s.width / 2 - epais + 0.004, -s.width / 2 + 0.004];

/** Bande latérale entre deux courbes `lo`/`hi` (z → y), coupée là où elle sortirait de la caisse (passages de roues, haut de caisse). */
function bandeFlanc(s: CarShape, side: number, lo: (z: number) => number, hi: (z: number) => number, z0: number, z1: number, color: THREE.ColorRepresentation, ep = EPAIS, N = 64): THREE.BufferGeometry[] {
  const haut = hautCaisse(s), bas = basCaisse(s);
  const out: THREE.BufferGeometry[] = [];
  let run: { z: number; yl: number; yh: number }[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const [xa, xb] = xFlanc(s, side, ep);
      out.push(slab([...run.map((p): Pt => [p.z, p.yh]), ...run.map((p): Pt => [p.z, p.yl]).reverse()], xa, xb, color));
    }
    run = [];
  };
  for (let i = 0; i <= N; i++) {
    const z = z1 + ((z0 - z1) * i) / N;
    const yl = Math.max(lo(z), interp(bas, z) + 0.015), yh = Math.min(hi(z), interp(haut, z) - 0.015);
    if (yh - yl > 0.025) run.push({ z, yl, yh });
    else flush();
  }
  flush();
  return out;
}

const SEGMENTS: Record<string, string> = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg',
};

/** Rectangles (u, v) — u vers la droite du lecteur, v vers le haut — d'un chiffre à 7 segments centré sur l'origine. */
function chiffre(c: string, dw: number, dh: number, t: number): [number, number, number, number][] {
  const w2 = dw / 2, h2 = dh / 2;
  const seg: Record<string, [number, number, number, number]> = {
    a: [-w2, w2, h2 - t, h2], d: [-w2, w2, -h2, -h2 + t], g: [-w2, w2, -t / 2, t / 2],
    b: [w2 - t, w2, 0, h2], c: [w2 - t, w2, -h2, 0], f: [-w2, -w2 + t, 0, h2], e: [-w2, -w2 + t, -h2, 0],
  };
  return [...(SEGMENTS[c] ?? '')].map((k) => seg[k]);
}

type Couleur = (t: Teinte) => THREE.Color;

/** Contexte de génération d'un élément : forme, résolution des teintes et épaisseur de sa couche (les éléments suivants passent au-dessus). */
interface Ctx { s: CarShape; col: Couleur; ep: number }

/** Épaisseur de la couche `k` : chaque élément de la livrée est posé un peu plus haut que le précédent (pas de z-fighting entre décors). */
const epaisCouche = (k: number): number => EPAIS + Math.min(k, 3) * 0.006;

/** Décor de flanc : pour chaque côté, `f(side)` renvoie les pièces ; l'orientation de lecture est gérée par l'appelant. */
const deuxCotes = (f: (side: number) => THREE.BufferGeometry[]): THREE.BufferGeometry[] => [...f(1), ...f(-1)];

/** Un polygone (z, y) tient-il entièrement sur le flanc (hors passages de roues, haut de caisse, pare-chocs) ? Les arêtes sont échantillonnées. */
function surFlanc(s: CarShape, poly: Pt[]): boolean {
  const haut = hautCaisse(s), bas = basCaisse(s), h = s.length / 2;
  const ok = (z: number, y: number): boolean => z > -h + 0.2 && z < h - 0.3 && y >= interp(bas, z) + 0.015 && y <= interp(haut, z) - 0.02;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let k = 0; k < 4; k++) if (!ok(a[0] + ((b[0] - a[0]) * k) / 4, a[1] + ((b[1] - a[1]) * k) / 4)) return false;
  }
  return true;
}

/** Pose sur les deux flancs les polygones qui tiennent sur la caisse (les autres sont écartés). */
function poserFlancs(c: Ctx, polys: Pt[][], color: THREE.Color, epExtra = 0): THREE.BufferGeometry[] {
  const ok = polys.filter((p) => surFlanc(c.s, p));
  return deuxCotes((side) => {
    const [xa, xb] = xFlanc(c.s, side, c.ep + epExtra);
    return ok.map((p) => slab(p, xa, xb, color));
  });
}

/** Dessus du capot entre les abscisses za (avant) et zb (arrière), za > zb. */
function capotEntre(s: CarShape, za: number, zb: number): Pt[] {
  const d = dessusCapot(s), asc = [...d].reverse();
  return [[za, interp(asc, za)], ...d.filter(([z]) => z < za && z > zb), [zb, interp(asc, zb)]];
}

/** Cases d'une grille couvrant le capot (colonnes en x, rangées en z) ; `f(i, j, x0, x1, zAvant, zArriere)` renvoie la pièce ou null. */
function grilleCapot(s: CarShape, t: number, f: (i: number, j: number, x0: number, x1: number, za: number, zb: number) => THREE.BufferGeometry | null): THREE.BufferGeometry[] {
  const hw = s.width / 2 - 0.1, nx = Math.max(1, Math.floor((2 * hw) / t) | 1), tx = (2 * hw) / nx;
  const zAv = s.length / 2 - 0.2, zAr = s.cowlZ + 0.03, nz = Math.max(1, Math.floor((zAv - zAr) / t)), tz = (zAv - zAr) / nz;
  const out: THREE.BufferGeometry[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const g = f(i, j, -hw + i * tx, -hw + (i + 1) * tx, zAv - j * tz, zAv - (j + 1) * tz);
    if (g) out.push(g);
  }
  return out;
}

/** Cases d'une grille couvrant le toit ; `f(i, j, x0, x1, z0, z1)` (z0 < z1) renvoie la pièce ou null. */
function grilleToit(s: CarShape, t: number, f: (i: number, j: number, x0: number, x1: number, z0: number, z1: number) => THREE.BufferGeometry | null): THREE.BufferGeometry[] {
  const hw = (s.width - 0.3 - 0.02) / 2 + 0.004, nx = Math.max(1, Math.floor((2 * hw) / t) | 1), tx = (2 * hw) / nx;
  const z0 = s.roofRearZ - 0.02, z1 = s.roofFrontZ + 0.02, nz = Math.max(1, Math.round((z1 - z0) / t)), tz = (z1 - z0) / nz;
  const out: THREE.BufferGeometry[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const g = f(i, j, -hw + i * tx, -hw + (i + 1) * tx, z0 + j * tz, z0 + (j + 1) * tz);
    if (g) out.push(g);
  }
  return out;
}

const dalleToit = (s: CarShape, ep: number, x0: number, x1: number, z0: number, z1: number, c: THREE.Color): THREE.BufferGeometry =>
  slab(rect(z0, z1, s.roofY + 0.045, s.roofY + 0.055 + ep), x0, x1, c);

const dalleCapot = (s: CarShape, ep: number, x0: number, x1: number, za: number, zb: number, c: THREE.Color): THREE.BufferGeometry =>
  slab(ruban(capotEntre(s, za, zb), BEVEL + ep, BEVEL - ENFONCE), x0, x1, c);

function bandes(c: Ctx, e: Extract<SkinElement, { type: 'bandes' }>): THREE.BufferGeometry[] {
  const { s, ep } = c, h = s.length / 2, zones: ZoneBande[] = e.zones ?? ['capot', 'toit', 'coffre'];
  const col = c.col(e.teinte);
  const bandesX: [number, number][] = e.ecart > 0
    ? [[-e.ecart / 2 - e.largeur, -e.ecart / 2], [e.ecart / 2, e.ecart / 2 + e.largeur]]
    : [[-e.largeur / 2, e.largeur / 2]];
  const out: THREE.BufferGeometry[] = [];
  for (const [x0, x1] of bandesX) {
    if (zones.includes('capot')) out.push(slab(ruban(dessusCapot(s), BEVEL + ep, BEVEL - ENFONCE), x0, x1, col));
    if (zones.includes('toit')) out.push(slab(rect(s.roofRearZ - 0.02, s.roofFrontZ + 0.02, s.roofY + 0.045, s.roofY + 0.055 + ep), x0, x1, col));
    // coffre : seulement s'il reste de la tablette derrière la lunette (la « Légère » n'en a presque pas)
    if (zones.includes('coffre') && s.deckZ - (-h + 0.15) > 0.3) {
      out.push(slab(ruban([[s.deckZ - 0.1, s.deckY], [-h + 0.15, s.deckY], [-h, s.tailY]], BEVEL + ep, BEVEL - ENFONCE), x0, x1, col));
    }
  }
  return out;
}

function toit(c: Ctx, e: Extract<SkinElement, { type: 'toit' }>): THREE.BufferGeometry[] {
  const { s, ep } = c, hw = (s.width - 0.3 - 0.02) / 2 + 0.004;
  return [slab(rect(s.roofRearZ - 0.045, s.roofFrontZ + 0.045, s.roofY + 0.045, s.roofY + 0.055 + ep), -hw, hw, c.col(e.teinte))];
}

function capot(c: Ctx, e: Extract<SkinElement, { type: 'capot' }>): THREE.BufferGeometry[] {
  const { s, ep } = c, hw = s.width / 2 - 0.1;
  return [slab(ruban(dessusCapot(s), BEVEL + ep, BEVEL - ENFONCE), -hw, hw, c.col(e.teinte))];
}

function basDeCaisse(c: Ctx, e: Extract<SkinElement, { type: 'basDeCaisse' }>): THREE.BufferGeometry[] {
  const { s } = c, y0 = s.groundClear, h = s.length / 2, col = c.col(e.teinte);
  return deuxCotes((side) => bandeFlanc(s, side, () => y0, () => y0 + e.hauteur, -h + 0.2, h - 0.2, col, c.ep));
}

function laterale(c: Ctx, e: Extract<SkinElement, { type: 'laterale' }>): THREE.BufferGeometry[] {
  const { s } = c, h = s.length / 2, haut = hautCaisse(s), col = c.col(e.teinte);
  return deuxCotes((side) => bandeFlanc(s, side, (z) => interp(haut, z) - e.haut, (z) => interp(haut, z) - e.bas, -h + 0.2, h - 0.3, col, c.ep));
}

function portieres(c: Ctx, e: Extract<SkinElement, { type: 'portieres' }>): THREE.BufferGeometry[] {
  const { s } = c, haut = hautCaisse(s), [za, zb] = entreRoues(s, 0.04), col = c.col(e.teinte);
  return deuxCotes((side) => bandeFlanc(s, side, () => s.groundClear + e.bas, (z) => interp(haut, z) - e.haut, za, zb, col, c.ep));
}

function numero(c: Ctx, e: Extract<SkinElement, { type: 'numero' }>): THREE.BufferGeometry[] {
  const { s, ep } = c;
  const R = 0.17, [za, zb] = entreRoues(s, R + 0.05), zc = za + (zb - za) * (e.pos ?? 0.5);
  const haut = hautCaisse(s), yc = (s.groundClear + 0.05 + interp(haut, zc) - 0.04) / 2;
  const fond = c.col(e.fond), encre = c.col(e.encre);
  const dw = 0.09, dh = 0.2, t = 0.03, gap = 0.04, n = e.chiffres.length;
  const total = n * dw + (n - 1) * gap;
  return deuxCotes((side) => {
    const [xa, xb] = xFlanc(s, side, ep), [ya, yb] = xFlanc(s, side, ep + 0.008);
    const forme: Pt[] = e.forme === 'carre'
      ? rect(zc - R, zc + R, yc - R, yc + R)
      : Array.from({ length: 20 }, (_, i) => [zc + R * Math.cos((i / 20) * Math.PI * 2), yc + R * Math.sin((i / 20) * Math.PI * 2)]);
    const parts = [slab(forme, xa, xb, fond)];
    // u vers la droite du lecteur : à gauche de la voiture (x > 0) la droite est l'arrière (−z), à l'opposé sur l'autre flanc
    [...e.chiffres].forEach((ch, k) => {
      const u0 = -total / 2 + k * (dw + gap) + dw / 2;
      for (const [ua, ub, va, vb] of chiffre(ch, dw, dh, t)) {
        const za2 = zc - side * (u0 + ua), zb2 = zc - side * (u0 + ub);
        parts.push(slab(rect(Math.min(za2, zb2), Math.max(za2, zb2), yc + va, yc + vb), ya, yb, encre));
      }
    });
    return parts;
  });
}

function chevrons(c: Ctx, e: Extract<SkinElement, { type: 'chevrons' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.05), col = c.col(e.teinte);
  const z0 = za + (zb - za) * e.zone[0], z1 = za + (zb - za) * e.zone[1];
  const y0 = s.groundClear + 0.17, y1 = s.groundClear + 0.31, bw = 0.06, skew = 0.09;
  const pas = e.nombre > 1 ? (z1 - z0 - bw - skew) / (e.nombre - 1) : 0;
  const polys: Pt[][] = [];
  for (let i = 0; i < e.nombre; i++) {
    const z = z0 + skew + i * pas; // pied du chevron ; le haut est penché vers l'arrière (−z)
    polys.push([[z, y0], [z + bw, y0], [z + bw - skew, y1], [z - skew, y1]]);
  }
  return poserFlancs(c, polys, col);
}

function damier(c: Ctx, e: Extract<SkinElement, { type: 'damier' }>): THREE.BufferGeometry[] {
  const { s, ep } = c, col = c.col(e.teinte), t = e.taille;
  if (e.zone === 'capot') return grilleCapot(s, t, (i, j, x0, x1, za, zb) => ((i + j) % 2 === 0 ? dalleCapot(s, ep, x0, x1, za, zb, col) : null));
  if (e.zone === 'toit') return grilleToit(s, t, (i, j, x0, x1, z0, z1) => ((i + j) % 2 === 0 ? dalleToit(s, ep, x0, x1, z0, z1, col) : null));
  const [za, zb] = entreRoues(s, 0.06), n = Math.floor((zb - za) / t), z0 = za + (zb - za - n * t) / 2, y0 = s.groundClear + 0.2;
  const polys: Pt[][] = [];
  for (let r = 0; r < 2; r++) for (let i = 0; i < n; i++) if ((i + r) % 2 === 0) polys.push(rect(z0 + i * t, z0 + (i + 1) * t, y0 + r * t, y0 + (r + 1) * t));
  return poserFlancs(c, polys, col);
}

/** Forme d'une langue de flamme partant de (z0, yb), large de `w` à la racine, longue de `L`, la pointe se relevant. */
const langue = (z0: number, yb: number, L: number, w: number): Pt[] => [
  [z0, yb], [z0 - 0.45 * L, yb + 0.1 * w], [z0 - L, yb + 0.62 * w + 0.07], [z0 - 0.62 * L, yb + 0.86 * w], [z0 - 0.3 * L, yb + 0.9 * w], [z0, yb + w],
];

function flammes(c: Ctx, e: Extract<SkinElement, { type: 'flammes' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.05), L = (zb - za) * 0.68, n = e.nombre, H = 0.4, pas = H / n, w = pas * 1.7;
  const LONG = [1, 0.66, 0.85, 0.5];
  const ext: Pt[][] = [], cur: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const yb = s.groundClear + 0.1 + i * pas, l = L * LONG[i % LONG.length];
    ext.push(langue(zb, yb, l, w));
    cur.push(langue(zb, yb + w * 0.25, l * 0.55, w * 0.5));
  }
  return [...poserFlancs(c, ext, c.col(e.teinte)), ...poserFlancs(c, cur, c.col(e.coeur), 0.006)];
}

/** Éclair vertical dans un carré unité (u vers la droite, v vers le haut). */
const ECLAIR: Pt[] = [[0.35, 1], [0.85, 1], [0.6, 0.62], [0.9, 0.62], [0.25, 0], [0.38, 0.42], [0.1, 0.42]];

function eclairs(c: Ctx, e: Extract<SkinElement, { type: 'eclairs' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.12), W = 0.3, H = 0.42, y0 = s.groundClear + 0.07, pas = (zb - za) / e.nombre;
  const polys: Pt[][] = [];
  for (let i = 0; i < e.nombre; i++) {
    const zc = za + pas * (i + 0.5);
    polys.push(ECLAIR.map(([u, v]): Pt => [zc + (u - 0.5) * W, y0 + v * H]));
  }
  return poserFlancs(c, polys, c.col(e.teinte));
}

function pois(c: Ctx, e: Extract<SkinElement, { type: 'pois' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.05), yc = s.groundClear + 0.3, dy = e.pas * 0.87;
  const rangs = Math.max(1, Math.floor(0.5 / dy) + 1), polys: Pt[][] = [];
  for (let r = 0; r < rangs; r++) {
    const y = yc + (r - (rangs - 1) / 2) * dy, decal = r % 2 ? e.pas / 2 : 0;
    for (let z = za + e.rayon + decal; z <= zb - e.rayon; z += e.pas) {
      polys.push(Array.from({ length: 12 }, (_, k): Pt => [z + e.rayon * Math.cos((k / 12) * Math.PI * 2), y + e.rayon * Math.sin((k / 12) * Math.PI * 2)]));
    }
  }
  return poserFlancs(c, polys, c.col(e.teinte));
}

function diagonales(c: Ctx, e: Extract<SkinElement, { type: 'diagonales' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.03), pente = 1.2, epaisV = e.largeur * Math.sqrt(1 + pente * pente);
  const yc = s.groundClear + 0.3, col = c.col(e.teinte), pas = (zb - za) / (e.nombre + 1);
  return deuxCotes((side) => {
    const out: THREE.BufferGeometry[] = [];
    for (let i = 1; i <= e.nombre; i++) {
      const zi = za + pas * i;
      // bande oblique montant vers l'avant, de largeur `largeur` mesurée perpendiculairement
      out.push(...bandeFlanc(s, side, (z) => yc + pente * (z - zi) - epaisV / 2, (z) => yc + pente * (z - zi) + epaisV / 2, zi - 0.5, zi + 0.5, col, c.ep, 96));
    }
    return out;
  });
}

function dents(c: Ctx, e: Extract<SkinElement, { type: 'dents' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.05), n = Math.floor((zb - za) / e.pas), z0 = za + (zb - za - n * e.pas) / 2, y0 = s.groundClear + 0.025;
  const polys: Pt[][] = [];
  for (let i = 0; i < n; i++) polys.push([[z0 + i * e.pas, y0], [z0 + (i + 1) * e.pas, y0], [z0 + (i + 0.5) * e.pas, y0 + e.hauteur]]);
  return poserFlancs(c, polys, c.col(e.teinte));
}

function degrade(c: Ctx, e: Extract<SkinElement, { type: 'degrade' }>): THREE.BufferGeometry[] {
  const { s } = c, [za, zb] = entreRoues(s, 0.05), n = e.teintes.length;
  const out: THREE.BufferGeometry[] = [];
  e.teintes.forEach((t, i) => {
    const y = s.groundClear + 0.12 + i * (e.hauteur + e.ecart), col = c.col(t);
    // barres ancrées à l'arrière, de plus en plus courtes vers le haut : effet de traînée
    const fin = za + (zb - za) * (1 - (0.55 * i) / Math.max(1, n));
    out.push(...deuxCotes((side) => bandeFlanc(s, side, () => y, () => y + e.hauteur, za, fin, col, c.ep)));
  });
  return out;
}

/** Camouflage en cases : pour chaque case, rien (carrosserie visible) ou une teinte, avec de la cohérence entre voisines. */
function camouflage(c: Ctx, e: Extract<SkinElement, { type: 'camouflage' }>): THREE.BufferGeometry[] {
  const { s, ep } = c, t = e.case, n = e.teintes.length;
  if (n === 0) return [];
  const cols = e.teintes.map((x) => c.col(x));
  const out: THREE.BufferGeometry[] = [];
  /** Tire la teinte d'une case : -1 = aucune ; 45 % du temps on prolonge la voisine de gauche. */
  const tirer = (rng: () => number, gauche: number): number => (gauche !== -2 && rng() < 0.45 ? gauche : rng() < 0.35 ? -1 : Math.min(n - 1, Math.floor(rng() * n)));
  // flancs : rangées de cases, cases fusionnées quand elles se suivent avec la même teinte
  const h = s.length / 2, nz = Math.floor((s.length - 0.7) / t), z0 = -h + 0.35 + ((s.length - 0.7) - nz * t) / 2, nr = Math.floor(0.6 / t);
  for (const side of [1, -1]) {
    const rng = mulberry32(e.graine * 7919 + (side > 0 ? 1 : 2));
    const [xa, xb] = xFlanc(s, side, ep);
    for (let r = 0; r < nr; r++) {
      let g = -2, debut = 0;
      const fin = (i: number): void => {
        if (g >= 0) {
          const p = rect(z0 + debut * t, z0 + i * t, s.groundClear + 0.03 + r * t, s.groundClear + 0.03 + (r + 1) * t);
          if (surFlanc(s, p)) out.push(slab(p, xa, xb, cols[g]));
        }
      };
      for (let i = 0; i < nz; i++) {
        const v = tirer(rng, g);
        if (v !== g) { fin(i); g = v; debut = i; }
      }
      fin(nz);
    }
  }
  // capot et toit : rangées de cases fusionnées le long de x
  const rng = mulberry32(e.graine * 7919 + 3);
  const balayer = (grille: typeof grilleCapot | typeof grilleToit, poser: (x0: number, x1: number, a: number, b: number, col: THREE.Color) => THREE.BufferGeometry): void => {
    let g = -2, rang = -1, x0 = 0, x1 = 0, a = 0, b = 0;
    const vider = (): void => { if (g >= 0) out.push(poser(x0, x1, a, b, cols[g])); };
    grille(s, t, (i, j, cx0, cx1, ca, cb) => {
      if (j !== rang) { vider(); g = -2; rang = j; }
      const v = tirer(rng, g);
      if (v !== g) { vider(); g = v; x0 = cx0; }
      x1 = cx1; a = ca; b = cb;
      return null;
    });
    vider();
  };
  balayer(grilleCapot, (xa, xb, za, zb, col) => dalleCapot(s, ep, xa, xb, za, zb, col));
  balayer(grilleToit, (xa, xb, za, zb, col) => dalleToit(s, ep, xa, xb, za, zb, col));
  return out;
}

/**
 * Géométrie (une seule, fusionnée) des décors d'une livrée pour la couleur principale `principale` (#rrggbb) ;
 * `null` si la livrée n'a aucun décor. Aucune couleur sentinelle : tout est déjà résolu.
 * Une livrée à couleur imposée (`couleurForcee`) résout ses teintes dérivées sur cette couleur, pas sur `principale`.
 * Les décors sont de fines dalles posées sur la caisse (`EPAIS` au-dessus, le reste enfoncé), sans contour propre ;
 * chaque élément de la liste est posé une couche plus haut que le précédent.
 */
export function buildSkinGeometry(shape: CarShape, skin: SkinDef, principale: string): THREE.BufferGeometry | null {
  const base = couleurEffective(skin, principale);
  const cache = new Map<Teinte, THREE.Color>();
  const col: Couleur = (t) => {
    let c = cache.get(t);
    if (!c) cache.set(t, (c = new THREE.Color(resoudreTeinte(t, base))));
    return c;
  };
  const parts: THREE.BufferGeometry[] = [];
  skin.elements.forEach((e, k) => {
    const c: Ctx = { s: shape, col, ep: epaisCouche(k) };
    switch (e.type) {
      case 'bandes': parts.push(...bandes(c, e)); break;
      case 'toit': parts.push(...toit(c, e)); break;
      case 'capot': parts.push(...capot(c, e)); break;
      case 'basDeCaisse': parts.push(...basDeCaisse(c, e)); break;
      case 'laterale': parts.push(...laterale(c, e)); break;
      case 'portieres': parts.push(...portieres(c, e)); break;
      case 'numero': parts.push(...numero(c, e)); break;
      case 'chevrons': parts.push(...chevrons(c, e)); break;
      case 'damier': parts.push(...damier(c, e)); break;
      case 'flammes': parts.push(...flammes(c, e)); break;
      case 'eclairs': parts.push(...eclairs(c, e)); break;
      case 'camouflage': parts.push(...camouflage(c, e)); break;
      case 'pois': parts.push(...pois(c, e)); break;
      case 'diagonales': parts.push(...diagonales(c, e)); break;
      case 'dents': parts.push(...dents(c, e)); break;
      case 'degrade': parts.push(...degrade(c, e)); break;
    }
  });
  if (parts.length === 0) return null;
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!g) return null;
  g.computeBoundingSphere();
  return g;
}
