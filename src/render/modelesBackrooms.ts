import * as THREE from 'three';
import type { Ambiance } from '../core/level/types';
import { barre, boiteRot, coloredBox, colorize, lumineux, merge, tube, type Part } from './formes';
import { outlineGeometry } from './materials';

/**
 * Modèles du thème « backrooms » : cloisons en papier peint jaune rayé, piliers, lampadaires à néon, dalles lumineuses
 * suspendues, portes isolées, cartons. Le contour n'est tracé que sur le corps des murs (pas sur les rayures).
 */

/** Rayure : un simple quad (2 triangles) plaqué sur une face, tourné vers ±x (`axe` 'x') ou ±z ('z'), `sens` = ±1. */
function rayure(l: number, h: number, axe: 'x' | 'z', sens: number, x: number, y: number, z: number, color: number): Part {
  const g = new THREE.PlaneGeometry(l, h);
  if (axe === 'x') g.rotateY(sens * Math.PI / 2); else if (sens < 0) g.rotateY(Math.PI);
  return colorize(g.translate(x, y, z), color);
}

const PAPIER = 0xd8c35a, RAYURE = 0xc4ad40, PLINTHE = 0x7d6b2c, MOULURE = 0xb59e3c, SOMBRE = 0x4a3a20, GRIS = 0x8a8a84;

/** Mur ou cloison : `longueur` m le long de z, `hauteur` m (enterré de 0,5 m), 0,35 m d'épaisseur ; rayures verticales sur les deux faces. */
function panneau(longueur: number, hauteur: number, porte: boolean): Part {
  const e = 0.35, h0 = -0.5;
  const corps: Part[] = [
    coloredBox(e, hauteur - h0, longueur, 0, (hauteur + h0) / 2, 0, PAPIER),
    coloredBox(e + 0.08, 0.26, longueur + 0.04, 0, 0.13, 0, PLINTHE),
    coloredBox(e + 0.1, 0.12, longueur + 0.04, 0, hauteur - 0.06, 0, MOULURE),
  ];
  const details: Part[] = [];
  const n = Math.floor(longueur / 0.5);
  for (let i = 0; i < n; i++) {
    const z = -longueur / 2 + (i + 0.5) * (longueur / n);
    for (const s of [-1, 1]) details.push(rayure(0.2, hauteur - 0.6, 'x', s, s * (e / 2 + 0.005), 0.3 + (hauteur - 0.6) / 2, z, RAYURE));
  }
  if (porte) {
    for (const s of [-1, 1]) {
      details.push(coloredBox(0.05, 2.25, 1.2, s * (e / 2 + 0.02), 1.13, 1.2, PLINTHE));
      details.push(coloredBox(0.06, 2.1, 1.0, s * (e / 2 + 0.03), 1.05, 1.2, SOMBRE));
      details.push(coloredBox(0.08, 0.08, 0.08, s * (e / 2 + 0.06), 1.05, 1.5, 0xd8c070));
    }
  }
  const g = merge([...corps, ...details]);
  g.userData.contour = outlineGeometry(merge(corps));
  return g;
}

/** Pilier carré : 1 m de côté, plinthe et moulure, rayures sur les quatre faces. */
function pilier(): Part {
  const H = 5.4;
  const corps: Part[] = [
    coloredBox(1, H + 0.5, 1, 0, (H - 0.5) / 2, 0, PAPIER),
    coloredBox(1.1, 0.26, 1.1, 0, 0.13, 0, PLINTHE),
    coloredBox(1.1, 0.14, 1.1, 0, H - 0.07, 0, MOULURE),
  ];
  const d: Part[] = [];
  for (const o of [-0.25, 0.25]) for (const s of [-1, 1]) {
    d.push(rayure(0.22, H - 0.6, 'z', s, o, 0.3 + (H - 0.6) / 2, s * 0.505, RAYURE));
    d.push(rayure(0.22, H - 0.6, 'x', s, s * 0.505, 0.3 + (H - 0.6) / 2, o, RAYURE));
  }
  const g = merge([...corps, ...d]);
  g.userData.contour = outlineGeometry(merge(corps));
  return g;
}

const NEON = (ambiance: Ambiance): { couleur: number; gain: number } => (ambiance === 'coucher' ? { couleur: 0xffb25a, gain: 2.1 } : { couleur: 0xfff6c8, gain: 2.5 });

