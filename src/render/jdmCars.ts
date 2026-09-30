import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CarId } from '../core/physics/types';
import { colorize, coloredBox, wheelGeometry } from './procedural';
import type { CarModel, WheelModel } from './assets';

/** Couleur « sentinelle » de la peinture, remplacée par la couleur choisie (paintGeometry). */
export const PAINT = new THREE.Color(1, 0, 1);
const GLASS = 0x28303f;
const TRIM = 0x1d1d24;
const LIGHT_FRONT = 0xfff4c2;
const LIGHT_REAR = 0xd9302a;
const POPUP = 0xdfe3ea;

/** Silhouette d'une voiture (m). z = 0 au centre de gravité, avant vers +z. */
export interface CarShape {
  length: number;
  width: number;
  groundClear: number;
  wheelR: number;
  frontAxle: number;
  rearAxle: number;
  noseY: number;
  hoodFrontY: number;
  cowlZ: number;
  cowlY: number;
  deckZ: number;
  deckY: number;
  tailY: number;
  roofFrontZ: number;
  roofRearZ: number;
  roofY: number;
  aileron: 'aucun' | 'petit' | 'grand';
  phares: 'escamotables' | 'fixes';
}

/** Longueurs et essieux alignés sur la physique (CARS : length, cgToFront, cgToFront − wheelbase). */
export const CAR_SHAPES: Record<CarId, CarShape> = {
  legere: {
    length: 4.1, width: 1.68, groundClear: 0.24, wheelR: 0.31, frontAxle: 1.15, rearAxle: -1.3,
    noseY: 0.4, hoodFrontY: 0.58, cowlZ: 0.62, cowlY: 0.76, deckZ: -1.85, deckY: 0.8, tailY: 0.78,
    roofFrontZ: 0.02, roofRearZ: -1.05, roofY: 1.24, aileron: 'aucun', phares: 'escamotables',
  },
  equilibree: {
    length: 4.4, width: 1.74, groundClear: 0.25, wheelR: 0.32, frontAxle: 1.25, rearAxle: -1.35,
    noseY: 0.42, hoodFrontY: 0.62, cowlZ: 0.72, cowlY: 0.8, deckZ: -1.45, deckY: 0.84, tailY: 0.8,
    roofFrontZ: 0.05, roofRearZ: -0.6, roofY: 1.22, aileron: 'petit', phares: 'fixes',
  },
  turbo: {
    length: 4.6, width: 1.82, groundClear: 0.24, wheelR: 0.34, frontAxle: 1.45, rearAxle: -1.35,
    noseY: 0.42, hoodFrontY: 0.64, cowlZ: 0.55, cowlY: 0.84, deckZ: -1.55, deckY: 0.88, tailY: 0.86,
    roofFrontZ: -0.12, roofRearZ: -0.75, roofY: 1.24, aileron: 'grand', phares: 'fixes',
  },
};

export function arch(cz: number, y0: number, r: number, n = 6): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (1 - i / n);
    pts.push([cz + r * Math.cos(a), y0 + r * Math.sin(a)]);
  }
  return pts;
}

/** Contour de la caisse : dessous (avec passages de roues), nez, capot, ligne de caisse, arrière. */
export function bodyProfile(s: CarShape): [number, number][] {
  const h = s.length / 2, y0 = s.groundClear, ar = s.wheelR + 0.09;
  return [
    [-h + 0.08, y0],
    ...arch(s.rearAxle, y0, ar),
    ...arch(s.frontAxle, y0, ar),
    [h - 0.08, y0 + 0.03],
    [h, s.noseY],
    [h - 0.03, s.hoodFrontY],
    [h - 0.25, s.hoodFrontY + 0.04],
    [s.cowlZ, s.cowlY],
    [s.deckZ, s.deckY],
    [-h + 0.15, s.deckY],
    [-h, s.tailY],
    [-h, y0 + 0.15],
  ];
}

