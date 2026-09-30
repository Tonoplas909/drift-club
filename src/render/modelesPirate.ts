import * as THREE from 'three';
import { mulberry32 } from '../core/math/rng';
import { barre, blob, boiteRot, coloredBox, colorize, eclat, lame, lumineux, merge, Tampon, tube, type Part } from './formes';

/**
 * Modèles du thème « pirate » (Côte des Pirates) : palmiers, pontons, tonneaux, caisses, coffres, canons, ancres, drapeaux
 * à tête de mort, épaves. Formes simples en aplats, comme le reste ; base à y = 0, pieds enterrés de ~0,3 m.
 */

const BOIS = 0x8a5a2b, BOIS_CLAIR = 0xb58a52, BOIS_SOMBRE = 0x5a3c22, FER = 0x343842, OR = 0xe8b830;

/** Palmier : 0 = droit, 1 = penché (tronc courbe), 2 = petit double tronc. */
export function palmierGeometry(variant: number): Part {
  const parts: Part[] = [];
  const tronc = (H: number, pench: number, r0: number, dx = 0, dz = 0): [number, number, number] => {
    const N = 4;
    let prev: [number, number, number] = [dx, -0.3, dz];
    for (let i = 1; i <= N; i++) {
      const t = i / N;
      const p: [number, number, number] = [dx + pench * t * t * H * 0.4, -0.3 + t * (H + 0.3), dz];
      const r = r0 * (1 - 0.45 * t);
      parts.push(barre(prev, p, r, i % 2 ? 0x8a6a45 : 0x79593a, 5));
      prev = p;
    }
    return prev;
  };
  const feuilles = (top: [number, number, number], n: number, long: number, rot: number): void => {
    for (let k = 0; k < n; k++) {
      const a = rot + (k / n) * Math.PI * 2;
      const dx = Math.cos(a), dz = Math.sin(a);
      let p: [number, number, number] = [top[0], top[1], top[2]];
      // trois tronçons de plus en plus courbés vers le bas
      const pas: [number, number][] = [[0.75, 0.3], [0.6, -0.5]];
      pas.forEach(([h, v], i) => {
        const q: [number, number, number] = [p[0] + dx * long * h, p[1] + v * long * 0.6, p[2] + dz * long * h];
        parts.push(lame(p, q, 0.95 - i * 0.3, 0.07, (k + i) % 2 ? 0x3c9c4a : 0x2f8a45));
        p = q;
      });
    }
  };
  if (variant === 0) {
    const top = tronc(7.2, 0.25, 0.26);
    feuilles(top, 8, 3.4, 0.3);
    for (const [x, z] of [[0.18, 0.1], [-0.15, 0.16]]) parts.push(blob(0.17, 1, 1, 1, top[0] + x, top[1] - 0.3, top[2] + z, 0x6b4a2a, 0));
  } else if (variant === 1) {
    const top = tronc(6.2, 0.95, 0.27);
    feuilles(top, 7, 3.2, 1.1);
    parts.push(blob(0.16, 1, 1, 1, top[0] + 0.1, top[1] - 0.3, top[2] + 0.15, 0x6b4a2a, 0));
  } else {
    const a = tronc(5.0, 0.3, 0.22, 0, 0), b = tronc(4.0, -0.6, 0.18, 0.5, 0.3);
    feuilles(a, 6, 2.9, 0.1);
    feuilles(b, 6, 2.5, 0.7);
  }
  return merge(parts);
}

/** Buisson tropical : 0 = agave (lames vertes), 1 = hibiscus (feuillage et fleurs rouges). */
export function buissonTropicalGeometry(variant: number): Part {
  const parts: Part[] = [];
  if (variant === 0) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, tilt = 0.55 + (i % 3) * 0.2, h = 1.0 + (i % 2) * 0.35;
      parts.push(colorize(new THREE.ConeGeometry(0.15, h, 4).translate(0, h / 2 - 0.1, 0).rotateZ(tilt).rotateY(a), i % 2 ? 0x4bb35a : 0x37994a));
    }
  } else {
    parts.push(blob(0.6, 1, 0.8, 1, 0, 0.45, 0, 0x3d9a4c), blob(0.45, 1, 0.8, 1, 0.45, 0.35, 0.2, 0x4bb35a), blob(0.4, 1, 0.8, 1, -0.4, 0.3, -0.25, 0x349044));
    for (const [x, y, z] of [[0.2, 0.85, 0.45], [-0.35, 0.7, 0.3], [0.5, 0.65, -0.1], [-0.1, 0.95, -0.3]]) parts.push(blob(0.13, 1, 1, 1, x, y, z, 0xe8485a, 0));
  }
  return merge(parts);
}