/** Lampadaire à néon : mât gris de 6,4 m, bras vers la route (−x), tube lumineux. */
function lampeBureau(ambiance: Ambiance): Part {
  const n = NEON(ambiance);
  return merge([
    coloredBox(0.5, 0.2, 0.5, 0, 0.0, 0, GRIS), tube(0.08, 0.06, 6.4, 0, 0, 0, GRIS, 6),
    coloredBox(1.9, 0.09, 0.09, -0.9, 6.35, 0, GRIS),
    coloredBox(1.2, 0.12, 0.42, -1.4, 6.2, 0, 0x6a6a64),
    lumineux(new THREE.BoxGeometry(1.1, 0.08, 0.32).translate(-1.4, 6.12, 0), n.couleur, n.gain),
  ]);
}

/** Dalle lumineuse flottante : 0 = panneau 2,4 × 1,2 m, 1 = deux tubes fluorescents sous un boîtier. Haut de la pièce à ~7 m. */
function dalle(variant: number, ambiance: Ambiance): Part {
  const n = NEON(ambiance);
  const parts: Part[] = [];
  if (variant === 0) {
    parts.push(coloredBox(2.6, 0.1, 1.4, 0, 6.85, 0, 0x9a9a90), lumineux(new THREE.BoxGeometry(2.4, 0.06, 1.2).translate(0, 6.78, 0), n.couleur, n.gain));
  } else {
    parts.push(coloredBox(3.2, 0.08, 1.0, 0, 7.3, 0, 0x9a9a90));
    for (const z of [-0.25, 0.25]) parts.push(lumineux(new THREE.BoxGeometry(3.0, 0.1, 0.14).translate(0, 7.22, z), n.couleur, n.gain));
  }
  for (const [x, z] of variant === 0 ? [[-1.1, -0.5], [1.1, 0.5]] : [[-1.4, 0], [1.4, 0]]) parts.push(barre([x, variant === 0 ? 6.9 : 7.35, z], [x, 9, z], 0.03, 0x6a6a64, 4));
  return merge(parts);
}

/** Porte isolée au milieu de nulle part : chambranle et vantail entrouvert. */
function porte(): Part {
  return merge([
    coloredBox(0.12, 2.3, 0.22, -0.55, 1.0, 0, PLINTHE), coloredBox(0.12, 2.3, 0.22, 0.55, 1.0, 0, PLINTHE), coloredBox(1.22, 0.14, 0.22, 0, 2.15, 0, PLINTHE),
    boiteRot(0.95, 2.05, 0.06, 0, -0.75, 0, -0.3, 1.05, 0.3, 0x7a5a34),
    boiteRot(0.08, 0.08, 0.1, 0, -0.75, 0, -0.68, 1.0, 0.48, 0xd8c070),
  ]);
}

/** Tas de cartons. */
function carton(): Part {
  const C = 0xb58a52, B = 0xd8c08a;
  return merge([
    boiteRot(0.9, 0.6, 0.7, 0, 0.1, 0, 0, 0.0, 0, C), coloredBox(0.92, 0.04, 0.12, 0, 0.3, 0, B),
    boiteRot(0.7, 0.5, 0.6, 0, -0.35, 0, 0.1, 0.55, 0.05, 0xc29a60), boiteRot(0.6, 0.45, 0.5, 0, 0.5, 0, -0.85, -0.05, 0.4, C),
  ]);
}

/** Panneau « sol mouillé » : chevalet jaune à deux plans. */
function chevronJaune(): Part {
  const J = 0xf2d22a;
  return merge([
    boiteRot(0.5, 0.75, 0.04, 0.25, 0, 0, 0, 0.36, 0.12, J), boiteRot(0.5, 0.75, 0.04, -0.25, 0, 0, 0, 0.36, -0.12, J),
    coloredBox(0.3, 0.16, 0.05, 0, 0.45, 0.21, 0x2b2b30), coloredBox(0.36, 0.05, 0.05, 0, 0.12, 0.29, SOMBRE),
    coloredBox(0.1, 0.06, 0.3, 0, 0.74, 0, 0xc9b030),
  ]);
}

/** Cloison basse en remplacement de la glissière : 0,9 m de haut, 1 m le long de z. */
function barriereBureau(): Part {
  return merge([coloredBox(0.14, 0.95, 1, 0, 0.3, 0, PAPIER), coloredBox(0.2, 0.14, 1, 0, 0.07, 0, PLINTHE), coloredBox(0.2, 0.06, 1, 0, 0.78, 0, MOULURE)]);
}

export function decorBackrooms(ambiance: Ambiance): Record<string, Part> {
  return {
    mur0: panneau(8, 5, false), mur1: panneau(8, 5, true), mur2: panneau(3.2, 2.4, false),
    pilier0: pilier(),
    lampeBureau0: lampeBureau(ambiance),
    dalleLumiere0: dalle(0, ambiance), dalleLumiere1: dalle(1, ambiance),
    porteBureau0: porte(), carton0: carton(),
    chevron0: chevronJaune(), barriere: barriereBureau(),
  };
}
