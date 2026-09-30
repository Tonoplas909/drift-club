import * as THREE from 'three';
import { clamp } from '../core/math/vec';

const HAUTEUR = 1.0;
const LARGEUR = 0.17;
const BORD = 0.04;
/** écart latéral entre le flanc de la voiture et la jauge (m) */
const ECART = 0.7;
/** bas de la jauge au-dessus du sol (m) */
const BAS = 0.35;

/** Remplissage de la jauge : 0 à l'arrêt ou en marche arrière, 1 à la vitesse max. */
export function gaugeRatio(speed: number, reverse: boolean, maxSpeed: number): number {
  return reverse ? 0 : clamp(speed / maxSpeed, 0, 1);
}

/** Couleur au niveau `t` de la jauge : vert → jaune → rouge. */
export function gaugeColor(t: number, out = new THREE.Color()): THREE.Color {
  return out.setHSL((1 - clamp(t, 0, 1)) / 3, 0.9, 0.5);
}

/** Jauge de vitesse verticale, en 3D à côté de la voiture et toujours face à la caméra. */
export class SpeedGauge {
  readonly root = new THREE.Group();
  private readonly fill: THREE.Mesh;
  private readonly colors: THREE.BufferAttribute;
  private readonly owned: { dispose(): void }[] = [];
  private readonly right = new THREE.Vector3();
  private readonly tmp = new THREE.Color();
  private shown = 0;

  constructor() {
    const mat = (o: THREE.MeshBasicMaterialParameters) => {
      const m = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false, ...o });
      this.owned.push(m);
      return m;
    };
    const plane = (w: number, h: number) => {
      const g = new THREE.PlaneGeometry(w, h);
      g.translate(0, h / 2, 0); // origine en bas : scale.y remplit vers le haut
      this.owned.push(g);
      return g;
    };
    const back = new THREE.Mesh(plane(LARGEUR + 2 * BORD, HAUTEUR + 2 * BORD), mat({ color: 0x14161c, opacity: 0.55 }));
    back.position.y = -BORD;
    const fillGeo = plane(LARGEUR, HAUTEUR);
    this.colors = new THREE.BufferAttribute(new Float32Array(4 * 3), 3);
    fillGeo.setAttribute('color', this.colors);
    this.fill = new THREE.Mesh(fillGeo, mat({ vertexColors: true, opacity: 0.95 }));
    this.fill.position.z = 0.001;
    back.renderOrder = 20;
    this.fill.renderOrder = 21;
    this.root.add(back, this.fill);
    this.setFill(0);
  }

  /** Dégradé du bas (vert) jusqu'à la couleur du niveau atteint en haut. */
  private setFill(t: number): void {
    this.fill.scale.y = Math.max(t, 1e-3);
    this.fill.visible = t > 0.005;
    const c = this.colors.array as Float32Array;
    // PlaneGeometry : sommets 0,1 en haut, 2,3 en bas
    gaugeColor(t, this.tmp);
    for (const i of [0, 1]) this.tmp.toArray(c, i * 3);
    gaugeColor(0, this.tmp);
    for (const i of [2, 3]) this.tmp.toArray(c, i * 3);
    this.colors.needsUpdate = true;
  }

  /** Place la jauge à droite de la voiture (vue de la caméra) et met à jour le remplissage. */
  update(x: number, y: number, z: number, carWidth: number, ratio: number, camera: THREE.Camera, dt: number): void {
    this.shown += (ratio - this.shown) * (1 - Math.exp(-12 * dt));
    this.setFill(this.shown);
    this.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    this.right.y = 0;
    this.right.normalize().multiplyScalar(carWidth / 2 + ECART);
    this.root.position.set(x + this.right.x, y + BAS, z + this.right.z);
    this.root.quaternion.copy(camera.quaternion);
  }

  dispose(): void {
    for (const d of this.owned) d.dispose();
  }
}
