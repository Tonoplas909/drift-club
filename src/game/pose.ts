import type { CarState } from '../core/physics/types';
import type { Ground } from '../core/track/terrain';
import { clamp, lerp, wrapAngle } from '../core/math/vec';
import type { CarPose } from '../render/carView';

/** Pose affichée entre deux états simulés (alpha ∈ [0, 1]). */
export function interpolatePose(prev: CarState, cur: CarState, alpha: number, ground: Ground): CarPose {
  const x = lerp(prev.x, cur.x, alpha);
  const y = lerp(prev.y, cur.y, alpha);
  const z = lerp(prev.z, cur.z, alpha);
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
  };
}
