import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { MotoId } from '../core/physics/types';
import type { CarModel, WheelModel } from './assets';
import { colorize, coloredBox } from './procedural';
import { PAINT } from './jdmCars';

/**
 * Motos : modèle low-poly (cadre, réservoir, carénage, pilote) dans le repère des voitures (x à gauche, y en haut,
 * 0 au sol, z vers l'avant). Les pièces peintes (réservoir, carénage, casque) prennent la couleur choisie.
 */
export interface MotoShape {
  /** demi-empattement avant / arrière (m) : roues en z = +avant et z = −arriere */
  avant: number;
  arriere: number;
  roueR: number;
  roueL: number;
  /** longueur hors tout (m), pour le cadrage du garage */
  length: number;
}

export const MOTO_SHAPES: Record<MotoId, MotoShape> = {
  supermotard: { avant: 0.72, arriere: 0.73, roueR: 0.31, roueL: 0.14, length: 2.1 },
};

const CADRE = 0x34363e;
const MOTEUR = 0x4a4d57;
const CHROME = 0xc8ccd4;
const SELLE = 0x1f1f25;
const COMBI = 0x26272f;
const GANTS = 0x111114;
const VISIERE = 0x101820;
const PHARE = 0xfff3c4;
const FEU = 0xd11f1f;

/** Pavé tourné autour de x (inclinaison avant/arrière), centré en (x, y, z). */
function pave(w: number, h: number, d: number, x: number, y: number, z: number, rx: number, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  return colorize(new THREE.BoxGeometry(w, h, d).rotateX(rx).translate(x, y, z), color);
}

/**
 * Roue de moto, axe selon x : pneu arrondi (tore : une moto roule sur la tranche du pneu en virage), jante fine à
 * rayons et moyeu.
 */
export function roueMoto(r: number, largeur: number): THREE.BufferGeometry {
  const tube = largeur / 2;
  const parts: THREE.BufferGeometry[] = [
    colorize(new THREE.TorusGeometry(r - tube, tube, 8, 24).rotateY(Math.PI / 2), 0x1d1d24),
    colorize(new THREE.TorusGeometry(r - largeur, 0.018, 4, 24).rotateY(Math.PI / 2), 0xb9bec8),
    colorize(new THREE.CylinderGeometry(r * 0.16, r * 0.16, largeur + 0.04, 8, 1).rotateZ(Math.PI / 2), 0x6b6f7a),
  ];
  // rayons : fines barres en étoile, visibles quand la roue tourne
  for (let k = 0; k < 6; k++) parts.push(coloredBox(0.02, (r - largeur) * 2, 0.02, 0, 0, 0, 0x8a8f99).rotateX((k * Math.PI) / 6));
  const g = mergeGeometries(parts);
  if (!g) throw new Error('roue de moto impossible à assembler');
  return g;
}

/** Moto et pilote assis, prêts à être inclinés d'un bloc (CarView fait pivoter tout le groupe au sol). */
export function buildMoto(s: MotoShape): CarModel {
  const za = s.avant, zr = -s.arriere, r = s.roueR;
  const both = (f: (side: number) => THREE.BufferGeometry) => [f(1), f(-1)];
  const parts: THREE.BufferGeometry[] = [
    // cadre, moteur, bras oscillant, échappement
    pave(0.09, 0.08, 0.95, 0, 0.62, 0.05, -0.32, CADRE),
    coloredBox(0.28, 0.3, 0.42, 0, 0.42, 0.02, MOTEUR),
    pave(0.12, 0.06, 0.62, 0, r + 0.06, zr / 2, -0.1, CADRE),
    pave(0.08, 0.08, 0.55, -0.15, 0.56, -0.42, 0.35, CHROME),
    // fourche (inclinée), té et guidon
    ...both((side) => pave(0.045, 0.62, 0.045, side * 0.075, r + 0.3, za - 0.1, -0.42, CHROME)),
    coloredBox(0.22, 0.05, 0.08, 0, r + 0.6, za - 0.24, CADRE),
    coloredBox(0.64, 0.035, 0.035, 0, r + 0.72, za - 0.3, GANTS),
    // garde-boue avant, plaque avant (phare), réservoir, selle, coque arrière et feu
    pave(0.15, 0.03, 0.42, 0, r + 0.12, za + 0.02, -0.15, PAINT),
    pave(0.3, 0.26, 0.05, 0, r + 0.55, za - 0.08, -0.35, PAINT),
    coloredBox(0.12, 0.08, 0.03, 0, r + 0.55, za - 0.04, PHARE),
    pave(0.32, 0.2, 0.46, 0, 0.84, 0.16, -0.12, PAINT),
    pave(0.24, 0.07, 0.62, 0, 0.86, -0.32, 0.06, SELLE),
    pave(0.22, 0.12, 0.36, 0, 0.9, -0.62, 0.18, PAINT),
    coloredBox(0.1, 0.04, 0.03, 0, 0.88, -0.81, FEU),
    // pilote : jambes, buste penché en avant, bras vers le guidon, casque peint et visière
    ...both((side) => pave(0.13, 0.13, 0.44, side * 0.18, 0.92, -0.1, -0.15, COMBI)),
    ...both((side) => pave(0.12, 0.42, 0.13, side * 0.2, 0.66, 0.16, 0.35, COMBI)),
    ...both((side) => coloredBox(0.11, 0.08, 0.2, side * 0.2, 0.42, 0.24, GANTS)),
    pave(0.36, 0.5, 0.24, 0, 1.18, -0.12, 0.55, COMBI),
    ...both((side) => pave(0.09, 0.09, 0.46, side * 0.23, 1.18, 0.12, 0.45, COMBI)),
    pave(0.27, 0.27, 0.3, 0, 1.47, 0.06, 0.2, PAINT),
    pave(0.2, 0.09, 0.03, 0, 1.47, 0.215, 0.2, VISIERE),
  ];
  const body = mergeGeometries(parts);
  if (!body) throw new Error('moto impossible à assembler');
  body.computeBoundingSphere();
  const roue = roueMoto(r, s.roueL);
  const wheels: WheelModel[] = [
    { geometry: roue, position: new THREE.Vector3(0, r, za), front: true, left: false },
    { geometry: roue, position: new THREE.Vector3(0, r, zr), front: false, left: false },
  ];
  return {
    body, wheels, paint: PAINT.clone(), moto: true,
    vues: {
      capot: { oeil: [0, 1.12, 0.32], vise: [0, 0.9, 40], fov: 76 },
      calandre: { oeil: [0, r + 0.3, za + 0.2], vise: [0, r + 0.2, 40], fov: 80 },
      conducteur: { oeil: [0, 1.5, 0.24], vise: [0, 0.95, 40], fov: 74 },
      roue: { oeil: [0.95, 0.5, zr - 1.7], vise: [-0.1, 0.4, zr + 2], fov: 68 },
      toit: { oeil: [0, 2.1, -0.6], vise: [0, 0.8, 30], fov: 72 },
    },
    longueur: s.length,
  };
}
