import { LIMITES, type PlanEau } from '../level/types';

export type { PlanEau };

// Lac : polygone simple à `niveau` (hauteur de la surface, m). Pur : sert au terrain, au décor, à la validation et au rendu.

/** Bande (m) au-delà du bord où le terrain descend vers la rive ; le décor s'écarte du lac de cette bande. */
export const RIVE = 10;
/** Hauteur de la berge au-dessus de l'eau à la limite du polygone (m). */
export const BERGE = 0.3;
/** Pente du fond du lac depuis la rive et profondeur maximale (m). */
export const PENTE_FOND = 0.4;
export const PROFONDEUR_MAX = 5;

export class Lac {
  readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number;
  readonly niveau: number;
  private readonly px: Float64Array;
  private readonly pz: Float64Array;

  constructor(readonly plan: PlanEau) {
    this.niveau = plan.niveau;
    this.px = Float64Array.from(plan.points, (p) => p.x);
    this.pz = Float64Array.from(plan.points, (p) => p.z);
    this.minX = Math.min(...this.px); this.maxX = Math.max(...this.px);
    this.minZ = Math.min(...this.pz); this.maxZ = Math.max(...this.pz);
  }

  /** Le point est-il à moins de `marge` m de la boîte englobante ? (test rapide avant `distance`) */
  proche(x: number, z: number, marge: number): boolean {
    return x >= this.minX - marge && x <= this.maxX + marge && z >= this.minZ - marge && z <= this.maxZ + marge;
  }

  /** Distance signée au bord du polygone (m) : > 0 à l'intérieur (eau), < 0 à l'extérieur. */
  distance(x: number, z: number): number {
    const n = this.px.length;
    let dedans = false;
    let d2 = Infinity;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = this.px[j], az = this.pz[j], bx = this.px[i], bz = this.pz[i];
      if ((az > z) !== (bz > z) && x < ax + ((z - az) / (bz - az)) * (bx - ax)) dedans = !dedans;
      const ex = bx - ax, ez = bz - az;
      const l2 = ex * ex + ez * ez;
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
      const dx = x - (ax + t * ex), dz = z - (az + t * ez);
      const q = dx * dx + dz * dz;
      if (q < d2) d2 = q;
    }
    const d = Math.sqrt(d2);
    return dedans ? d : -d;
  }

  /** Hauteur du terrain modifiée par le lac : le fond descend sous la surface, la rive se raccorde en pente douce. */
  hauteur(x: number, z: number, terre: number): number {
    if (!this.proche(x, z, RIVE)) return terre;
    const sd = this.distance(x, z);
    if (sd <= -RIVE) return terre;
    const rive = this.niveau + BERGE;
    if (sd <= 0) {
      const t = (sd + RIVE) / RIVE;
      const w = t * t * (3 - 2 * t);
      return terre + (rive - terre) * w;
    }
    return rive - Math.min(PROFONDEUR_MAX + BERGE, PENTE_FOND * sd);
  }
}

/** La route doit rester au sec : erreurs (en français) pour chaque lac trop près d'un point de la route. */
export function problemesEau(eau: readonly PlanEau[] | undefined, samples: readonly { x: number; z: number; w: number; s: number }[]): string[] {
  const out: string[] = [];
  (eau ?? []).forEach((plan, i) => {
    const lac = new Lac(plan);
    for (const sp of samples) {
      const marge = sp.w + LIMITES.eauMarge;
      if (!lac.proche(sp.x, sp.z, marge)) continue;
      if (lac.distance(sp.x, sp.z) > -marge) {
        out.push(`eau : le lac ${i + 1} touche la route vers ${Math.round(sp.s)} m (garde ${LIMITES.eauMarge} m au moins entre le bord de la route et l'eau).`);
        break;
      }
    }
  });
  return out;
}

/** Aire du polygone (m², toujours positive). */
export function aire(points: readonly { x: number; z: number }[]): number {
  let a = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) a += points[j].x * points[i].z - points[i].x * points[j].z;
  return Math.abs(a) / 2;
}

/** Le polygone s'auto-intersecte-t-il ? (côtés non adjacents qui se coupent) */
export function autoIntersection(points: readonly { x: number; z: number }[]): boolean {
  const n = points.length;
  const cross = (o: { x: number; z: number }, a: { x: number; z: number }, b: { x: number; z: number }): number =>
    (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  for (let i = 0; i < n; i++) {
    const a = points[i], b = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const c = points[j], d = points[(j + 1) % n];
      if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return true;
    }
  }
  return false;
}