/** Ponton en planches : 2,4 m de large, `longueur` m le long de +z, centré ; dessus du plancher à y = 0, pilotis jusqu'à −5 m. */
export function pontonGeometry(variant: number): Part {
  const L = variant === 0 ? 12 : 8;
  const parts: Part[] = [];
  const n = Math.round(L / 0.6);
  for (let i = 0; i < n; i++) parts.push(coloredBox(2.4, 0.12, 0.55, 0, -0.06, -L / 2 + 0.3 + i * (L / n), i % 2 ? 0x9b7649 : 0x8a6740));
  for (const s of [-1, 1]) parts.push(coloredBox(0.2, 0.22, L, s * 0.9, -0.23, 0, BOIS_SOMBRE));
  const np = Math.round(L / 3) + 1;
  for (let i = 0; i < np; i++) {
    const z = -L / 2 + 0.2 + (i * (L - 0.4)) / (np - 1);
    for (const s of [-1, 1]) {
      parts.push(tube(0.12, 0.11, 5.5, s * 1.25, -5, z, 0x4a3520, 6));
      if (i % 2 === 0) parts.push(tube(0.15, 0.13, 0.12, s * 1.25, 0.5, z, 0xd8c08a, 6)); // amarrage
    }
  }
  if (variant === 1) {
    // lanterne au bout
    parts.push(tube(0.06, 0.06, 1.6, 0.9, 0, L / 2 - 0.4, BOIS_SOMBRE, 5), lumineux(new THREE.BoxGeometry(0.3, 0.34, 0.3).translate(0.9, 1.75, L / 2 - 0.4), 0xffd27a, 1.8));
  }
  return merge(parts);
}

/** Tonneau : bois cerclé de fer, 0,95 m. */
export function tonneauGeometry(): Part {
  return merge([
    tube(0.36, 0.43, 0.3, 0, -0.05, 0, BOIS, 9), tube(0.43, 0.43, 0.4, 0, 0.25, 0, BOIS_CLAIR, 9), tube(0.43, 0.36, 0.3, 0, 0.65, 0, BOIS, 9),
    tube(0.385, 0.385, 0.06, 0, 0.14, 0, FER, 9), tube(0.385, 0.385, 0.06, 0, 0.76, 0, FER, 9), tube(0.44, 0.44, 0.06, 0, 0.44, 0, FER, 9),
    tube(0.32, 0.32, 0.03, 0, 0.94, 0, 0x6d4526, 9),
  ]);
}

/** Caisse : 0 = simple, 1 = deux caisses empilées de travers. */
export function caisseGeometry(variant: number): Part {
  const une = (t: number, x: number, y: number, z: number, rot: number, clair: number): Part[] => {
    const h = t / 2, e = 0.09;
    const p: Part[] = [boiteRot(t, t, t, 0, 0, 0, 0, 0, 0, clair)];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.push(boiteRot(e, t + 0.02, e, 0, 0, 0, sx * (h - e / 2 + 0.005), 0, sz * (h - e / 2 + 0.005), BOIS_SOMBRE));
    for (const sy of [-1, 1]) {
      p.push(boiteRot(t + 0.02, e, e, 0, 0, 0, 0, sy * (h - e / 2), h, BOIS_SOMBRE), boiteRot(t + 0.02, e, e, 0, 0, 0, 0, sy * (h - e / 2), -h, BOIS_SOMBRE));
      p.push(boiteRot(e, e, t + 0.02, 0, 0, 0, h, sy * (h - e / 2), 0, BOIS_SOMBRE), boiteRot(e, e, t + 0.02, 0, 0, 0, -h, sy * (h - e / 2), 0, BOIS_SOMBRE));
    }
    p.push(boiteRot(0.08, t * 1.35, 0.05, 0, 0, 0.78, 0, 0, h + 0.01, BOIS_SOMBRE));
    return p.map((g) => g.rotateY(rot).translate(x, y + h, z));
  };
  if (variant === 0) return merge(une(1, 0, -0.05, 0, 0, BOIS_CLAIR));
  return merge([...une(1, 0, -0.05, 0, 0.1, BOIS_CLAIR), ...une(0.78, 0.12, 0.95, 0.05, 0.5, 0xc29a60)]);
}