/** Habitacle vitré : pare-brise, toit, lunette. */
export function cabinProfile(s: CarShape): [number, number][] {
  return [[s.cowlZ, s.cowlY], [s.roofFrontZ, s.roofY], [s.roofRearZ, s.roofY], [s.deckZ, s.deckY + 0.02]];
}

/** Extrude un profil (z, y) sur la largeur `width` (centrée sur x = 0), arêtes chanfreinées. */
export function extrudeProfile(points: [number, number][], width: number, color: THREE.ColorRepresentation, bevel = 0.04): THREE.BufferGeometry {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(0.01, width - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(-Math.PI / 2);
  return colorize(g, color);
}

export function buildJdmCar(s: CarShape): CarModel {
  const w = s.width, h = s.length / 2, cw = w - 0.3;
  const both = (f: (side: number) => THREE.BufferGeometry) => [f(1), f(-1)];
  const parts: THREE.BufferGeometry[] = [
    extrudeProfile(bodyProfile(s), w, PAINT, 0.04),
    extrudeProfile(cabinProfile(s), cw, GLASS, 0.03),
    coloredBox(cw - 0.02, 0.05, s.roofFrontZ - s.roofRearZ + 0.08, 0, s.roofY + 0.03, (s.roofFrontZ + s.roofRearZ) / 2, PAINT),
    coloredBox(w - 0.1, 0.1, 0.14, 0, s.groundClear + 0.05, h - 0.02, TRIM),
    coloredBox(w - 0.1, 0.1, 0.14, 0, s.groundClear + 0.05, -h + 0.02, TRIM),
    coloredBox(0.7, 0.08, 0.04, 0, s.noseY + 0.02, h + 0.02, TRIM),
    ...both((side) => coloredBox(0.4, 0.1, 0.04, side * (w / 2 - 0.3), s.tailY - 0.14, -h - 0.02, LIGHT_REAR)),
    ...both((side) => coloredBox(0.12, 0.08, 0.14, side * (cw / 2 + 0.06), s.cowlY + 0.1, s.cowlZ - 0.2, PAINT)),
  ];
  if (s.phares === 'escamotables') {
    parts.push(...both((side) => coloredBox(0.36, 0.04, 0.22, side * (w / 2 - 0.32), s.hoodFrontY + 0.03, h - 0.3, POPUP)));
  } else {
    parts.push(...both((side) => coloredBox(0.34, 0.1, 0.04, side * (w / 2 - 0.3), s.noseY + 0.12, h + 0.02, LIGHT_FRONT)));
  }
  if (s.aileron === 'petit') parts.push(coloredBox(w - 0.3, 0.05, 0.2, 0, s.deckY + 0.04, -h + 0.22, PAINT));
  if (s.aileron === 'grand') {
    parts.push(
      ...both((side) => coloredBox(0.06, 0.3, 0.12, side * 0.55, s.deckY + 0.15, -h + 0.3, TRIM)),
      coloredBox(w - 0.1, 0.06, 0.4, 0, s.deckY + 0.32, -h + 0.28, PAINT),
      ...both((side) => coloredBox(0.04, 0.18, 0.42, side * (w / 2 - 0.05), s.deckY + 0.3, -h + 0.28, TRIM)),
    );
  }
  const body = mergeGeometries(parts);
  if (!body) throw new Error('carrosserie impossible à assembler');
  body.computeBoundingSphere();

  const wheel = wheelGeometry(s.wheelR, 0.24);
  const wx = w / 2 - 0.12;
  const wheels: WheelModel[] = [];
  for (const [z, front] of [[s.frontAxle, true], [s.rearAxle, false]] as const) {
    for (const side of [1, -1]) {
      wheels.push({ geometry: wheel, position: new THREE.Vector3(side * wx, s.wheelR, z), front, left: side > 0 });
    }
  }
  return { body, wheels, paint: PAINT.clone(), shape: s };
}
