import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Rend la géométrie non indexée, sans UV, avec normales plates et une couleur unie par sommet. */
export function colorize(g: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const out = g.index ? g.toNonIndexed() : g;
  if (out.getAttribute('uv')) out.deleteAttribute('uv');
  out.computeVertexNormals();
  const c = new THREE.Color(color);
  const n = out.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return out;
}

export function coloredBox(w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  return colorize(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);
}

export const merge = (parts: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const g = mergeGeometries(parts);
  if (!g) throw new Error('fusion de géométries impossible');
  return g;
};

/** Roue centrée sur l'origine, axe selon x : pneu, jante, moyeu et 3 rayons (6 branches) visibles en rotation. */
export function wheelGeometry(r: number, width: number): THREE.BufferGeometry {
  const cyl = (radius: number, len: number, seg: number, color: number) =>
    colorize(new THREE.CylinderGeometry(radius, radius, len, seg, 1).rotateZ(Math.PI / 2), color);
  const parts = [cyl(r, width, 14, 0x1d1d24), cyl(r * 0.62, width + 0.02, 10, 0xc9ced6), cyl(r * 0.2, width + 0.05, 6, 0x6b6f7a)];
  for (let k = 0; k < 3; k++) parts.push(coloredBox(width + 0.03, r * 1.12, 0.06, 0, 0, 0, 0x8a8f99).rotateX((k * Math.PI) / 3));
  return merge(parts);
}

/** Borne de bord de route : poteau blanc à bande rouge. */
export function borneGeometry(): THREE.BufferGeometry {
  return merge([
    coloredBox(0.18, 0.9, 0.18, 0, 0.45, 0, 0xf2f2ee),
    coloredBox(0.19, 0.12, 0.19, 0, 0.76, 0, 0xe63b2e),
  ]);
}

/** Panneau à chevrons : poteau + panneau à bandes rouge/blanc/rouge, face vers +z. */
export function chevronGeometry(): THREE.BufferGeometry {
  return merge([
    coloredBox(0.1, 1.3, 0.1, 0, 0.65, 0, 0x6b6f7a),
    coloredBox(0.27, 0.6, 0.06, -0.4, 1.45, 0.06, 0xe63b2e),
    coloredBox(0.26, 0.6, 0.06, 0, 1.45, 0.06, 0xf4f1e8),
    coloredBox(0.27, 0.6, 0.06, 0.4, 1.45, 0.06, 0xe63b2e),
  ]);
}

/** Glissière de sécurité, 1 m de long le long de +z (mise à l'échelle en z par tronçon). */
export function barrierGeometry(): THREE.BufferGeometry {
  return merge([
    coloredBox(0.12, 0.32, 1.0, 0, 0.6, 0, 0xc9ced6),
    coloredBox(0.12, 0.75, 0.12, 0, 0.375, 0, 0x5b606b),
  ]);
}

/** Trois roues couchées (axe vertical) empilées, base à y = 0. */
export function tireStack(wheel: THREE.BufferGeometry): THREE.BufferGeometry {
  const one = wheel.clone();
  one.rotateZ(Math.PI / 2);
  one.computeBoundingBox();
  const bb = one.boundingBox!;
  one.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  const h = bb.max.y - bb.min.y;
  return merge([0, 1, 2].map((i) => one.clone().translate(0, i * h, 0)));
}
