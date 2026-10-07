import * as THREE from 'three';
import type { Ambiance } from '../core/level/types';
import { mulberry32 } from '../core/math/rng';
import { barre, blob, boiteRot, cone, coloredBox, colorize, lumineux, merge, tube, type Part } from './formes';
import { decorJaponVille } from './modelesJaponVille';

/**
 * Modèles du thème « japon » : cerisiers en fleurs, torii, lanternes de pierre, pagodes, bambous, petits sanctuaires.
 * Aplats colorés comme le reste ; les fenêtres des lanternes « brillent » (surtout au coucher).
 */

const ROSES = [0xf7b6cc, 0xf4a3bd, 0xfad0dc, 0xee8fb0, 0xffd9e4];
const ECORCE = 0x5a3d33, ROUGE = 0xd6382b, NOIR = 0x22201f, PIERRE = 0xa9a8a4, PIERRE_SOMBRE = 0x8c8b87, TUILE = 0x364354;

/** Cerisier : 0 = large et arrondi, 1 = pleureur (franges pendantes), 2 = jeune arbre. */
export function cerisierGeometry(variant: number): Part {
  const rng = mulberry32(300 + variant);
  const parts: Part[] = [];
  // touffes : icosaèdres (20 faces) aplatis, le plus gros seul en 80 faces ; le décor compte des milliers de cerisiers
  const touffe = (r: number, x: number, y: number, z: number, sy = 0.85, detail = 0): void => {
    parts.push(blob(r, 1, sy, 1, x, y, z, ROSES[Math.floor(rng() * ROSES.length)], detail));
  };
  if (variant === 0) {
    parts.push(barre([0, -0.3, 0], [0.15, 1.9, 0.05], 0.26, ECORCE, 5));
    for (const [x, y, z] of [[-1.3, 3.5, 0.4], [1.4, 3.7, -0.3], [0.2, 4.4, 1.0]] as [number, number, number][]) {
      parts.push(barre([0.15, 1.9, 0.05], [x, y, z], 0.14, ECORCE, 4));
      touffe(1.6 + rng() * 0.5, x, y + 0.6, z);
    }
    touffe(2.3, 0, 4.7, 0.1, 0.85, 1);
    touffe(1.6, -1.9, 3.4, -0.8); touffe(1.5, 1.9, 3.3, 0.9);
  } else if (variant === 1) {
    parts.push(barre([0, -0.3, 0], [-0.3, 2.2, 0], 0.27, ECORCE, 6), barre([-0.3, 2.2, 0], [0.6, 3.6, 0.2], 0.15, ECORCE, 5), barre([-0.3, 2.2, 0], [-1.3, 3.3, -0.3], 0.13, ECORCE, 5));
    touffe(2.4, 0.3, 4.1, 0.1, 0.55, 1); touffe(1.6, -1.5, 3.6, -0.4, 0.55);
    // franges pendantes
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2, r = 1.9 + rng() * 0.4;
      parts.push(blob(0.5, 0.7, 1.7, 0.7, 0.3 + Math.cos(a) * r, 2.7, 0.1 + Math.sin(a) * r, ROSES[i % ROSES.length], 0));
    }
  } else {
    parts.push(barre([0, -0.3, 0], [0.1, 2.4, 0], 0.13, ECORCE, 5));
    touffe(1.3, 0.1, 3.3, 0); touffe(0.9, -0.8, 2.9, 0.3); touffe(0.9, 0.9, 3.0, -0.3); touffe(0.8, 0.1, 4.0, 0.2);
  }
  return merge(parts);
}

/** Torii : 0 = rouge laqué, 1 = bois brut. Poteaux à x = ±2,6 (collisions), passage le long de z. */
export function toriiGeometry(variant: number): Part {
  const col = variant === 0 ? ROUGE : 0x8a6a4a, haut = variant === 0 ? NOIR : 0x4a3a2a;
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push(tube(0.3, 0.26, 4.6, s * 2.6, -0.3, 0, col, 8), tube(0.36, 0.36, 0.5, s * 2.6, -0.3, 0, haut, 8));
  }
  parts.push(coloredBox(6.0, 0.3, 0.32, 0, 3.55, 0, col)); // nuki
  parts.push(coloredBox(0.14, 0.7, 0.24, 0, 4.0, 0, col)); // gakuzuka
  parts.push(coloredBox(0.7, 0.8, 0.05, 0, 4.0, 0.14, haut));
  parts.push(coloredBox(6.6, 0.3, 0.48, 0, 4.45, 0, col)); // shimaki
  // kasagi : poutre noire aux extrémités relevées
  parts.push(coloredBox(6.4, 0.22, 0.7, 0, 4.78, 0, haut));
  for (const s of [-1, 1]) parts.push(boiteRot(1.3, 0.22, 0.7, 0, 0, s * 0.3, s * 3.65, 4.92, 0, haut));
  return merge(parts);
}

