import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resoudreTeinte, type SkinDef, type SkinElement, type Teinte, type ZoneBande } from '../core/skins';
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
function bandeFlanc(s: CarShape, side: number, lo: (z: number) => number, hi: (z: number) => number, z0: number, z1: number, color: THREE.ColorRepresentation): THREE.BufferGeometry[] {
  const haut = hautCaisse(s), bas = basCaisse(s), N = 64;
  const out: THREE.BufferGeometry[] = [];
  let run: { z: number; yl: number; yh: number }[] = [];
  const flush = () => {
    if (run.length >= 2) {
      const [xa, xb] = xFlanc(s, side);
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

/** Décor de flanc : pour chaque côté, `f(side)` renvoie les pièces ; l'orientation de lecture est gérée par l'appelant. */
const deuxCotes = (f: (side: number) => THREE.BufferGeometry[]): THREE.BufferGeometry[] => [...f(1), ...f(-1)];

function bandes(s: CarShape, e: Extract<SkinElement, { type: 'bandes' }>, col: Couleur): THREE.BufferGeometry[] {
  const h = s.length / 2, zones: ZoneBande[] = e.zones ?? ['capot', 'toit', 'coffre'];
  const c = col(e.teinte);
  const bandesX: [number, number][] = e.ecart > 0
    ? [[-e.ecart / 2 - e.largeur, -e.ecart / 2], [e.ecart / 2, e.ecart / 2 + e.largeur]]
    : [[-e.largeur / 2, e.largeur / 2]];
  const out: THREE.BufferGeometry[] = [];
  for (const [x0, x1] of bandesX) {
    if (zones.includes('capot')) out.push(slab(ruban(dessusCapot(s), BEVEL + EPAIS, BEVEL - ENFONCE), x0, x1, c));
    if (zones.includes('toit')) out.push(slab(rect(s.roofRearZ - 0.02, s.roofFrontZ + 0.02, s.roofY + 0.045, s.roofY + 0.055 + EPAIS), x0, x1, c));
    // coffre : seulement s'il reste de la tablette derrière la lunette (la « Légère » n'en a presque pas)
    if (zones.includes('coffre') && s.deckZ - (-h + 0.15) > 0.3) {
      out.push(slab(ruban([[s.deckZ - 0.1, s.deckY], [-h + 0.15, s.deckY], [-h, s.tailY]], BEVEL + EPAIS, BEVEL - ENFONCE), x0, x1, c));
    }
  }
  return out;
}

function toit(s: CarShape, e: Extract<SkinElement, { type: 'toit' }>, col: Couleur): THREE.BufferGeometry[] {
  const hw = (s.width - 0.3 - 0.02) / 2 + 0.004;
  return [slab(rect(s.roofRearZ - 0.045, s.roofFrontZ + 0.045, s.roofY + 0.045, s.roofY + 0.055 + EPAIS), -hw, hw, col(e.teinte))];
}

function capot(s: CarShape, e: Extract<SkinElement, { type: 'capot' }>, col: Couleur): THREE.BufferGeometry[] {
  const hw = s.width / 2 - 0.1;
  return [slab(ruban(dessusCapot(s), BEVEL + EPAIS, BEVEL - ENFONCE), -hw, hw, col(e.teinte))];
}

function basDeCaisse(s: CarShape, e: Extract<SkinElement, { type: 'basDeCaisse' }>, col: Couleur): THREE.BufferGeometry[] {
  const y0 = s.groundClear, h = s.length / 2, c = col(e.teinte);
  return deuxCotes((side) => bandeFlanc(s, side, () => y0, () => y0 + e.hauteur, -h + 0.2, h - 0.2, c));
}

function laterale(s: CarShape, e: Extract<SkinElement, { type: 'laterale' }>, col: Couleur): THREE.BufferGeometry[] {
  const h = s.length / 2, haut = hautCaisse(s), c = col(e.teinte);
  return deuxCotes((side) => bandeFlanc(s, side, (z) => interp(haut, z) - e.haut, (z) => interp(haut, z) - e.bas, -h + 0.2, h - 0.3, c));
}

function numero(s: CarShape, e: Extract<SkinElement, { type: 'numero' }>, col: Couleur): THREE.BufferGeometry[] {
  const R = 0.17, [za, zb] = entreRoues(s, R + 0.05), zc = za + (zb - za) * (e.pos ?? 0.5);
  const haut = hautCaisse(s), yc = (s.groundClear + 0.05 + interp(haut, zc) - 0.04) / 2;
  const fond = col(e.fond), encre = col(e.encre);
  const dw = 0.09, dh = 0.2, t = 0.03, gap = 0.04, n = e.chiffres.length;
  const total = n * dw + (n - 1) * gap;
  return deuxCotes((side) => {
    const [xa, xb] = xFlanc(s, side, EPAIS), [ya, yb] = xFlanc(s, side, EPAIS + 0.008);
    const rond: Pt[] = Array.from({ length: 20 }, (_, i) => [zc + R * Math.cos((i / 20) * Math.PI * 2), yc + R * Math.sin((i / 20) * Math.PI * 2)]);
    const parts = [slab(rond, xa, xb, fond)];
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

function chevrons(s: CarShape, e: Extract<SkinElement, { type: 'chevrons' }>, col: Couleur): THREE.BufferGeometry[] {
  const [za, zb] = entreRoues(s, 0.05), c = col(e.teinte);
  const z0 = za + (zb - za) * e.zone[0], z1 = za + (zb - za) * e.zone[1];
  const y0 = s.groundClear + 0.17, y1 = s.groundClear + 0.31, bw = 0.06, skew = 0.09;
  const pas = e.nombre > 1 ? (z1 - z0 - bw - skew) / (e.nombre - 1) : 0;
  return deuxCotes((side) => {
    const [xa, xb] = xFlanc(s, side);
    const out: THREE.BufferGeometry[] = [];
    for (let i = 0; i < e.nombre; i++) {
      const z = z0 + skew + i * pas; // pied du chevron ; le haut est penché vers l'arrière (−z)
      out.push(slab([[z, y0], [z + bw, y0], [z + bw - skew, y1], [z - skew, y1]], xa, xb, c));
    }
    return out;
  });
}

/**
 * Géométrie (une seule, fusionnée) des décors d'une livrée pour la couleur principale `principale` (#rrggbb) ;
 * `null` si la livrée n'a aucun décor. Aucune couleur sentinelle : tout est déjà résolu.
 * Les décors sont de fines dalles posées sur la caisse (`EPAIS` au-dessus, le reste enfoncé), sans contour propre.
 */
export function buildSkinGeometry(shape: CarShape, skin: SkinDef, principale: string): THREE.BufferGeometry | null {
  const cache = new Map<Teinte, THREE.Color>();
  const col: Couleur = (t) => {
    let c = cache.get(t);
    if (!c) cache.set(t, (c = new THREE.Color(resoudreTeinte(t, principale))));
    return c;
  };
  const parts: THREE.BufferGeometry[] = [];
  for (const e of skin.elements) {
    switch (e.type) {
      case 'bandes': parts.push(...bandes(shape, e, col)); break;
      case 'toit': parts.push(...toit(shape, e, col)); break;
      case 'capot': parts.push(...capot(shape, e, col)); break;
      case 'basDeCaisse': parts.push(...basDeCaisse(shape, e, col)); break;
      case 'laterale': parts.push(...laterale(shape, e, col)); break;
      case 'numero': parts.push(...numero(shape, e, col)); break;
      case 'chevrons': parts.push(...chevrons(shape, e, col)); break;
    }
  }
  if (parts.length === 0) return null;
  const g = mergeGeometries(parts);
  parts.forEach((p) => p.dispose());
  if (!g) return null;
  g.computeBoundingSphere();
  return g;
}
