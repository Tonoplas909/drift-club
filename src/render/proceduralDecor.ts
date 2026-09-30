import * as THREE from 'three';
import { mulberry32 } from '../core/math/rng';
import { colorize, coloredBox, merge } from './procedural';

/**
 * Décor propre aux thèmes, dessiné en formes simples (aplats + contours comme le reste) : cactus, buissons secs,
 * arbres morts, mesas, congères, piquets de déneigement, souches. Base à y = 0 ; les pieds sont enterrés
 * d'environ 0,3 m pour ne jamais flotter sur une pente.
 */

type Part = THREE.BufferGeometry;

/** Cylindre (ou tronc de cône) debout, base en y0. */
const tube = (rBas: number, rHaut: number, h: number, x: number, y0: number, z: number, color: number, seg = 7): Part =>
  colorize(new THREE.CylinderGeometry(rHaut, rBas, h, seg, 1).translate(x, y0 + h / 2, z), color);

/** Demi-sphère (calotte) posée sur y0. */
const dome = (r: number, x: number, y0: number, z: number, color: number, seg = 7): Part =>
  colorize(new THREE.SphereGeometry(r, seg, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y0, z), color);

/** Boule aplatie. */
const blob = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, seg = 7): Part =>
  colorize(new THREE.SphereGeometry(r, seg, 5).scale(sx, sy, sz).translate(x, y, z), color);

const VERT_CACTUS = 0x4f9a4a, VERT_CACTUS_CLAIR = 0x67b25c;

/** Cactus : 0 = saguaro à deux bras, 1 = saguaro à un bras, 2 = cactus boule fleuri. */
export function cactusGeometry(variant: number): Part {
  if (variant === 2) {
    return merge([
      blob(0.5, 1, 0.9, 1, 0, 0.35, 0, VERT_CACTUS_CLAIR, 8),
      colorize(new THREE.ConeGeometry(0.13, 0.22, 5).translate(0, 0.86, 0), 0xf07aa0),
    ]);
  }
  const parts: Part[] = [tube(0.36, 0.32, 4.2, 0, -0.3, 0, VERT_CACTUS), dome(0.32, 0, 3.9, 0, VERT_CACTUS)];
  const bras = (side: number, y: number, haut: number): void => {
    // coude horizontal puis branche verticale
    parts.push(colorize(new THREE.CylinderGeometry(0.2, 0.2, 0.85, 6).rotateZ(Math.PI / 2).translate(side * 0.6, y, 0), VERT_CACTUS));
    parts.push(tube(0.2, 0.2, haut, side * 1.02, y - 0.2, 0, VERT_CACTUS_CLAIR, 6));
    parts.push(dome(0.2, side * 1.02, y - 0.2 + haut, 0, VERT_CACTUS_CLAIR, 6));
  };
  if (variant === 0) { bras(1, 1.6, 1.5); bras(-1, 2.3, 1.1); } else bras(1, 1.9, 1.3);
  parts.push(colorize(new THREE.ConeGeometry(0.1, 0.18, 5).translate(0, 4.35, 0), 0xf07aa0));
  return merge(parts);
}

/** Buisson sec : 0 = touffe de boules, 1 = herbe haute en gerbe. */
export function buissonGeometry(variant: number): Part {
  if (variant === 0) {
    return merge([
      blob(0.5, 1, 0.75, 1, 0, 0.3, 0, 0xb59a55), blob(0.4, 1, 0.75, 1, 0.5, 0.25, 0.2, 0xa38640),
      blob(0.36, 1, 0.75, 1, -0.4, 0.22, -0.3, 0xc2a862), blob(0.3, 1, 0.8, 1, 0.1, 0.45, -0.2, 0xd0b870),
    ]);
  }
  const rng = mulberry32(31);
  const parts: Part[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, tilt = 0.25 + rng() * 0.35, h = 0.9 + rng() * 0.6;
    const g = new THREE.ConeGeometry(0.13, h, 4).translate(0, h / 2 - 0.15, 0).rotateZ(tilt).rotateY(a);
    parts.push(colorize(g, i % 2 ? 0xc9b062 : 0xa89043));
  }
  return merge(parts);
}

