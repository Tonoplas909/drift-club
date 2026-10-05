import { RaceSim, type RaceResult } from '../../src/core/race/race';
import { CARS } from '../../src/core/physics/cars';
import { MODES } from '../../src/core/physics/assists';
import { projectOnTrack } from '../../src/core/track/projection';
import { Enregistreur, quantifier } from '../../src/core/replay/replay';
import type { CarId, ModeId } from '../../src/core/physics/types';
import type { NiveauPrepare } from '../../src/core/replay/verifier';

/**
 * Pilote automatique qui enregistre sa course exactement comme GameSession (commandes quantifiées, replay
 * jusqu'au pas de l'arrivée). Direction analogique + coups de frein à main : de vrais drifts, donc des points.
 */
export function conduire(n: NiveauPrepare, voiture: CarId = 'equilibree', mode: ModeId = 'arcade', maxSecondes = 300): { replay: Uint8Array; result: RaceResult | null; sim: RaceSim } {
  const sim = new RaceSim({ level: n.level, track: n.track, terrain: n.terrain, env: n.env, car: CARS[voiture], assists: MODES[mode] });
  const rec = new Enregistreur();
  for (let k = 0; k < maxSecondes * 120 && sim.phase !== 'arrivee'; k++) {
    const c = sim.car;
    const pr = projectOnTrack(n.track, c.x, c.z, sim.progressIndex);
    const cible = n.track.samples[Math.min(n.track.samples.length - 1, pr.index + 12)];
    let d = Math.atan2(cible.x - c.x, cible.z - c.z) - c.heading;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const trop = c.speed > 17;
    const input = quantifier({ gaz: trop ? 0 : 1, frein: trop ? 0.3 : 0, direction: Math.max(-1, Math.min(1, d * 3)), freinAMain: Math.abs(d) > 0.35 && c.speed > 12 });
    const replacer = k === 1500; // un replacement manuel en route
    rec.ajouter(input, replacer);
    sim.step(input, replacer);
  }
  return { replay: rec.octetsReplay(), result: sim.result, sim };
}
