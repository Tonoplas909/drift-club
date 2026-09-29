import * as THREE from 'three';
import type { CarModel } from './assets';
import { paintGeometry } from './assets';
import { toonMaterial, outlineMaterial, outlineGeometry } from './materials';

export interface CarPose {
  x: number; y: number; z: number;
  heading: number;
  steer: number;
  wheelSpin: number;
  /** inclinaison due au terrain (nez vers le haut = +) */
  groundPitch: number;
  /** dévers dû au terrain (côté gauche plus haut = +) */
  groundRoll: number;
  /** plongée/cabrage de la caisse */
  pitch: number;
  /** roulis de la caisse en virage */
  roll: number;
}

/** Voiture affichée : root (cap) → ground (pente) → [roues, lean (caisse)]. */
export class CarView {
  readonly root = new THREE.Group();
  private readonly ground = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly body: THREE.Mesh;
  private readonly mat = toonMaterial({ vertexColors: true });
  private readonly outlineMat = outlineMaterial(0.035);
  private readonly wheels: { pivot: THREE.Group; spin: THREE.Group; front: boolean }[] = [];
  private readonly owned: THREE.BufferGeometry[] = [];

  constructor(private readonly model: CarModel, color: string, shadows: boolean) {
    this.root.add(this.ground);
    this.ground.add(this.lean);
    this.body = new THREE.Mesh(paintGeometry(model.body, model.paint, new THREE.Color(color)), this.mat);
    this.body.castShadow = shadows;
    const bodyOutline = outlineGeometry(model.body);
    this.owned.push(bodyOutline);
    this.lean.add(this.body, new THREE.Mesh(bodyOutline, this.outlineMat));
    for (const w of model.wheels) {
      const pivot = new THREE.Group();
      pivot.position.copy(w.position);
      const spin = new THREE.Group();
      const mesh = new THREE.Mesh(w.geometry, this.mat);
      mesh.castShadow = shadows;
      const og = outlineGeometry(w.geometry);
      this.owned.push(og);
      spin.add(mesh, new THREE.Mesh(og, this.outlineMat));
      pivot.add(spin);
      this.ground.add(pivot);
      this.wheels.push({ pivot, spin, front: w.front });
    }
  }

  setColor(color: string): void {
    const old = this.body.geometry;
    this.body.geometry = paintGeometry(this.model.body, this.model.paint, new THREE.Color(color));
    old.dispose();
  }

  update(p: CarPose): void {
    this.root.position.set(p.x, p.y, p.z);
    this.root.rotation.set(0, p.heading, 0);
    this.ground.rotation.set(-p.groundPitch, 0, p.groundRoll);
    this.lean.rotation.set(-p.pitch, 0, p.roll);
    for (const w of this.wheels) {
      w.pivot.rotation.y = w.front ? p.steer : 0;
      w.spin.rotation.x = p.wheelSpin;
    }
  }

  /** Positions monde des roues arrière (gauche, droite) au niveau du sol. */
  rearWheels(out: THREE.Vector3[]): void {
    this.root.updateMatrixWorld(true);
    let k = 0;
    for (const w of this.wheels) {
      if (w.front || k >= out.length) continue;
      w.pivot.getWorldPosition(out[k]);
      out[k].y -= w.pivot.position.y;
      k++;
    }
  }

  dispose(): void {
    this.body.geometry.dispose();
    for (const g of this.owned) g.dispose();
    this.mat.dispose();
    this.outlineMat.dispose();
  }
}
