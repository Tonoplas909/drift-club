import type { CarState } from '../core/physics/types';
import type { Ground } from '../core/track/terrain';
import { clamp, lerp, wrapAngle } from '../core/math/vec';
import type { CarPose } from '../render/carView';
import type { TrackData } from '../core/track/buildTrack';

/**
 * Sol vu par l'affichage (inclinaison de la voiture, fantôme, film) : avec des ponts, le tablier ou le terrain du
 * dessous, celui qui est le plus près de `ref` (la hauteur de la voiture). Sans pont, exactement le terrain.
 */
export class SolAffiche implements Ground {
  ref = 0;
  private readonly scratch: number[] = [];

  constructor(private readonly terrain: Ground, private readonly track: TrackData) {}

  /** Hauteur du tablier en (x, z), ou null s'il n'y a pas de pont là. */
  tablier(x: number, z: number): number | null {
    const pont = this.track.pont;
    if (!pont) return null;
    const S = this.track.samples;
    let best: number | null = null, bestD = Infinity;
    for (const i of this.track.grid.query(x, z, 13, this.scratch)) {
      if (!pont[i]) continue;
      const sp = S[i], dx = x - sp.x, dz = z - sp.z;
      const along = dx * sp.tx + dz * sp.tz;
      if (Math.abs(along) > 0.75 || Math.abs(dx * sp.nx + dz * sp.nz) > sp.w + 1.5) continue;
      const y = sp.y + sp.grade * along;
      if (Math.abs(y - this.ref) < bestD) { bestD = Math.abs(y - this.ref); best = y; }
    }
    return best;
  }

  heightAt(x: number, z: number): number {
    const t = this.terrain.heightAt(x, z);
    const p = this.tablier(x, z);
    return p !== null && Math.abs(p - this.ref) < Math.abs(t - this.ref) ? p : t;
  }

  gradientAt(x: number, z: number): { gx: number; gz: number } {
    if (!this.track.pont) return this.terrain.gradientAt(x, z);
    const e = 0.5;
    return {
      gx: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      gz: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    };
  }
}

/** Pose affichée entre deux états simulés (alpha ∈ [0, 1]). */
export function interpolatePose(prev: CarState, cur: CarState, alpha: number, ground: Ground): CarPose {
  const x = lerp(prev.x, cur.x, alpha);
  const y = lerp(prev.y, cur.y, alpha);
  const z = lerp(prev.z, cur.z, alpha);
  if (ground instanceof SolAffiche) ground.ref = y;
  const heading = wrapAngle(prev.heading + wrapAngle(cur.heading - prev.heading) * alpha);
  const wheelSpin = prev.wheelSpin + wrapAngle(cur.wheelSpin - prev.wheelSpin) * alpha;
  const fx = Math.sin(heading), fz = Math.cos(heading);
  const lx = Math.cos(heading), lz = -Math.sin(heading);
  const hf = ground.heightAt(x + fx * 1.4, z + fz * 1.4), hb = ground.heightAt(x - fx * 1.4, z - fz * 1.4);
  const hl = ground.heightAt(x + lx * 0.8, z + lz * 0.8), hr = ground.heightAt(x - lx * 0.8, z - lz * 0.8);
  return {
    x, y, z, heading,
    steer: lerp(prev.steer, cur.steer, alpha),
    wheelSpin,
    groundPitch: Math.atan2(hf - hb, 2.8),
    groundRoll: Math.atan2(hl - hr, 1.6),
    pitch: clamp(cur.ax * 0.006, -0.05, 0.05),
    roll: clamp(cur.yawRate * cur.speed * 0.004, -0.08, 0.08),
    // inclinaison des motos (absente des images enregistrées avant elles : 0)
    lean: lerp(prev.lean ?? 0, cur.lean ?? 0, alpha),
  };
}
