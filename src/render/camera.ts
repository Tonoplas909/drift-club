import * as THREE from 'three';
import type { Ground } from '../core/track/terrain';
import { lerp, smoothstep, wrapAngle } from '../core/math/vec';

export interface ChaseConfig { dist: number; height: number; lookAhead: number; fovMin: number; fovMax: number }
export const CAMERA_PROCHE: ChaseConfig = { dist: 7, height: 2.8, lookAhead: 4, fovMin: 60, fovMax: 72 };
export const CAMERA_LOIN: ChaseConfig = { dist: 10, height: 4, lookAhead: 5, fovMin: 60, fovMax: 72 };

export interface CameraTarget { x: number; y: number; z: number; heading: number; vx: number; vz: number; speed: number }

/** La caméra suit la direction de la vitesse (on voit l'angle de drift), le cap sous 2 m/s. */
export function desiredYaw(t: CameraTarget): number {
  return t.speed > 2 ? Math.atan2(t.vx, t.vz) : t.heading;
}

export class ChaseCamera {
  yaw = 0;
  private readonly pos = new THREE.Vector3();
  private shake = 0;
  private time = 0;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  private target(t: CameraTarget, cfg: ChaseConfig, ground: Ground): THREE.Vector3 {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const x = t.x - fx * cfg.dist, z = t.z - fz * cfg.dist;
    const y = Math.max(t.y + cfg.height, ground.heightAt(x, z) + 1.2);
    return new THREE.Vector3(x, y, z);
  }

  reset(t: CameraTarget, cfg: ChaseConfig, ground: Ground): void {
    this.yaw = t.heading;
    this.pos.copy(this.target(t, cfg, ground));
    this.shake = 0;
    this.apply(t, cfg);
  }

  addShake(impact: number): void {
    this.shake = Math.min(0.6, this.shake + impact * 0.05);
  }

  update(t: CameraTarget, cfg: ChaseConfig, dt: number, ground: Ground): void {
    this.time += dt;
    this.yaw += wrapAngle(desiredYaw(t) - this.yaw) * (1 - Math.exp(-4 * dt));
    const tg = this.target(t, cfg, ground);
    const k = 1 - Math.exp(-8 * dt);
    this.pos.x += (tg.x - this.pos.x) * k;
    this.pos.z += (tg.z - this.pos.z) * k;
    this.pos.y += (tg.y - this.pos.y) * (1 - Math.exp(-5 * dt));
    this.pos.y = Math.max(this.pos.y, ground.heightAt(this.pos.x, this.pos.z) + 1.0);
    this.shake *= Math.exp(-6 * dt);
    this.apply(t, cfg);
  }

  private apply(t: CameraTarget, cfg: ChaseConfig): void {
    const sx = Math.sin(this.time * 37.1) * this.shake * 0.3;
    const sy = Math.sin(this.time * 53.7) * this.shake * 0.3;
    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    this.camera.lookAt(t.x + fx * cfg.lookAhead, t.y + 1.0, t.z + fz * cfg.lookAhead);
    const fov = lerp(cfg.fovMin, cfg.fovMax, smoothstep(5, 50, t.speed));
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
