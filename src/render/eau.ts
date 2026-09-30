import * as THREE from 'three';
import type { PlanEau } from '../core/level/types';
import { mulberry32 } from '../core/math/rng';
import { toonMaterial } from './materials';
import type { Palette } from './palettes';
import type { QualityLevel } from './quality';

/** Taille (m) d'un motif de scintillement. */
const MOTIF = 26;

/**
 * Lacs : une surface plane translucide par lac (aplat toon teinté par la palette) posée à la hauteur `niveau`.
 * Le fond du terrain (plage claire, fond sombre) est coloré dans `terrainMesh.ts` et se voit à travers l'eau.
 * Haute qualité : un second plan, presque transparent, avec des éclats blancs qui dérivent doucement.
 */
export class Eau {
  readonly group = new THREE.Group();
  private readonly tex: THREE.CanvasTexture | null = null;
  private readonly owned: { dispose(): void }[] = [];
  private t = 0;

  constructor(plans: readonly PlanEau[], p: Palette, quality: QualityLevel) {
    this.group.name = 'eau';
    const bleu = new THREE.Color(p.eau ?? 0x4fa9e0).lerp(new THREE.Color(p.hemiSky), 0.22).lerp(new THREE.Color(p.fog), 0.1);
    const mat = toonMaterial({ color: bleu });
    mat.transparent = true;
    mat.opacity = 0.76;
    mat.depthWrite = false;
    this.owned.push(mat);
    let eclats: THREE.MeshBasicMaterial | null = null;
    if (quality === 'haute') {
      this.tex = eclatsTexture();
      eclats = new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, opacity: 0.55, depthWrite: false });
      this.owned.push(eclats, this.tex);
    }
    for (const plan of plans) {
      const geo = surface(plan);
      if (!geo) continue;
      this.owned.push(geo);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = plan.niveau;
      m.renderOrder = 2;
      this.group.add(m);
      if (eclats) {
        const s = new THREE.Mesh(geo, eclats);
        s.position.y = plan.niveau + 0.03;
        s.renderOrder = 3;
        this.group.add(s);
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
    if (this.tex) this.tex.offset.set((this.t * 0.012) % 1, (this.t * 0.007) % 1);
  }

  dispose(): void {
    for (const o of this.owned) o.dispose();
  }
}

/** Surface horizontale du polygone (triangulée par THREE) à y = 0 ; null si le contour est dégénéré. */
function surface(plan: PlanEau): THREE.BufferGeometry | null {
  // shape (x, y) → monde (x, 0, −y) après rotateX(−π/2) : y = −z
  const shape = new THREE.Shape(plan.points.map((q) => new THREE.Vector2(q.x, -q.z)));
  const geo = new THREE.ShapeGeometry(shape);
  if (geo.getIndex()?.count === 0) { geo.dispose(); return null; }
  geo.rotateX(-Math.PI / 2);
  // uv en mètres → motifs de `MOTIF` m
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / MOTIF, uv.getY(i) / MOTIF);
  return geo;
}

/** Petits éclats blancs (tirets horizontaux) sur fond transparent, répétés. */
function eclatsTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const rng = mulberry32(41);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 26; i++) {
      const w = 6 + rng() * 12;
      ctx.globalAlpha = 0.35 + rng() * 0.5;
      ctx.fillRect(Math.floor(rng() * 120), Math.floor(rng() * 126), w, 2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
