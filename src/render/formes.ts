import * as THREE from 'three';
import { colorize, coloredBox, merge } from './procedural';

/**
 * Petites formes de base partagées par les modèles procéduraux des thèmes (pirate, backrooms, espace, japon) :
 * tout en aplats colorés, normales plates, base à y = 0 (les pieds sont enterrés de quelques dizaines de cm).
 */
export type Part = THREE.BufferGeometry;

export { coloredBox, colorize, merge };

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** Cylindre (ou tronc de cône) debout, base en y0. */
export const tube = (rBas: number, rHaut: number, h: number, x: number, y0: number, z: number, color: number, seg = 7): Part =>
  colorize(new THREE.CylinderGeometry(rHaut, rBas, h, seg, 1).translate(x, y0 + h / 2, z), color);

/** Cône debout, base en y0. */
export const cone = (r: number, h: number, x: number, y0: number, z: number, color: number, seg = 6): Part =>
  colorize(new THREE.ConeGeometry(r, h, seg).translate(x, y0 + h / 2, z), color);

/** Boule (éventuellement aplatie) centrée en (x, y, z). */
export const blob = (r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, detail = 1): Part =>
  colorize(new THREE.IcosahedronGeometry(r, detail).scale(sx, sy, sz).translate(x, y, z), color);

/** Calotte (demi-sphère) posée sur y0. */
export const dome = (r: number, x: number, y0: number, z: number, color: number, seg = 8): Part =>
  colorize(new THREE.SphereGeometry(r, seg, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(x, y0, z), color);

/** Boîte tournée (angles d'Euler en radians, ordre XYZ) puis déplacée. */
export const boiteRot = (w: number, h: number, d: number, rx: number, ry: number, rz: number, x: number, y: number, z: number, color: number): Part =>
  colorize(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(x, y, z), color);

/** Barre cylindrique entre deux points. */
export function barre(a: [number, number, number], b: [number, number, number], r: number, color: number, seg = 5): Part {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = dir.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return colorize(g, color);
}

/** Lame plate (largeur w, épaisseur t) entre deux points : feuilles de palmier, planches. */
export function lame(a: [number, number, number], b: [number, number, number], w: number, t: number, color: number): Part {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const L = dir.length();
  const g = new THREE.BoxGeometry(w, t, L);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Z, dir.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return colorize(g, color);
}

/** Multiplie les couleurs d'un modèle (gain > 1 : il « brille » malgré l'ombrage, comme les fenêtres allumées de la ville). */
export function eclat(g: Part, gain: number): Part {
  const col = g.getAttribute('color') as THREE.BufferAttribute;
  for (let i = 0; i < col.count; i++) col.setXYZ(i, col.getX(i) * gain, col.getY(i) * gain, col.getZ(i) * gain);
  return g;
}

/** Une couleur « allumée » : `colorize` puis `eclat`. */
export const lumineux = (g: Part, color: number, gain: number): Part => eclat(colorize(g, color), gain);

/** Assemblage de triangles colorés (maillages paramétriques : coques, pétales…), normales plates. */
export class Tampon {
  private pos: number[] = [];
  private col: number[] = [];

  /** Triangle (a, b, c) ; l'orientation de la face suit l'ordre des sommets (sens trigonométrique vu de l'extérieur). */
  tri(a: number[], b: number[], c: number[], color: THREE.Color): void {
    for (const p of [a, b, c]) { this.pos.push(p[0], p[1], p[2]); this.col.push(color.r, color.g, color.b); }
  }

  /** Quad (a, b, c, d) ; `vers` : point vers lequel la face doit regarder (inversée si besoin). */
  quad(a: number[], b: number[], c: number[], d: number[], color: THREE.Color, vers?: number[]): void {
    if (vers) {
      const n = [
        (b[1] - a[1]) * (d[2] - a[2]) - (b[2] - a[2]) * (d[1] - a[1]),
        (b[2] - a[2]) * (d[0] - a[0]) - (b[0] - a[0]) * (d[2] - a[2]),
        (b[0] - a[0]) * (d[1] - a[1]) - (b[1] - a[1]) * (d[0] - a[0]),
      ];
      const cx = (a[0] + b[0] + c[0] + d[0]) / 4, cy = (a[1] + b[1] + c[1] + d[1]) / 4, cz = (a[2] + b[2] + c[2] + d[2]) / 4;
      if (n[0] * (vers[0] - cx) + n[1] * (vers[1] - cy) + n[2] * (vers[2] - cz) < 0) { this.tri(a, d, c, color); this.tri(a, c, b, color); return; }
    }
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  geometrie(): Part {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}
