import * as THREE from 'three';
import { mulberry32 } from '../core/math/rng';

/** Volume de flocons autour de la caméra (m). */
export const NEIGE_LARGEUR = 56;
export const NEIGE_HAUTEUR = 26;

/** `v` ramené dans [0, m[ (valide aussi pour les valeurs négatives). */
const modulo = (v: number, m: number): number => ((v % m) + m) % m;

/**
 * Position d'un flocon à l'instant `t` : il tombe à `vitesse` m/s en se balançant, et le volume suit la caméra
 * (un flocon qui sort d'un côté réapparaît de l'autre). Fonction pure, sans état par flocon.
 */
export function positionFlocon(
  bx: number, by: number, bz: number, vitesse: number, phase: number, t: number,
  cx: number, cy: number, cz: number, out: { x: number; y: number; z: number },
): void {
  const L = NEIGE_LARGEUR, H = NEIGE_HAUTEUR;
  const sway = Math.sin(t * 0.9 + phase) * 0.6;
  out.x = cx + modulo(bx + sway - cx + L / 2, L) - L / 2;
  out.z = cz + modulo(bz + Math.cos(t * 0.7 + phase) * 0.5 - cz + L / 2, L) - L / 2;
  out.y = cy + modulo(by - vitesse * t, H) - H * 0.35;
}

/** Chute de neige : un seul `Points` (une draw call), quelques centaines de flocons. */
export class Snowfall {
  readonly points: THREE.Points;
  private readonly base: Float32Array;
  private readonly vitesse: Float32Array;
  private readonly phase: Float32Array;
  private readonly pos: Float32Array;
  private readonly tex: THREE.CanvasTexture;
  private t = 0;
  private readonly tmp = { x: 0, y: 0, z: 0 };

  constructor(readonly count: number, seed = 5) {
    const rng = mulberry32(seed);
    this.base = new Float32Array(count * 3);
    this.vitesse = new Float32Array(count);
    this.phase = new Float32Array(count);
    this.pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      this.base[i * 3] = rng() * NEIGE_LARGEUR;
      this.base[i * 3 + 1] = rng() * NEIGE_HAUTEUR;
      this.base[i * 3 + 2] = rng() * NEIGE_LARGEUR;
      this.vitesse[i] = 1.6 + rng() * 1.6;
      this.phase[i] = rng() * Math.PI * 2;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(16, 16, 14, 0, Math.PI * 2); ctx.fill();
    }
    this.tex = new THREE.CanvasTexture(canvas);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, map: this.tex, alphaTest: 0.5, sizeAttenuation: true, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.name = 'neige';
  }

  update(dt: number, camera: THREE.Vector3): void {
    this.t += dt;
    const o = this.tmp;
    for (let i = 0; i < this.count; i++) {
      positionFlocon(this.base[i * 3], this.base[i * 3 + 1], this.base[i * 3 + 2], this.vitesse[i], this.phase[i], this.t, camera.x, camera.y, camera.z, o);
      this.pos[i * 3] = o.x; this.pos[i * 3 + 1] = o.y; this.pos[i * 3 + 2] = o.z;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
    this.tex.dispose();
  }
}
