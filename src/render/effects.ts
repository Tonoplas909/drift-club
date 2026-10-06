import * as THREE from 'three';
import { mulberry32, type Rng } from '../core/math/rng';
import { toonMaterial } from './materials';
import type { FumeeStyle } from '../core/fumees';

export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; age: number; life: number; size: number }

/** Réglages d'une réserve de particules (défaut : bouffées de fumée). */
export interface OptionsParticules {
  /** durée de vie (s) : [min, max] */
  vie?: [number, number];
  /** taille de départ : [min, max] */
  taille?: [number, number];
  /** dispersion horizontale de la vitesse (m/s) */
  dispersion?: number;
  /** vitesse verticale de départ : [min, max] */
  montee?: [number, number];
  /** part de la vitesse de la voiture reprise par la particule */
  inertie?: number;
  /** accélération verticale (m/s²), positive = monte */
  poussee?: number;
}

/** Réserve circulaire de particules (logique pure, sans three.js). */
export class ParticlePool {
  readonly items: Particle[];
  private next = 0;
  private readonly rng: Rng;
  private readonly o: Required<OptionsParticules>;

  constructor(readonly capacity: number, seed = 1, opts: OptionsParticules = {}) {
    this.items = Array.from({ length: capacity }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 1, life: 1, size: 1 }));
    this.rng = mulberry32(seed);
    this.o = { vie: [0.9, 1.4], taille: [0.7, 1.2], dispersion: 1.2, montee: [0.6, 1.4], inertie: 0.3, poussee: 0.4, ...opts };
  }

  /** Émet une particule ; renvoie son index dans `items` (pour lui associer une couleur). */
  emit(x: number, y: number, z: number, vx: number, vz: number): number {
    const i = this.next, p = this.items[i];
    this.next = (this.next + 1) % this.capacity;
    const r = this.rng, o = this.o;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx * o.inertie + (r() - 0.5) * o.dispersion;
    p.vy = o.montee[0] + r() * (o.montee[1] - o.montee[0]);
    p.vz = vz * o.inertie + (r() - 0.5) * o.dispersion;
    p.age = 0;
    p.life = o.vie[0] + r() * (o.vie[1] - o.vie[0]);
    p.size = o.taille[0] + r() * (o.taille[1] - o.taille[0]);
    return i;
  }

  update(dt: number): void {
    const damp = Math.exp(-2.5 * dt), poussee = this.o.poussee;
    for (const p of this.items) {
      if (p.age >= p.life) continue;
      p.age += dt;
      p.vx *= damp; p.vz *= damp;
      p.vy += poussee * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
  }

  alive(): number {
    return this.items.filter((p) => p.age < p.life).length;
  }

  /** Taille affichée : grossit puis se résorbe (bouffées toon opaques, sans transparence). */
  static scaleOf(p: Particle): number {
    if (p.age >= p.life) return 0;
    const t = p.age / p.life;
    return p.size * (0.6 + 2.2 * t) * Math.pow(Math.sin(Math.PI * t), 0.6);
  }
}

/** Couleur (rgb linéaire, 0..1) d'une table de couleurs `rgb` (3 valeurs par couleur) à la position `t` ∈ [0, 1] : fondu entre couleurs voisines. Écrit dans `out`, sans allouer. */
export function couleurDegrade(rgb: Float32Array, t: number, out: Float32Array, o: number): void {
  const n = rgb.length / 3;
  if (n === 1) { out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2]; return; }
  const x = Math.min(1, Math.max(0, t)) * (n - 1), i = Math.min(n - 2, Math.floor(x)), f = x - i, a = i * 3, b = a + 3;
  out[o] = rgb[a] + (rgb[b] - rgb[a]) * f;
  out[o + 1] = rgb[a + 1] + (rgb[b + 1] - rgb[a + 1]) * f;
  out[o + 2] = rgb[a + 2] + (rgb[b + 2] - rgb[a + 2]) * f;
}

const tableRgb = (hex: string[]): Float32Array => {
  const c = new THREE.Color(), out = new Float32Array(hex.length * 3);
  hex.forEach((h, i) => { c.set(h); out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b; });
  return out;
};

/**
 * Fumée des pneus : bouffées instanciées (une seule matrice et une couleur par instance, aucune allocation par image).
 * Le style (`FumeeStyle`) donne la couleur le long de la vie, l'arc-en-ciel animé, la lueur (mélange additif) et les paillettes.
 * Sans style (ou « classique »), les bouffées prennent la couleur de fumée du décor, comme avant.
 */