/** Arbre mort : 0 = tronc nu à branches, 1 = acacia à couronne plate. */
export function arbreSecGeometry(variant: number): Part {
  const bois = 0x7d6647;
  if (variant === 0) {
    return merge([
      tube(0.3, 0.14, 3.4, 0, -0.3, 0, bois, 6),
      colorize(new THREE.CylinderGeometry(0.06, 0.12, 1.5, 5).translate(0, 0.75, 0).rotateZ(-0.9).translate(0.1, 2.3, 0), bois),
      colorize(new THREE.CylinderGeometry(0.05, 0.1, 1.2, 5).translate(0, 0.6, 0).rotateZ(0.8).translate(-0.05, 1.7, 0), bois),
      colorize(new THREE.CylinderGeometry(0.04, 0.08, 0.9, 5).translate(0, 0.45, 0).rotateX(0.8).translate(0, 2.9, 0), bois),
    ]);
  }
  return merge([
    tube(0.28, 0.16, 3.2, 0, -0.3, 0, 0x6d5a3e, 6),
    colorize(new THREE.CylinderGeometry(0.1, 0.16, 1.2, 5).translate(0, 0.6, 0).rotateZ(0.7).translate(0, 2.4, 0), 0x6d5a3e),
    blob(1.9, 1, 0.24, 1, 0, 3.55, 0, 0x9aa04a, 8), blob(1.2, 1, 0.22, 1, 1.2, 3.1, 0.3, 0x8b9440, 7),
  ]);
}

/** Bande de roche : tronc de cône irrégulier (sommets déplacés de façon déterministe). */
function strate(rBas: number, rHaut: number, h: number, y0: number, color: number, rng: () => number, seg = 7): Part {
  const g = new THREE.CylinderGeometry(rHaut, rBas, h, seg, 1);
  const pos = g.getAttribute('position');
  const facteurs = Array.from({ length: seg + 1 }, () => 0.88 + rng() * 0.24);
  for (let i = 0; i < pos.count; i++) {
    const a = Math.atan2(pos.getZ(i), pos.getX(i));
    const k = facteurs[((Math.round(((a + Math.PI) / (Math.PI * 2)) * seg) % seg) + seg) % seg];
    pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
  }
  return colorize(g.translate(0, y0 + h / 2, 0), color);
}

/** Mesa : 0 = butte élancée, 1 = plateau large avec pic voisin. Rayon au sol ≈ 2,6 m (rayon de collision : 2,4). */
export function mesaGeometry(variant: number): Part {
  const rng = mulberry32(50 + variant);
  const bandes = [0xb5563a, 0xc9754a, 0xa64a33, 0xd18f58];
  if (variant === 0) {
    return merge([
      strate(3.0, 2.5, 2.2, -0.8, 0xa64a33, rng), strate(2.5, 2.2, 2.4, 1.4, bandes[1], rng),
      strate(2.2, 2.3, 2.2, 3.8, bandes[0], rng), strate(2.3, 2.0, 2.0, 6.0, bandes[3], rng),
      strate(2.0, 1.9, 0.5, 8.0, 0xdcae72, rng),
    ]);
  }
  return merge([
    strate(3.4, 3.0, 2.0, -0.8, 0xa64a33, rng, 8), strate(3.0, 2.8, 2.4, 1.2, bandes[1], rng, 8),
    strate(2.8, 2.9, 1.8, 3.6, bandes[2], rng, 8), strate(2.9, 2.8, 0.5, 5.4, 0xdcae72, rng, 8),
    strate(1.1, 0.9, 5.8, -0.6, 0xb5563a, rng, 6).translate(3.3, 0, 0.6),
    strate(0.9, 0.8, 1.0, 5.2, 0xdcae72, rng, 6).translate(3.3, 0, 0.6),
  ]);
}

/** Piquet de déneigement : 2 m, bandes rouge et blanc, réflecteur jaune. */
export function piquetGeometry(): Part {
  const parts: Part[] = [];
  for (let i = 0; i < 6; i++) parts.push(coloredBox(0.1, 0.34, 0.1, 0, 0.2 + i * 0.34, 0, i % 2 ? 0xf4f1e8 : 0xe63b2e));
  parts.push(coloredBox(0.16, 0.14, 0.05, 0, 2.2, 0.06, 0xffd23f));
  return merge(parts);
}

/** Congère au bord de la route : 0 = tas, 1 = long talus. */
export function tasNeigeGeometry(variant: number): Part {
  if (variant === 0) {
    return merge([blob(1, 1.3, 0.55, 1.1, 0, 0.1, 0, 0xf2f6ff, 7), blob(0.7, 1.1, 0.5, 1, 0.9, 0, 0.5, 0xe1ebf7, 6)]);
  }
  return merge([blob(1, 2.1, 0.5, 0.95, 0, 0.05, 0, 0xf2f6ff, 8), blob(0.6, 1.4, 0.45, 1, -1.5, -0.05, 0.4, 0xe1ebf7, 6)]);
}

/** Souche avec un tas de feuilles mortes. */
export function soucheGeometry(): Part {
  return merge([
    tube(0.5, 0.42, 0.7, 0, -0.15, 0, 0x7a5233, 8),
    tube(0.36, 0.36, 0.03, 0, 0.55, 0, 0xd0a56a, 8),
    blob(0.55, 1, 0.35, 1, 0.85, 0.05, 0.2, 0xc9541e, 6),
    blob(0.35, 1, 0.4, 1, 1.2, 0.05, -0.15, 0xe0a030, 5),
  ]);
}
