import * as THREE from 'three';
import { barre, blob, boiteRot, coloredBox, colorize, eclat, lumineux, merge, tube, type Part } from './formes';

/**
 * Modèles du thème « espace » : amas de cristaux lumineux, antennes relais, atterrisseur lunaire générique, paraboles,
 * balises, bidons. Aplats colorés comme le reste ; les cristaux et les feux « brillent » (couleurs > 1).
 */

const BLANC = 0xe8eaf0, GRIS = 0x9aa0ac, SOMBRE = 0x2a2e38, OR = 0xd8a83a;

/** Cristal : prisme hexagonal à pointe, penché de (rx, rz), pied en (x, z). */
function cristal(r: number, h: number, x: number, z: number, rx: number, rz: number, couleur: number): Part {
  const corps = eclat(colorize(new THREE.CylinderGeometry(r * 0.85, r, h * 0.72, 6).translate(0, h * 0.36, 0), couleur), 1.25);
  const pointe = eclat(colorize(new THREE.ConeGeometry(r * 0.85, h * 0.32, 6).translate(0, h * 0.72 + h * 0.16, 0), couleur), 2.1);
  return merge([corps, pointe]).rotateX(rx).rotateZ(rz).translate(x, -0.1, z);
}

/** Amas de cristaux : 0 = cyan, 1 = magenta, 2 = vert et cyan ; posés sur un socle de roche. */
export function cristalGeometry(variant: number): Part {
  const cols = [[0x4ae8ff, 0x7af4ff, 0x2fc4e8], [0xd050ff, 0xf080ff, 0xa83ae8], [0x5affb0, 0x4ae8ff, 0x8affd0]][variant];
  const defs: [number, number, number, number, number, number][] = [
    [0.3, 2.3, 0, 0, 0.08, -0.06], [0.22, 1.6, 0.55, 0.2, 0.3, -0.45], [0.2, 1.4, -0.5, 0.3, -0.25, 0.4],
    [0.17, 1.0, 0.25, -0.5, -0.5, -0.15], [0.16, 0.9, -0.35, -0.4, -0.4, 0.3], [0.13, 0.7, 0.75, -0.25, 0.1, -0.7],
  ];
  const parts: Part[] = [blob(0.6, 1.2, 0.35, 1.1, 0.1, 0.0, 0.0, 0x5a566a, 0), blob(0.35, 1, 0.4, 1, -0.6, -0.05, 0.4, 0x6a667c, 0)];
  defs.forEach(([r, h, x, z, rx, rz], i) => parts.push(cristal(r, h, x, z, rx, rz, cols[i % 3])));
  return merge(parts);
}