/** Coffre au trésor : coffre bois à couvercle bombé cerclé d'or, pièces qui brillent. */
export function coffreGeometry(): Part {
  const lid = colorize(new THREE.CylinderGeometry(0.3, 0.3, 0.92, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.5, 0), 0x7d4a26);
  return merge([
    coloredBox(0.96, 0.46, 0.62, 0, 0.23, 0, BOIS), lid,
    coloredBox(0.1, 0.5, 0.66, 0.3, 0.25, 0, OR), coloredBox(0.1, 0.5, 0.66, -0.3, 0.25, 0, OR),
    colorize(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0.3, 0.5, 0), OR),
    colorize(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(-0.3, 0.5, 0), OR),
    coloredBox(0.14, 0.16, 0.05, 0, 0.42, 0.33, OR),
    eclat(blob(0.22, 1.2, 0.5, 0.9, 0.75, 0.12, 0.25, 0xffd24a, 1), 1.5), eclat(blob(0.14, 1, 0.5, 1, 0.92, 0.08, 0.05, 0xffe27a, 0), 1.5),
  ]);
}

/** Canon sur affût de bois, boulets en tas ; la bouche vers +z. */
export function canonGeometry(): Part {
  const fut = colorize(new THREE.CylinderGeometry(0.2, 0.3, 1.7, 9).rotateX(Math.PI / 2 - 0.12).translate(0, 0.78, 0.25), FER);
  const bouche = colorize(new THREE.CylinderGeometry(0.27, 0.22, 0.14, 9).rotateX(Math.PI / 2 - 0.12).translate(0, 0.86, 1.09), 0x24272f);
  const roue = (x: number): Part => colorize(new THREE.CylinderGeometry(0.36, 0.36, 0.14, 10).rotateZ(Math.PI / 2).translate(x, 0.34, 0.1), BOIS_SOMBRE);
  return merge([
    fut, bouche, roue(0.46), roue(-0.46),
    coloredBox(0.14, 0.34, 1.3, 0.3, 0.52, 0.15, BOIS), coloredBox(0.14, 0.34, 1.3, -0.3, 0.52, 0.15, BOIS),
    coloredBox(0.72, 0.1, 0.12, 0, 0.3, 0.1, BOIS_SOMBRE),
    blob(0.12, 1, 1, 1, 0.9, 0.12, -0.3, 0x1e2026, 0), blob(0.12, 1, 1, 1, 1.15, 0.12, -0.2, 0x1e2026, 0), blob(0.12, 1, 1, 1, 1.03, 0.3, -0.27, 0x1e2026, 0),
  ]);
}

/** Ancre dressée, à demi enterrée : jas, organeau, verge, bras courbes. */
export function ancreGeometry(): Part {
  const FE = 0x39404c;
  const parts: Part[] = [
    tube(0.08, 0.08, 1.9, 0, -0.3, 0, FE, 6),
    coloredBox(0.9, 0.12, 0.12, 0, 1.25, 0, BOIS_SOMBRE),
    colorize(new THREE.TorusGeometry(0.16, 0.045, 5, 10).translate(0, 1.72, 0), FE),
    // bras : deux branches inclinées jusqu'aux pattes
    lame([0, 0.15, 0], [0.55, 0.45, 0], 0.12, 0.12, FE), lame([0, 0.15, 0], [-0.55, 0.45, 0], 0.12, 0.12, FE),
    colorize(new THREE.ConeGeometry(0.14, 0.3, 4).rotateZ(-0.9).translate(0.62, 0.5, 0), 0x4b5361),
    colorize(new THREE.ConeGeometry(0.14, 0.3, 4).rotateZ(0.9).translate(-0.62, 0.5, 0), 0x4b5361),
    // tache de rouille
    coloredBox(0.14, 0.3, 0.14, 0, 0.75, 0, 0x7a4a2a),
  ];
  return merge(parts);
}

