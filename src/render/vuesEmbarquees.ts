import * as THREE from 'three';
import type { CarShape } from './jdmCars';
import { toonMaterial } from './materials';

/**
 * Caméras : poursuite (proche ou éloignée) et vues embarquées, posées sur la voiture.
 * Repère de la voiture : x vers la gauche, y vers le haut (0 au sol), z vers l'avant. Les voitures sont japonaises :
 * volant à droite (x < 0).
 */
export type VueCamera = 'proche' | 'loin' | 'capot' | 'calandre' | 'conducteur' | 'roue' | 'toit';
export type VueEmbarquee = Exclude<VueCamera, 'proche' | 'loin'>;

export const VUES_CAMERA: readonly VueCamera[] = ['proche', 'loin', 'capot', 'calandre', 'conducteur', 'roue', 'toit'];

export const NOMS_VUES: Record<VueCamera, string> = {
  proche: 'Poursuite', loin: 'Éloignée', capot: 'Capot', calandre: 'Calandre', conducteur: 'Conducteur', roue: 'Roue arrière', toit: 'Toit',
};

export const estEmbarquee = (v: VueCamera): v is VueEmbarquee => v !== 'proche' && v !== 'loin';

/** Vue suivante (touche C). */
export function vueSuivante(v: VueCamera): VueCamera {
  return VUES_CAMERA[(VUES_CAMERA.indexOf(v) + 1) % VUES_CAMERA.length];
}

export function lireVue(v: unknown, cameraLoin?: unknown): VueCamera {
  if (VUES_CAMERA.includes(v as VueCamera)) return v as VueCamera;
  return cameraLoin === true ? 'loin' : 'proche';
}

type V3 = [number, number, number];

/** Œil, point visé (repère de la voiture) et champ de vision d'une vue embarquée. */
export function pointsVue(v: VueEmbarquee, s: CarShape): { oeil: V3; vise: V3; fov: number } {
  const avant = s.length / 2;
  switch (v) {
    case 'capot':
      // juste devant le pare-brise, au ras du capot
      return { oeil: [0, s.cowlY + 0.24, s.cowlZ + 0.2], vise: [0, s.cowlY + 0.24, 40], fov: 74 };
    case 'calandre':
      return { oeil: [0, s.noseY * 0.85, avant + 0.06], vise: [0, s.noseY * 0.75, 40], fov: 80 };
    case 'conducteur': {
      const x = -0.27 * s.width, y = s.roofY - 0.2;
      return { oeil: [x, y, s.roofFrontZ - 0.38], vise: [x, y - 0.6, 40], fov: 72 };
    }
    case 'roue': {
      const x = s.width / 2;
      return { oeil: [x + 0.75, 0.5, s.rearAxle - 1.7], vise: [x - 0.25, 0.4, s.rearAxle + 2], fov: 68 };
    }
    case 'toit':
      return { oeil: [0, s.roofY + 0.42, (s.roofFrontZ + s.roofRearZ) / 2], vise: [0, s.roofY * 0.55, 30], fov: 72 };
  }
}

/** Un volant fait au plus 2,6 rad de chaque côté ; les roues braquent d'environ 0,6 rad. */
export const angleVolant = (braquage: number): number => Math.max(-2.6, Math.min(2.6, braquage * 6));

/**
 * Intérieur sommaire, dessiné seulement en vue conducteur : planche de bord, montants du pare-brise, volant
 * qui tourne avec la direction.
 */
export class Habitacle {
  readonly root = new THREE.Group();
  private readonly volant = new THREE.Group();
  private readonly mat = toonMaterial({ color: 0x24232b });
  private readonly matClair = toonMaterial({ color: 0x3a3944 });
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(s: CarShape) {
    const g = <T extends THREE.BufferGeometry>(x: T): T => { this.geos.push(x); return x; };
    const xC = -0.27 * s.width, yC = s.roofY - 0.2, zC = s.roofFrontZ - 0.38;
    // planche de bord : de la base du pare-brise jusque devant le volant
    const fond = zC + 0.62, prof = Math.max(0.25, s.cowlZ - fond);
    const planche = new THREE.Mesh(g(new THREE.BoxGeometry(s.width * 0.9, 0.24, prof)), this.mat);
    planche.position.set(0, s.cowlY - 0.1, fond + prof / 2);
    // casquette des compteurs, devant le conducteur
    const casquette = new THREE.Mesh(g(new THREE.BoxGeometry(0.42, 0.08, 0.2)), this.matClair);
    casquette.position.set(xC, s.cowlY + 0.05, fond + 0.1);
    // montants du pare-brise et traverse du haut
    const montant = (cote: number): THREE.Mesh => {
      const a = new THREE.Vector3(cote * s.width * 0.44, s.cowlY, s.cowlZ);
      const b = new THREE.Vector3(cote * s.width * 0.41, s.roofY - 0.04, s.roofFrontZ);
      const m = new THREE.Mesh(g(new THREE.BoxGeometry(0.07, 0.07, a.distanceTo(b))), this.mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.lookAt(b);
      return m;
    };
    const traverse = new THREE.Mesh(g(new THREE.BoxGeometry(s.width * 0.84, 0.04, 0.08)), this.mat);
    traverse.position.set(0, s.roofY - 0.02, s.roofFrontZ + 0.02);
    // volant : jante, moyeu et branches, incliné vers le conducteur
    const jante = new THREE.Mesh(g(new THREE.TorusGeometry(0.16, 0.022, 8, 24)), this.mat);
    const moyeu = new THREE.Mesh(g(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12)), this.matClair);
    moyeu.rotation.x = Math.PI / 2;
    const branche = new THREE.Mesh(g(new THREE.BoxGeometry(0.3, 0.03, 0.02)), this.mat);
    const branche2 = new THREE.Mesh(g(new THREE.BoxGeometry(0.03, 0.15, 0.02)), this.mat);
    branche2.position.y = -0.075;
    this.volant.add(jante, moyeu, branche, branche2);
    const support = new THREE.Group();
    support.position.set(xC, yC - 0.24, zC + 0.44);
    support.rotation.x = -0.45; // incliné, haut de la jante vers le pare-brise
    support.add(this.volant);
    this.root.add(planche, casquette, montant(1), montant(-1), traverse, support);
    this.root.visible = false;
  }

  /** Braquage des roues (rad) → rotation du volant. */
  majVolant(braquage: number): void {
    this.volant.rotation.z = -angleVolant(braquage);
  }

  dispose(): void {
    for (const x of this.geos) x.dispose();
    this.mat.dispose();
    this.matClair.dispose();
  }
}