/** Antenne relais : 0 = pylône treillis de 12 m à balise rouge, 1 = mât de 7 m à deux paraboles et panneau solaire. */
export function antenneGeometry(variant: number): Part {
  const parts: Part[] = [];
  const ALU = 0xb8bcc8;
  if (variant === 0) {
    const H = 12;
    const pied = (k: number): [number, number, number] => [Math.cos((k * 2 * Math.PI) / 3) * 1.3, -0.3, Math.sin((k * 2 * Math.PI) / 3) * 1.3];
    const haut = (k: number): [number, number, number] => [Math.cos((k * 2 * Math.PI) / 3) * 0.25, H, Math.sin((k * 2 * Math.PI) / 3) * 0.25];
    for (let k = 0; k < 3; k++) parts.push(barre(pied(k), haut(k), 0.07, ALU, 5));
    for (let n = 1; n <= 4; n++) {
      const t = n / 5;
      const p = (k: number): [number, number, number] => [pied(k)[0] + (haut(k)[0] - pied(k)[0]) * t, -0.3 + (H + 0.3) * t, pied(k)[2] + (haut(k)[2] - pied(k)[2]) * t];
      for (let k = 0; k < 3; k++) parts.push(barre(p(k), p((k + 1) % 3), 0.035, 0x8a90a0, 4));
    }
    parts.push(coloredBox(1.0, 0.5, 1.0, 0, -0.1, 0, 0x5a5e6c), tube(0.06, 0.06, 1.0, 0, H, 0, ALU, 5));
    parts.push(eclat(blob(0.22, 1, 1, 1, 0, H + 1.1, 0, 0xff2a2a, 1), 2.4));
    parts.push(colorize(new THREE.SphereGeometry(0.75, 10, 4, 0, Math.PI * 2, 0, 1.0).rotateX(-1.3).translate(0.3, H - 2.2, 0.35), BLANC));
  } else {
    parts.push(tube(0.16, 0.1, 7.3, 0, -0.3, 0, ALU, 6), coloredBox(0.9, 0.3, 0.9, 0, -0.1, 0, 0x5a5e6c));
    for (const [y, rot, s] of [[6.0, 0.5, 1], [3.8, -0.9, 0.75]] as [number, number, number][]) {
      parts.push(colorize(new THREE.SphereGeometry(0.85 * s, 10, 4, 0, Math.PI * 2, 0, 0.95).rotateX(-1.2).rotateY(rot).translate(0, y, 0), BLANC));
    }
    parts.push(boiteRot(1.9, 0.06, 1.1, 0.5, 0, 0, 0, 2.2, 0.6, 0x2f4fa8), coloredBox(0.06, 0.6, 0.06, 0, 2.0, 0.3, ALU));
    parts.push(eclat(blob(0.14, 1, 1, 1, 0, 7.45, 0, 0xff2a2a, 1), 2.4));
  }
  return merge(parts);
}

/** Atterrisseur lunaire générique : étage de descente doré à huit pans, cabine grise, quatre jambes, échelle. */
export function atterrisseurGeometry(): Part {
  const parts: Part[] = [
    colorize(new THREE.CylinderGeometry(1.25, 1.5, 1.3, 8).translate(0, 1.85, 0), OR),
    colorize(new THREE.CylinderGeometry(1.35, 1.25, 0.12, 8).translate(0, 2.55, 0), 0xcfd2da),
    colorize(new THREE.CylinderGeometry(1.0, 1.25, 1.5, 8).translate(0, 3.3, 0), 0xc9ccd6),
    colorize(new THREE.CylinderGeometry(0.75, 1.0, 0.5, 8).translate(0, 4.3, 0), 0xb8bcc8),
    coloredBox(0.6, 0.5, 0.06, 0, 3.5, 1.15, SOMBRE), coloredBox(0.6, 0.5, 0.06, 0, 3.5, -1.15, SOMBRE),
    tube(0.35, 0.5, 0.35, 0, 1.0, 0, 0x5a5e6c, 8),
    tube(0.05, 0.05, 0.7, 0.5, 4.5, 0, GRIS, 5), colorize(new THREE.SphereGeometry(0.3, 8, 3, 0, Math.PI * 2, 0, 0.9).rotateX(-0.9).translate(0.5, 5.1, 0), BLANC),
  ];
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI / 2) + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    parts.push(barre([c * 1.2, 2.2, s * 1.2], [c * 2.3, 0.1, s * 2.3], 0.07, 0xd8dbe2, 5));
    parts.push(barre([c * 1.0, 1.1, s * 1.0], [c * 2.1, 0.3, s * 2.1], 0.05, GRIS, 4));
    parts.push(tube(0.42, 0.36, 0.1, c * 2.3, -0.1, s * 2.3, 0xd8dbe2, 8));
  }
  // échelle le long d'une jambe
  parts.push(barre([0.0, 2.3, 1.45], [0.0, 0.3, 2.25], 0.03, GRIS, 4), coloredBox(0.4, 0.05, 0.3, 0, 2.3, 1.5, GRIS));
  return merge(parts);
}