/** Drapeau pirate : mât de 4,6 m, pavillon noir ondulé avec tête de mort et os croisés (des deux côtés). */
export function drapeauPirateGeometry(): Part {
  const os = 0xf0ead2, noir = 0x1a1a22;
  const parts: Part[] = [tube(0.06, 0.05, 4.8, 0, -0.3, 0, 0x7a5a38, 6), blob(0.1, 1, 1, 1, 0, 4.55, 0, OR, 0)];
  [[0.03, 0], [0.03, 0.08], [0.03, -0.06]].forEach(([, dz], i) => parts.push(coloredBox(0.6, 1.1, 0.04, 0.4 + i * 0.6, 3.75, dz, noir)));
  parts.push(blob(0.2, 1, 1.05, 0.9, 1.0, 3.85, 0.03, os, 1), coloredBox(0.15, 0.1, 0.22, 1.0, 3.6, 0.03, os));
  for (const s of [-0.085, 0.085]) parts.push(coloredBox(0.06, 0.07, 0.4, 1.0 + s, 3.88, 0.03, noir));
  for (const r of [0.6, -0.6]) {
    parts.push(boiteRot(0.95, 0.07, 0.05, 0, 0, r, 1.0, 3.45, 0.03, os));
    for (const e of [-1, 1]) parts.push(blob(0.065, 1, 1, 1.2, 1.0 + e * Math.cos(r) * 0.48, 3.45 + e * Math.sin(r) * 0.48, 0.03, os, 0));
  }
  return merge(parts);
}

/** Coque de navire (ou de barque) ouverte vers le haut, en planches, à l'intérieur plus clair. `ouverte` : planches manquantes à l'arrière. */
function coque(len: number, beam: number, prof: number, ouverte: boolean): Part {
  const NS = 14, NA = 10;
  const t = new Tampon();
  const A = new THREE.Color(0x6a4a2e), B = new THREE.Color(0x58391f), I = new THREE.Color(0x9a7a52), RIM = new THREE.Color(0x3c2814);
  const pt = (i: number, j: number, k: number): number[] => {
    const z = (i / NS - 0.5) * len;
    const e = Math.abs((2 * z) / len);
    const w = (beam / 2) * Math.pow(Math.max(0.02, 1 - Math.pow(e, 2.4)), 0.6) * k;
    const u = (j / NA) * 2 - 1;
    const y = -prof * (1 - u * u) * (1 - 0.55 * Math.pow(e, 3)) + 0.9 * e * e + (k < 1 ? 0.06 : 0);
    return [u * w, y, z];
  };
  const centre = [0, -prof * 0.3, 0];
  for (let i = 0; i < NS; i++) {
    const manque = ouverte && i > NS / 2 - 1;
    for (let j = 0; j < NA; j++) {
      if (manque && j % 4 === 2) continue;
      const a = pt(i, j, 1), b = pt(i + 1, j, 1), c = pt(i + 1, j + 1, 1), d = pt(i, j + 1, 1);
      t.quad(a, b, c, d, j % 2 ? A : B, [(a[0] + c[0]) * 3, -prof * 4, (a[2] + c[2]) / 2]);
      const a2 = pt(i, j, 0.92), b2 = pt(i + 1, j, 0.92), c2 = pt(i + 1, j + 1, 0.92), d2 = pt(i, j + 1, 0.92);
      t.quad(a2, b2, c2, d2, I, [centre[0], prof, (a2[2] + c2[2]) / 2]);
    }
    for (const j of [0, NA]) {
      const a = pt(i, j, 1), b = pt(i + 1, j, 1), c = pt(i + 1, j, 0.92), d = pt(i, j, 0.92);
      t.quad(a, b, c, d, RIM, [a[0] * 2, 5, a[2]]);
    }
  }
  return t.geometrie();
}

