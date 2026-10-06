import * as THREE from 'three';
import type { CarId } from '../core/physics/types';
import type { FumeeStyle } from '../core/fumees';
import type { Assets } from './assets';
import { CarView } from './carView';
import { SmokeSystem } from './effects';
import { toonMaterial } from './materials';
import { skinDef, type SkinDef, type SkinId } from '../core/skins';

/** Bornes de la vue : hauteur de la caméra (rad au-dessus de l'horizon) et recul (× cadrage de référence). */
const ELEV_MIN = 0.04, ELEV_MAX = 1.05, ZOOM_MIN = 0.62, ZOOM_MAX = 1.6;

/**
 * Showroom (Garage, Atelier, caisses) : la voiture sur son plateau. Au Garage et dans l'Atelier, le joueur la fait
 * tourner en glissant (souris ou doigt), lève ou baisse la caméra, zoome (molette ou pincement) ; sans rotation
 * automatique. Avec une fumée, les roues arrière patinent sur place pour la montrer.
 */
export class Showroom {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  private view: CarView | null = null;
  private viewCar: CarId | null = null;
  private angle = 0.6;
  /** vitesse de rotation laissée par le dernier glissé (rad/s), amortie */
  private elan = 0;
  private elev = 0.27;
  private zoom = 1;
  private cadrage = 1;
  /** rotation lente automatique (révélation d'une caisse) ; coupée dès que le joueur touche à la vue */
  private auto = false;
  private fumee: SmokeSystem | null = null;
  private fumeeCle = '';
  private spin = 0;
  private readonly roues = [new THREE.Vector3(), new THREE.Vector3()];
  private raf = 0;
  private last = 0;
  private running = false;
  private detacher: (() => void) | null = null;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly assets: Assets) {
    this.scene.background = new THREE.Color(0x2a2f45);
    this.scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3b3350, 1.2));
    const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
    sun.position.set(4, 8, 5);
    this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.2, 48), toonMaterial({ color: 0x3b4260 }));
    floor.position.y = -0.1;
    this.scene.add(floor);
  }

  setCar(id: CarId, color: string, skin?: SkinId): void {
    this.setCarDef(id, color, skinDef(id, skin));
  }

  /** Livrée en cours de création (Atelier) : même voiture → seule la peinture est refaite, sans recréer la vue. */
  apercuLivree(id: CarId, color: string, def: SkinDef | null): void {
    if (this.view && this.viewCar === id) { this.view.setPeinture(color, def); return; }
    this.setCarDef(id, color, def);
  }

  private setCarDef(id: CarId, color: string, def: SkinDef | null): void {
    if (this.view) { this.scene.remove(this.view.root); this.view.dispose(); }
    const model = this.assets.cars[id];
    this.viewCar = id;
    this.view = new CarView(model, color, false, def);
    this.scene.add(this.view.root);
    // cadrage : la caméra recule pour les grandes voitures et s'approche des petites (4,4 m = cadrage de référence)
    this.cadrage = ((model.shape?.length ?? 4.4) + 1.6) / 6;
  }

  /** Fumée des pneus montrée en continu (roues arrière qui patinent) ; null : pas de fumée. */
  setFumee(style: FumeeStyle | null): void {
    const cle = style ? JSON.stringify(style) : '';
    if (cle === this.fumeeCle && (style === null) === (this.fumee === null)) return;
    if (this.fumee) { this.scene.remove(this.fumee.mesh, this.fumee.sparks); this.fumee.dispose(); this.fumee = null; }
    this.fumeeCle = cle;
    if (!style) return;
    // petites bouffées vite dissipées : la voiture reste visible au milieu de sa fumée
    this.fumee = new SmokeSystem(90, 0xe9e6e1, style, 60, { vie: [0.6, 1.0], taille: [0.22, 0.4], dispersion: 1.4, montee: [0.5, 1.1] });
    this.scene.add(this.fumee.mesh, this.fumee.sparks);
  }

  /** Rotation lente automatique (révélation d'une caisse). */
  setAuto(auto: boolean): void {
    this.auto = auto;
  }

  /**
   * Laisse le joueur manipuler la vue depuis `el` (l'écran au-dessus du canvas) : glisser pour tourner la voiture et
   * lever la caméra, molette ou pincement pour zoomer. Les gestes qui commencent sur un panneau ou un bouton sont ignorés.
   * Un nouvel appel (ou `null`) remplace le précédent.
   */
  piloter(el: HTMLElement | null): void {
    this.detacher?.();
    this.detacher = null;
    if (!el) return;
    const points = new Map<number, { x: number; y: number }>();
    let ecart = 0, dernierT = 0;
    const horsPanneau = (e: Event): boolean => !(e.target as HTMLElement | null)?.closest?.('.panel, button, input, select, textarea, a');
    const bas = (e: PointerEvent): void => {
      if (!horsPanneau(e)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.setPointerCapture?.(e.pointerId);
      this.auto = false;
      this.elan = 0;
      dernierT = performance.now();
      if (points.size === 2) { const [a, b] = [...points.values()]; ecart = Math.hypot(a.x - b.x, a.y - b.y); }
      e.preventDefault();
    };
    const bouge = (e: PointerEvent): void => {
      const p = points.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (points.size >= 2) {
        // pincement : zoom
        const [a, b] = [...points.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (ecart > 0 && d > 0) this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * (ecart / d)));
        ecart = d;
        return;
      }
      const k = 6 / Math.max(400, window.innerWidth);
      this.angle += dx * k;
      this.elev = Math.min(ELEV_MAX, Math.max(ELEV_MIN, this.elev + dy * k * 0.7));
      const now = performance.now(), dt = Math.max(1, now - dernierT) / 1000;
      this.elan = (dx * k) / dt;
      dernierT = now;
    };
    const haut = (e: PointerEvent): void => {
      if (!points.delete(e.pointerId)) return;
      // relâché après une pause : pas d'élan
      if (performance.now() - dernierT > 80) this.elan = 0;
      if (points.size < 2) ecart = 0;
    };
    const molette = (e: WheelEvent): void => {
      if (!horsPanneau(e)) return;
      this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * Math.exp(e.deltaY * 0.0012)));
      this.auto = false;
      e.preventDefault();
    };
    el.addEventListener('pointerdown', bas);
    el.addEventListener('pointermove', bouge);
    el.addEventListener('pointerup', haut);
    el.addEventListener('pointercancel', haut);
    el.addEventListener('wheel', molette, { passive: false });
    this.detacher = () => {
      el.removeEventListener('pointerdown', bas);
      el.removeEventListener('pointermove', bouge);
      el.removeEventListener('pointerup', haut);
      el.removeEventListener('pointercancel', haut);
      el.removeEventListener('wheel', molette);
    };
  }

  private readonly frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    if (this.auto) this.angle += dt * 0.5;
    else if (Math.abs(this.elan) > 0.01) { this.angle += this.elan * dt; this.elan *= Math.exp(-dt * 4); }
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (w > 800) this.camera.setViewOffset(w, h, -w * 0.18, 0, w, h);
    else this.camera.clearViewOffset();
    // caméra en orbite : azimut fixe (trois-quarts avant), hauteur et recul réglés par le joueur
    const d = 8.85 * this.cadrage * this.zoom, az = 0.7;
    this.camera.position.set(d * Math.cos(this.elev) * Math.sin(az), 0.7 + d * Math.sin(this.elev), d * Math.cos(this.elev) * Math.cos(az));
    this.camera.lookAt(0, 0.7, 0);
    this.camera.updateProjectionMatrix();
    const fume = this.fumee !== null;
    if (fume) this.spin += dt * 40;
    this.view?.update({ x: 0, y: 0, z: 0, heading: this.angle, steer: fume ? 0 : 0.25, wheelSpin: this.spin, groundPitch: 0, groundRoll: 0, pitch: fume ? 0.012 : 0, roll: 0 });
    if (this.fumee && this.view) {
      // burn sur place : la fumée part vers l'arrière de la voiture
      this.view.rearWheels(this.roues);
      this.fumee.emit(this.roues, 14, dt, -Math.sin(this.angle) * 8, -Math.cos(this.angle) * 8);
      this.fumee.update(dt);
    }
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
    this.piloter(null);
    this.renderer.clear();
  }

  dispose(): void {
    this.stop();
    this.view?.dispose();
    this.fumee?.dispose();
  }
}