/** Parabole : pied, dish blanche (face vers le haut-avant), bras et cornet d'alimentation. */
export function paraboleGeometry(): Part {
  const dishOut = new THREE.SphereGeometry(1.25, 12, 4, 0, Math.PI * 2, 0, 0.95);
  const dishIn = new THREE.SphereGeometry(1.2, 12, 4, 0, Math.PI * 2, 0, 0.95);
  // face intérieure : triangles retournés (on voit le creux de la parabole)
  const idx = dishIn.index!;
  for (let i = 0; i < idx.count; i += 3) { const b = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, b); }
  const place = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.translate(0, -0.95, 0).rotateX(-0.55).rotateY(0).translate(0, 2.4, 0.2);
  return merge([
    coloredBox(1.1, 0.2, 1.1, 0, -0.1, 0, 0x5a5e6c), tube(0.14, 0.12, 2.0, 0, -0.1, 0, GRIS, 6), coloredBox(0.4, 0.5, 0.4, 0, 1.9, 0, 0x7a7e8c),
    colorize(place(dishOut), BLANC), colorize(place(dishIn), 0xc6cad6),
    barre([0, 2.5, 0.3], [0, 3.85, 1.05], 0.035, GRIS, 4), blob(0.1, 1, 1, 1, 0, 3.9, 1.1, SOMBRE, 0),
  ]);
}

/** Balise : poteau sombre à bandes, feu orange lumineux. */
export function baliseGeometry(): Part {
  return merge([
    coloredBox(0.26, 0.12, 0.26, 0, -0.04, 0, 0x5a5e6c), tube(0.06, 0.06, 1.1, 0, 0, 0, SOMBRE, 5),
    tube(0.075, 0.075, 0.14, 0, 0.35, 0, BLANC, 5), tube(0.075, 0.075, 0.14, 0, 0.65, 0, 0xff7a1a, 5),
    eclat(blob(0.13, 1, 1, 1, 0, 1.22, 0, 0xffa030, 1), 2.4),
  ]);
}

/** Bidons de carburant : un debout, un couché. */
export function bidonGeometry(): Part {
  const fut = (x: number, z: number): Part[] => [
    tube(0.3, 0.3, 0.9, x, -0.05, z, BLANC, 9), tube(0.32, 0.32, 0.08, x, 0.25, z, 0xff7a1a, 9), tube(0.32, 0.32, 0.08, x, 0.6, z, 0xff7a1a, 9), tube(0.2, 0.2, 0.06, x, 0.85, z, GRIS, 7),
  ];
  const couche = colorize(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 9).rotateZ(Math.PI / 2).rotateY(0.6).translate(0.75, 0.28, 0.35), 0xd8dae2);
  return merge([...fut(0, 0), ...fut(0.05, -0.68), couche]);
}

/** Panneau à chevrons orange et noir. */
export function chevronEspaceGeometry(): Part {
  return merge([
    tube(0.05, 0.05, 1.4, 0, -0.1, 0, GRIS, 5),
    coloredBox(0.27, 0.6, 0.06, -0.4, 1.45, 0.06, 0xff7a1a), coloredBox(0.26, 0.6, 0.06, 0, 1.45, 0.06, SOMBRE), coloredBox(0.27, 0.6, 0.06, 0.4, 1.45, 0.06, 0xff7a1a),
  ]);
}

/** Glissière de remplacement : profilé gris à bande orange, 1 m le long de z. */
export function barriereEspaceGeometry(): Part {
  return merge([coloredBox(0.12, 0.3, 1, 0, 0.6, 0, 0xc6cad6), coloredBox(0.13, 0.08, 1, 0, 0.6, 0, 0xff7a1a), coloredBox(0.12, 0.75, 0.12, 0, 0.375, 0, 0x5a5e6c)]);
}

export function decorEspace(): Record<string, Part> {
  const d: Record<string, Part> = {};
  for (let i = 0; i < 3; i++) d[`cristal${i}`] = cristalGeometry(i);
  for (let i = 0; i < 2; i++) d[`antenne${i}`] = antenneGeometry(i);
  d.atterrisseur0 = atterrisseurGeometry();
  d.parabole0 = paraboleGeometry();
  d.balise0 = baliseGeometry();
  d.bidon0 = bidonGeometry();
  d.chevron0 = chevronEspaceGeometry();
  d.barriere = barriereEspaceGeometry();
  void lumineux;
  return d;
}