/** Épave échouée : 0 = coque à peu près entière, mât brisé, voile en lambeaux ; 1 = squelette (membrures apparentes). Longueur ≈ 10 m. */
export function epaveGeometry(variant: number): Part {
  const rng = mulberry32(90 + variant);
  const parts: Part[] = [];
  const L = variant === 0 ? 10 : 9, beam = 3.2, prof = 1.5;
  parts.push(coque(L, beam, prof, variant === 1));
  // membrures (les côtes du navire) et quille
  const NS = 14;
  for (let i = 1; i < NS; i += variant === 1 ? 1 : 3) {
    const z = (i / NS - 0.5) * L, e = Math.abs((2 * z) / L);
    const w = (beam / 2) * Math.pow(Math.max(0.02, 1 - Math.pow(e, 2.4)), 0.6);
    let prev: [number, number, number] | null = null;
    for (let j = 0; j <= 8; j++) {
      const u = (j / 8) * 2 - 1;
      const p: [number, number, number] = [u * w * 0.94, -prof * (1 - u * u) * (1 - 0.55 * Math.pow(e, 3)) + 0.9 * e * e + 0.04, z];
      if (prev) parts.push(barre(prev, p, 0.07, 0x3a2614, 4));
      prev = p;
    }
  }
  parts.push(coloredBox(0.22, 0.25, L * 0.92, 0, -prof - 0.05, 0, 0x3a2614));
  // mât brisé penché, et son espar
  const pied: [number, number, number] = [0, -0.6, variant === 0 ? 0.8 : -0.4];
  const tete: [number, number, number] = [0.9 + rng() * 0.4, variant === 0 ? 5.2 : 3.4, pied[2] - 0.9];
  parts.push(barre(pied, tete, 0.17, 0x5a3c22, 6));
  parts.push(barre([tete[0] - 1.6, tete[1] - 1.1, tete[2]], [tete[0] + 1.6, tete[1] - 0.6, tete[2]], 0.09, 0x5a3c22, 5));
  if (variant === 0) parts.push(boiteRot(1.6, 1.5, 0.04, 0.1, 0, 0.2, tete[0] + 0.1, tete[1] - 1.5, tete[2], 0xe8dcc0), boiteRot(0.6, 0.9, 0.04, 0.2, 0, -0.4, tete[0] + 1.0, tete[1] - 2.3, tete[2] + 0.05, 0xd8cbac));
  // proue relevée / étrave
  parts.push(boiteRot(0.25, 0.25, 2.2, -0.5, 0, 0, 0, 0.55, L / 2 + 0.6, 0x4a3018));
  const g = merge(parts);
  // gîte et enfoncement : la coque est remontée pour que le bord dépasse du sable
  g.rotateZ(variant === 0 ? 0.16 : -0.12).rotateX(variant === 0 ? 0.05 : -0.04).translate(0, 1.75, 0);
  return g;
}

/** Borne du thème : bitte d'amarrage en bois avec une corde. */
export function bitteGeometry(): Part {
  return merge([
    tube(0.17, 0.15, 0.85, 0, -0.1, 0, BOIS), tube(0.2, 0.2, 0.08, 0, 0.72, 0, BOIS_SOMBRE),
    tube(0.175, 0.175, 0.14, 0, 0.35, 0, 0xd8c08a, 7), tube(0.175, 0.175, 0.08, 0, 0.52, 0, 0xc8ae74, 7),
  ]);
}

/** Panneau à chevrons : planches bois à bandes noires, flèches vers l'extérieur du virage. */
export function chevronPirateGeometry(): Part {
  return merge([
    tube(0.06, 0.06, 1.5, 0, -0.1, 0, BOIS_SOMBRE, 5),
    coloredBox(0.27, 0.6, 0.06, -0.4, 1.45, 0.06, 0x23232b), coloredBox(0.26, 0.6, 0.06, 0, 1.45, 0.06, 0xe8d9b0), coloredBox(0.27, 0.6, 0.06, 0.4, 1.45, 0.06, 0x23232b),
    coloredBox(1.12, 0.07, 0.09, 0, 1.78, 0.04, BOIS), coloredBox(1.12, 0.07, 0.09, 0, 1.12, 0.04, BOIS),
  ]);
}

/** Glissière de remplacement : clôture de bois (poteaux et deux lisses), 1 m le long de +z. */
export function barrierePirateGeometry(): Part {
  return merge([
    coloredBox(0.14, 1.0, 0.14, 0, 0.35, 0, BOIS_SOMBRE),
    coloredBox(0.08, 0.14, 1.0, 0, 0.75, 0, BOIS), coloredBox(0.08, 0.14, 1.0, 0, 0.45, 0, BOIS),
    tube(0.09, 0.09, 0.04, 0, 0.85, 0, 0xd8c08a, 6),
  ]);
}

/** Tous les modèles du thème, par clé `kind + variante`. */
export function decorPirate(): Record<string, Part> {
  const d: Record<string, Part> = {};
  for (let i = 0; i < 3; i++) d[`palmier${i}`] = palmierGeometry(i);
  for (let i = 0; i < 2; i++) { d[`buisson${i}`] = buissonTropicalGeometry(i); d[`ponton${i}`] = pontonGeometry(i); d[`caisse${i}`] = caisseGeometry(i); d[`epave${i}`] = epaveGeometry(i); }
  d.tonneau0 = tonneauGeometry();
  d.coffre0 = coffreGeometry();
  d.canon0 = canonGeometry();
  d.ancre0 = ancreGeometry();
  d.drapeauPirate0 = drapeauPirateGeometry();
  d.borne0 = bitteGeometry();
  d.chevron0 = chevronPirateGeometry();
  d.barriere = barrierePirateGeometry();
  return d;
}