/** Lanterne de pierre (tōrō) : socle, fût, chambre à quatre fenêtres lumineuses, toit à quatre pans, bouton. 1,7 m. */
export function toroGeometry(ambiance: Ambiance): Part {
  const gain = ambiance !== 'jour' ? 2.6 : 1.5;
  const fen = (x: number, z: number, w: number, d: number): Part => lumineux(new THREE.BoxGeometry(w, 0.24, d).translate(x, 1.17, z), 0xffd27a, gain);
  return merge([
    coloredBox(0.8, 0.16, 0.8, 0, 0, 0, PIERRE_SOMBRE), tube(0.14, 0.12, 0.7, 0, 0.1, 0, PIERRE, 6),
    colorize(new THREE.CylinderGeometry(0.42, 0.3, 0.14, 4).rotateY(Math.PI / 4).translate(0, 0.86, 0), PIERRE),
    coloredBox(0.42, 0.42, 0.42, 0, 1.14, 0, PIERRE_SOMBRE),
    fen(0.22, 0, 0.03, 0.22), fen(-0.22, 0, 0.03, 0.22), fen(0, 0.22, 0.22, 0.03), fen(0, -0.22, 0.22, 0.03),
    colorize(new THREE.ConeGeometry(0.56, 0.36, 4).rotateY(Math.PI / 4).translate(0, 1.53, 0), PIERRE),
    blob(0.09, 1, 1, 1, 0, 1.78, 0, PIERRE_SOMBRE, 0),
  ]);
}

/** Pagode : `etages` étages de murs rouges et de toits à quatre pans relevés, sur une plate-forme de pierre ; flèche dorée. */
export function pagodeGeometry(variant: number): Part {
  const n = variant === 0 ? 5 : 3, base = variant === 0 ? 6.6 : 5.0, h = variant === 0 ? 3.2 : 3.0;
  const parts: Part[] = [coloredBox(base + 2.4, 1.1, base + 2.4, 0, -0.3, 0, 0x9a9890), coloredBox(base + 1.2, 0.3, base + 1.2, 0, 0.9, 0, 0xb5b2a8)];
  let y = 1.05;
  for (let i = 0; i < n; i++) {
    const s = base - i * (variant === 0 ? 0.95 : 0.85);
    parts.push(coloredBox(s, h * 0.72, s, 0, y + h * 0.36, 0, 0xc94a38));
    parts.push(coloredBox(s + 0.08, 0.14, s + 0.08, 0, y + h * 0.72 - 0.07, 0, 0xf0e6cc));
    // fenêtres sombres sur les quatre faces
    for (const a of [-0.22, 0.22]) {
      for (const f of [1, -1]) {
        parts.push(coloredBox(s * 0.2, h * 0.3, 0.05, a * s * 1.3, y + h * 0.38, f * (s / 2 + 0.02), 0x3a2a26));
        parts.push(coloredBox(0.05, h * 0.3, s * 0.2, f * (s / 2 + 0.02), y + h * 0.38, a * s * 1.3, 0x3a2a26));
      }
    }
    parts.push(colorize(new THREE.ConeGeometry((s + 2.3) * 0.72, 1.25, 4).rotateY(Math.PI / 4).translate(0, y + h * 0.72 + 0.62, 0), TUILE));
    parts.push(coloredBox(s + 2.6, 0.14, s + 2.6, 0, y + h * 0.72 + 0.05, 0, 0x28323f));
    y += h;
  }
  parts.push(tube(0.09, 0.06, 3.4, 0, y + 0.4, 0, 0xd8b84a, 6));
  for (let k = 0; k < 4; k++) parts.push(tube(0.3 - k * 0.04, 0.3 - k * 0.04, 0.1, 0, y + 0.9 + k * 0.5, 0, 0xd8b84a, 8));
  return merge(parts);
}

/** Touffe de bambous : 0 = dense (9 cannes), 1 = claire (6 cannes). */
export function bambouGeometry(variant: number): Part {
  const rng = mulberry32(700 + variant);
  const parts: Part[] = [];
  const n = variant === 0 ? 5 : 4;
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, r = 0.1 + rng() * 0.45;
    const x0 = Math.cos(a) * r, z0 = Math.sin(a) * r;
    const H = 5 + rng() * 3.2, lx = Math.cos(a) * (0.3 + rng() * 0.5), lz = Math.sin(a) * (0.3 + rng() * 0.5);
    let prev: [number, number, number] = [x0, -0.3, z0];
    for (let k = 1; k <= 2; k++) {
      const t = k / 2;
      const p: [number, number, number] = [x0 + lx * t * t, -0.3 + (H + 0.3) * t, z0 + lz * t * t];
      parts.push(barre(prev, p, 0.075, (k + i) % 2 ? 0x8cc060 : 0x74ac4c, 5));
      prev = p;
    }
    // panaches de feuilles : boules aplaties au sommet et à mi-hauteur
    parts.push(blob(0.75, 1, 0.45, 1, prev[0], prev[1] - 0.4, prev[2], i % 2 ? 0x8ccc5c : 0x6fb84e, 0));
  }
  return merge(parts);
}

