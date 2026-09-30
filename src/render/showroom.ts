import * as THREE from 'three';
import type { CarId } from '../core/physics/types';
import type { Assets } from './assets';
import { CarView } from './carView';
import { toonMaterial } from './materials';
import { skinDef, type SkinId } from '../core/skins';

export class Showroom {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private view: CarView | null = null;
  private angle = 0.6;
  private raf = 0;
  private last = 0;
  private running = false;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly assets: Assets) {
    this.scene.background = new THREE.Color(0x2a2f45);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3b3350, 1.2));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
    sun.position.set(4, 8, 5);
    this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 48), toonMaterial({ color: 0x3b4260 }));
    floor.position.y = -0.1;
    this.scene.add(floor);
    this.camera.position.set(5.5, 2.4, 6.5);
    this.camera.lookAt(0, 0.7, 0);
  }

  setCar(id: CarId, color: string, skin?: SkinId): void {
    if (this.view) { this.scene.remove(this.view.root); this.view.dispose(); }
    this.view = new CarView(this.assets.cars[id], color, false, skinDef(id, skin));
    this.scene.add(this.view.root);
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.angle += dt * 0.5;
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (w > 800) this.camera.setViewOffset(w, h, -w * 0.18, 0, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.view?.update({ x: 0, y: 0, z: 0, heading: this.angle, steer: 0.25, wheelSpin: 0, groundPitch: 0, groundRoll: 0, pitch: 0, roll: 0 });
    this.renderer.render(this.scene, this.camera);
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.renderer.clear();
  }

  dispose(): void {
    this.stop();
    this.view?.dispose();
  }
}