export class SmokeSystem {
  readonly mesh: THREE.InstancedMesh;
  /** étincelles (invisibles et vides sans paillettes) */
  readonly sparks: THREE.InstancedMesh;
  private readonly pool: ParticlePool;
  private readonly poolEtincelles: ParticlePool;
  private readonly acc: number[] = [];
  private accEtincelles = 0;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly matOpaque: THREE.MeshToonMaterial;
  private readonly matLueur: THREE.MeshBasicMaterial;
  private readonly matEtincelle: THREE.MeshBasicMaterial;
  private readonly couleurs: Float32Array;
  private readonly couleursEtincelles: Float32Array;
  private readonly tmp = new THREE.Color();
  private temps = 0;
  private style: FumeeStyle | null = null;
  private rgb: Float32Array = new Float32Array(3);
  private rgbEtincelles: Float32Array = new Float32Array(3);
  private teinteDecor = new THREE.Color();

  /** `particules` : durée de vie et taille des bouffées (défaut : celles de la course ; le Garage en veut de petites) */
  constructor(capacity: number, color: THREE.ColorRepresentation, style: FumeeStyle | null = null, etincellesMax = 0, particules: OptionsParticules = {}) {
    this.pool = new ParticlePool(capacity, 11, particules);
    this.poolEtincelles = new ParticlePool(Math.max(1, etincellesMax), 23, { vie: [0.45, 1], taille: [0.1, 0.2], dispersion: 2.6, montee: [0.5, 1.8], inertie: 0.45, poussee: -0.3 });
    this.matOpaque = toonMaterial({ color });
    this.matLueur = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.matEtincelle = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false });
    this.teinteDecor.set(color);
    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), this.matOpaque, capacity);
    this.couleurs = new Float32Array(capacity * 3).fill(1);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(this.couleurs, 3);
    this.mesh.frustumCulled = false;
    this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.5, 0), this.matEtincelle, Math.max(1, etincellesMax));
    this.couleursEtincelles = new Float32Array(Math.max(1, etincellesMax) * 3).fill(1);
    this.sparks.instanceColor = new THREE.InstancedBufferAttribute(this.couleursEtincelles, 3);
    this.sparks.frustumCulled = false;
    this.sparks.visible = false;
    this.setStyle(style);
    this.update(0);
  }

  /** Change de fumée : les bouffées en vol gardent leur place et prennent la nouvelle couleur. */
  setStyle(style: FumeeStyle | null): void {
    const st = style && (style.couleurs.length > 0 || style.arcEnCiel) ? style : null;
    this.style = st;
    this.mesh.material = st?.lueur ? this.matLueur : this.matOpaque;
    this.matOpaque.color.copy(st ? this.tmp.setRGB(1, 1, 1) : this.teinteDecor);
    if (!st) { this.couleurs.fill(1); this.mesh.instanceColor!.needsUpdate = true; }
    this.rgb = tableRgb(st && st.couleurs.length > 0 ? st.couleurs : ['#ffffff']);
    const pa = st?.paillettes;
    this.rgbEtincelles = tableRgb(pa ? pa.couleurs : ['#ffffff']);
    this.sparks.visible = !!pa && this.poolEtincelles.capacity > 1;
  }

  /** Couleur de fumée du décor (utilisée par la fumée « classique » ; ignorée par les autres). */
  setCouleurDecor(color: THREE.ColorRepresentation): void {
    this.teinteDecor.set(color);
    if (!this.style) this.matOpaque.color.copy(this.teinteDecor);
  }

  /** Émet `rate` bouffées par seconde et par point. */
  emit(points: THREE.Vector3[], rate: number, dt: number, vx: number, vz: number): void {
    const dens = this.sparks.visible ? this.style?.paillettes?.densite ?? 0 : 0;
    points.forEach((pt, k) => {
      this.acc[k] = (this.acc[k] ?? 0) + rate * dt;
      while (this.acc[k] >= 1) {
        this.pool.emit(pt.x, pt.y + 0.2, pt.z, vx, vz);
        this.acc[k] -= 1;
        this.accEtincelles += dens;
        while (this.accEtincelles >= 1) {
          this.poolEtincelles.emit(pt.x, pt.y + 0.25, pt.z, vx, vz);
          this.accEtincelles -= 1;
        }
      }
    });
  }

  update(dt: number): void {
    this.temps += dt;
    this.pool.update(dt);
    const st = this.style, items = this.pool.items, n = items.length, c = this.couleurs, lueur = !!st?.lueur;
    const arc = st?.arcEnCiel, alterne = st?.mode === 'alterne', nb = this.rgb.length / 3;
    for (let i = 0; i < n; i++) {
      const it = items[i], sc = ParticlePool.scaleOf(it);
      this.s.setScalar(sc);
      this.p.set(it.x, it.y, it.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      if (!st || it.age >= it.life) continue;
      const t = it.age / it.life;
      if (arc) {
        // la teinte avance avec le temps et avec le rang d'émission : le sillage est un ruban de couleurs
        this.tmp.setHSL((this.temps * arc.vitesse + (i / n) * 2) % 1, arc.saturation, arc.clarte, THREE.SRGBColorSpace);
        c[i * 3] = this.tmp.r; c[i * 3 + 1] = this.tmp.g; c[i * 3 + 2] = this.tmp.b;
      } else if (alterne) {
        const j = (i % nb) * 3;
        c[i * 3] = this.rgb[j]; c[i * 3 + 1] = this.rgb[j + 1]; c[i * 3 + 2] = this.rgb[j + 2];
      } else couleurDegrade(this.rgb, t, c, i * 3);
      if (lueur) {
        // mélange additif : s'éteindre = s'assombrir
        const f = Math.min(1, (1 - t) * 1.6) * 0.85;
        c[i * 3] *= f; c[i * 3 + 1] *= f; c[i * 3 + 2] *= f;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (st) this.mesh.instanceColor!.needsUpdate = true;
    if (this.sparks.visible) this.majEtincelles(dt);
  }

  private majEtincelles(dt: number): void {
    this.poolEtincelles.update(dt);
    const items = this.poolEtincelles.items, n = items.length, c = this.couleursEtincelles, nb = this.rgbEtincelles.length / 3;
    for (let i = 0; i < n; i++) {
      const it = items[i];
      const vie = it.age >= it.life ? 0 : Math.sin(Math.PI * (it.age / it.life));
      // scintillement : la taille bat vite, décalée d'une étincelle à l'autre
      this.s.setScalar(it.size * vie * (0.55 + 0.45 * Math.sin(this.temps * 38 + i * 2.3)));
      this.p.set(it.x, it.y, it.z);
      this.m.compose(this.p, this.q, this.s);
      this.sparks.setMatrixAt(i, this.m);
      const j = (i % nb) * 3;
      c[i * 3] = this.rgbEtincelles[j]; c[i * 3 + 1] = this.rgbEtincelles[j + 1]; c[i * 3 + 2] = this.rgbEtincelles[j + 2];
    }
    this.sparks.instanceMatrix.needsUpdate = true;
    this.sparks.instanceColor!.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.sparks.geometry.dispose();
    this.matOpaque.dispose();
    this.matLueur.dispose();
    this.matEtincelle.dispose();
  }
}

/** Traces de gomme : anneau de quadrilatères (logique pure). */
export class SkidTrail {
  readonly data: Float32Array;
  count = 0;
  private next = 0;
  private readonly last: ({ x: number; y: number; z: number } | null)[] = [null, null];

  constructor(readonly capacity: number, private readonly width = 0.28) {
    this.data = new Float32Array(capacity * 4 * 3);
  }

  add(wheel: number, x: number, y: number, z: number, active: boolean): number {
    if (!active) { this.last[wheel] = null; return -1; }
    const prev = this.last[wheel];
    if (!prev) { this.last[wheel] = { x, y, z }; return -1; }
    const dx = x - prev.x, dz = z - prev.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.25) return -1;
    const hx = (-dz / len) * (this.width / 2), hz = (dx / len) * (this.width / 2);
    const i = this.next;
    const o = i * 12;
    const yA = prev.y + 0.03, yB = y + 0.03;
    this.data.set([prev.x + hx, yA, prev.z + hz, prev.x - hx, yA, prev.z - hz, x + hx, yB, z + hz, x - hx, yB, z - hz], o);
    this.next = (this.next + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);
    this.last[wheel] = { x, y, z };
    return i;
  }

  reset(): void {
    this.data.fill(0);
    this.count = 0;
    this.next = 0;
    this.last[0] = null;
    this.last[1] = null;
  }
}

export class SkidMarks {
  readonly mesh: THREE.Mesh;
  private readonly trail: SkidTrail;
  private readonly attr: THREE.BufferAttribute;

  constructor(capacity: number) {
    this.trail = new SkidTrail(capacity);
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.trail.data, 3);
    this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const idx: number[] = [];
    for (let q = 0; q < capacity; q++) {
      const b = q * 4;
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x1a1a1a, transparent: true, opacity: 0.5, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide,
    }));
    this.mesh.frustumCulled = false;
  }

  add(wheel: number, p: THREE.Vector3, active: boolean): void {
    if (this.trail.add(wheel, p.x, p.y, p.z, active) >= 0) this.attr.needsUpdate = true;
  }

  reset(): void {
    this.trail.reset();
    this.attr.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