/** Petit sanctuaire (hokora) : socle de pierre, cabane de bois, porte rouge et toit à quatre pans ; la façade est côté −z (vers la route). */
export function sanctuaireGeometry(): Part {
  return merge([
    coloredBox(2.4, 0.4, 2.2, 0, -0.1, 0, 0x9a9890), coloredBox(0.9, 0.16, 0.5, 0, 0.0, -1.35, 0xb5b2a8),
    coloredBox(1.5, 1.2, 1.3, 0, 0.7, 0.1, 0x8a5a3a), coloredBox(0.6, 0.9, 0.06, 0, 0.75, -0.58, ROUGE),
    coloredBox(0.14, 1.25, 0.14, -0.75, 0.72, -0.58, ROUGE), coloredBox(0.14, 1.25, 0.14, 0.75, 0.72, -0.58, ROUGE),
    colorize(new THREE.ConeGeometry(1.5, 0.95, 4).rotateY(Math.PI / 4).translate(0, 1.78, 0.1), TUILE),
    coloredBox(1.9, 0.12, 1.9, 0, 1.35, 0.1, 0x28323f),
    // tressage de paille blanc (shimenawa)
    coloredBox(1.4, 0.07, 0.07, 0, 1.22, -0.68, 0xf2efe4), coloredBox(0.05, 0.3, 0.05, -0.3, 1.05, -0.68, 0xf2efe4), coloredBox(0.05, 0.3, 0.05, 0.25, 1.05, -0.68, 0xf2efe4),
  ]);
}

/** Buisson japonais : 0 = azalée rose, 1 = buisson vert mouchetée de fleurs. */
export function azaleeGeometry(variant: number): Part {
  const parts: Part[] = [blob(0.6, 1, 0.75, 1, 0, 0.3, 0, 0x4a9a4a, 0), blob(0.45, 1, 0.75, 1, 0.5, 0.25, 0.2, 0x58a856, 0)];
  if (variant === 0) parts.push(blob(0.6, 1, 0.6, 1, 0.05, 0.55, 0, 0xe86d9a, 0), blob(0.42, 1, 0.6, 1, 0.5, 0.45, 0.25, 0xf28cb2, 0));
  else for (const [x, y, z] of [[0.1, 0.72, 0.2], [-0.3, 0.6, -0.1], [0.45, 0.55, 0.05]]) parts.push(blob(0.16, 1, 1, 1, x, y, z, 0xf7a8c4, 0));
  return merge(parts);
}

/** Borne : stèle de pierre à chapeau rouge. */
export function steleGeometry(): Part {
  return merge([coloredBox(0.3, 0.9, 0.3, 0, 0.35, 0, PIERRE), coloredBox(0.36, 0.12, 0.36, 0, 0.86, 0, ROUGE), coloredBox(0.06, 0.4, 0.04, 0, 0.45, 0.17, 0x4a4a48)]);
}

/** Clôture de bois : poteaux rouges et deux lisses claires, 1 m le long de z. */
export function barriereJaponGeometry(): Part {
  return merge([
    coloredBox(0.14, 1.0, 0.14, 0, 0.35, 0, ROUGE), coloredBox(0.14, 0.16, 0.16, 0, 0.88, 0, NOIR),
    coloredBox(0.07, 0.12, 1.0, 0, 0.72, 0, 0xd9b98a), coloredBox(0.07, 0.12, 1.0, 0, 0.42, 0, 0xd9b98a),
  ]);
}

export function decorJapon(ambiance: Ambiance): Record<string, Part> {
  const d: Record<string, Part> = {};
  for (let i = 0; i < 3; i++) d[`cerisier${i}`] = cerisierGeometry(i);
  for (let i = 0; i < 2; i++) { d[`torii${i}`] = toriiGeometry(i); d[`pagode${i}`] = pagodeGeometry(i); d[`bambou${i}`] = bambouGeometry(i); d[`buisson${i}`] = azaleeGeometry(i); }
  d.toro0 = toroGeometry(ambiance);
  d.sanctuaire0 = sanctuaireGeometry();
  d.borne0 = steleGeometry();
  d.barriere = barriereJaponGeometry();
  return { ...d, ...decorJaponVille(ambiance) };
}
