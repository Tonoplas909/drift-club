import * as THREE from 'three';
import { mulberry32 } from '../core/math/rng';

/**
 * Néons qui clignotent (backrooms) : quelques instances seulement d'un InstancedMesh (celles dont le nom commence par `prefixe`)
 * voient leur couleur d'instance baisser par à-coups. Quelques dizaines de flottants par image, rien d'autre.
 */
export class Scintillement {
  private readonly cibles: { mesh: THREE.InstancedMesh; index: number; phase: number }[] = [];
  private t = 0;
  private readonly c = new THREE.Color();

  constructor(racine: THREE.Object3D, reglage: { prefixe: string; nombre: number }) {
    const rng = mulberry32(77);
    const blanc = new THREE.Color(1, 1, 1);
    racine.traverse((o) => {
      const m = o as THREE.InstancedMesh;
      if (!m.isInstancedMesh || !m.name.startsWith(reglage.prefixe) || m.name.endsWith(':loin')) return;
      for (let i = 0; i < m.count; i++) m.setColorAt(i, blanc); // crée le tampon de couleurs d'instance
      const pas = Math.max(1, Math.floor(m.count / Math.max(1, reglage.nombre)));
      for (let i = 0; i < m.count && this.cibles.length < reglage.nombre; i += pas) this.cibles.push({ mesh: m, index: i, phase: rng() * 100 });
    });
  }

  update(dt: number): void {
    this.t += dt;
    const touches = new Set<THREE.InstancedMesh>();
    for (const c of this.cibles) {
      // bourdonnement léger et coupures brèves, de temps en temps
      const coupure = Math.sin(this.t * 2.1 + c.phase) * Math.sin(this.t * 13.7 + c.phase * 3) > 0.86 ? 0.22 : 1;
      const v = coupure * (0.93 + 0.07 * Math.sin(this.t * 55 + c.phase));
      this.c.setScalar(v);
      c.mesh.setColorAt(c.index, this.c);
      touches.add(c.mesh);
    }
    for (const m of touches) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}
