import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { geometryProblems } from '../../../src/core/track/checkGeometry';
import { plagesPonts, SolPiste, HAUTEUR_PONT } from '../../../src/core/track/ponts';
import { prepareLevel } from '../../../src/game/prepare';
import { RaceSim } from '../../../src/core/race/race';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import { projectOnTrack } from '../../../src/core/track/projection';
import { quantifier } from '../../../src/core/replay/replay';
import { buildCollisionWorld, resolveCollisions } from '../../../src/core/physics/collision';
import { createCarState } from '../../../src/core/physics/car';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { pontLevel, straightLevel, hairpinLevel, makeLevel } from '../../fixtures/levels';
import { SolAffiche } from '../../../src/game/pose';
import type { Level } from '../../../src/core/level/types';

/** Pilote automatique (sans frein à main) : hauteur de la voiture à chaque passage en (0, 0), chocs et replacements. */
function rouler(level: Level): { sim: RaceSim; passages: number[]; incidents: number } {
  const r = prepareLevel('perso:pont', level);
  if (!r.ok) throw new Error(r.erreurs.join());
  const n = r.prepared;
  const sim = new RaceSim({ level: n.level, track: n.track, terrain: n.terrain, env: n.env, car: CARS.equilibree, assists: MODES.arcade, countdown: 0 });
  const passages: number[] = [];
  let dedans = false, incidents = 0;
  for (let k = 0; k < 120 * 120 && sim.phase !== 'arrivee'; k++) {
    const c = sim.car;
    const pr = projectOnTrack(n.track, c.x, c.z, sim.progressIndex);
    const cible = n.track.samples[Math.min(n.track.samples.length - 1, pr.index + 12)];
    let d = Math.atan2(cible.x - c.x, cible.z - c.z) - c.heading;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const ev = sim.step(quantifier({ gaz: c.speed > 15 ? 0 : 1, frein: 0, direction: Math.max(-1, Math.min(1, d * 3)), freinAMain: false }));
    incidents += ev.filter((e) => e.type === 'choc' || e.type === 'replace').length;
    const pres = Math.hypot(sim.car.x, sim.car.z) < 2;
    if (pres && !dedans) passages.push(sim.car.y);
    dedans = pres;
  }
  return { sim, passages, incidents };
}

describe('croisements et ponts', () => {
  it('12 m au-dessus : un pont sur la portion du dessus, aucun problème', () => {
    const track = buildTrack(pontLevel(12));
    const P = plagesPonts(track.pont ?? null);
    expect(P).toHaveLength(1);
    const S = track.samples;
    // le pont est sur la fin de la route (le retour vers -x), autour du croisement en (0, 0)
    expect(S[P[0].de].x).toBeGreaterThan(10);
    expect(S[P[0].a].x).toBeLessThan(-10);
    for (let i = P[0].de; i <= P[0].a; i++) expect(S[i].y).toBeGreaterThan(8);
    expect(geometryProblems(track)).toEqual([]);
  });
  it('moins de 7 m d\'écart : croisement refusé avec un message clair', () => {
    for (const dy of [0, 4, 6]) {
      const pb = geometryProblems(buildTrack(pontLevel(dy)));
      expect(pb.length).toBeGreaterThan(0);
      expect(pb[0].type).toBe('croisement');
      expect(pb[0].message).toContain(`au moins ${HAUTEUR_PONT} m`);
    }
  });
  it('sans croisement, pas de pont (niveaux officiels compris)', () => {
    expect(buildTrack(straightLevel(300)).pont).toBeNull();
    expect(buildTrack(hairpinLevel()).pont).toBeNull();
    for (const n of NIVEAUX_OFFICIELS) {
      const r = prepareLevel(`off:${n.id}`, n.data);
      if (!r.ok) throw new Error(r.erreurs.join());
      expect(r.prepared.track.pont ?? null, n.id).toBeNull();
    }
  });
  it('sol : le tablier sur la portion du dessus, la route du dessous sous le pont', () => {
    const r = prepareLevel('perso:pont', pontLevel(12));
    if (!r.ok) throw new Error(r.erreurs.join());
    const { track, terrain } = r.prepared;
    const sol = new SolPiste(terrain, track);
    const S = track.samples;
    const proche = (de: number, a: number) => {
      let best = de;
      for (let i = de; i < a; i++) if (Math.hypot(S[i].x, S[i].z) < Math.hypot(S[best].x, S[best].z)) best = i;
      return best;
    };
    const bas = proche(0, S.length >> 1), haut = proche(S.length >> 1, S.length);
    expect(haut - bas).toBeGreaterThan(300);
    sol.indice = bas;
    expect(Math.abs(sol.heightAt(0, 0) - S[bas].y)).toBeLessThan(0.5);
    sol.indice = haut;
    expect(Math.abs(sol.heightAt(0, 0) - S[haut].y)).toBeLessThan(0.1);
    // le terrain lui-même suit la route du dessous
    expect(Math.abs(terrain.heightAt(0, 0) - S[bas].y)).toBeLessThan(0.5);
  });
  it('en course : la voiture passe sous le pont puis dessus, et arrive', () => {
    const { sim, passages, incidents } = rouler(pontLevel(12));
    expect(sim.phase).toBe('arrivee');
    expect(passages).toHaveLength(2);
    expect(passages[0]).toBeLessThan(1); // dessous
    expect(passages[1]).toBeGreaterThan(10); // dessus
    expect(incidents).toBe(0); // ni choc contre un pilier ou un garde-corps, ni chute
  });
  it('un objet posé sur la route du dessous ne gêne pas la voiture sur le pont', () => {
    const l = pontLevel(12);
    l.objets.push({ type: 'pneus', x: 7, z: 2, rot: 0 });
    const r = prepareLevel('perso:pont-objet', l);
    if (!r.ok) throw new Error(r.erreurs.join());
    const c = r.prepared.env.circles.find((o) => Math.hypot(o.x - 7, o.z - 2) < 0.1);
    expect(c?.hauteur).toBeDefined();
    expect(c!.hauteur![1]).toBeLessThan(5);
    const { sim, passages } = rouler(l);
    expect(sim.phase).toBe('arrivee');
    expect(passages[1]).toBeGreaterThan(10);
  });
  it('départ sur un pont : la voiture attend sur le tablier', () => {
    const l = makeLevel([[-15, 0, 12, 10], [50, 0, 12, 10], [110, 20, 11, 10], [120, 100, 8, 10], [60, 150, 5, 10], [0, 100, 2, 10], [0, 0, 0, 10], [0, -100, 0, 10]]);
    const r = prepareLevel('perso:pont-depart', l);
    if (!r.ok) throw new Error(r.erreurs.join());
    expect(r.prepared.track.pont?.[6]).toBe(1);
    const n = r.prepared;
    const sim = new RaceSim({ level: n.level, track: n.track, terrain: n.terrain, env: n.env, car: CARS.equilibree, assists: MODES.arcade });
    expect(sim.car.y).toBeGreaterThan(11);
  });
  it('arrivée sur un pont : plus de tablier au-delà de son bout', () => {
    const l = makeLevel([[0, -100, 0, 10], [0, 0, 0, 10], [0, 100, 2, 10], [60, 150, 5, 10], [120, 100, 8, 10], [110, 20, 11, 10], [50, 0, 12, 10], [-15, 0, 12, 10]]);
    const r = prepareLevel('perso:pont-arrivee', l);
    if (!r.ok) throw new Error(r.erreurs.join());
    const { track, terrain } = r.prepared;
    const S = track.samples, f = S[S.length - 1];
    expect(track.pont?.[S.length - 1]).toBe(1);
    const sol = new SolPiste(terrain, track);
    sol.indice = S.length - 1;
    expect(sol.heightAt(f.x, f.z)).toBeCloseTo(f.y, 1);
    const x = f.x + f.tx * 20, z = f.z + f.tz * 20;
    expect(sol.heightAt(x, z)).toBe(terrain.heightAt(x, z));
  });
  it('affichage : le tablier ou le terrain, le plus proche de la voiture', () => {
    const r = prepareLevel('perso:pont', pontLevel(12));
    if (!r.ok) throw new Error(r.erreurs.join());
    const { track, terrain } = r.prepared;
    const sol = new SolAffiche(terrain, track);
    const S = track.samples;
    let haut = S.length >> 1;
    for (let i = haut; i < S.length; i++) if (Math.hypot(S[i].x, S[i].z) < Math.hypot(S[haut].x, S[haut].z)) haut = i;
    const sp = S[haut];
    sol.ref = 12;
    expect(sol.heightAt(0, 0)).toBeGreaterThan(11);
    // au bord du tablier
    expect(sol.heightAt(sp.x + sp.nx * (sp.w + 0.5), sp.z + sp.nz * (sp.w + 0.5))).toBeGreaterThan(11);
    sol.ref = 0;
    expect(sol.heightAt(0, 0)).toBe(terrain.heightAt(0, 0));
  });
  it('collisions : un obstacle à une autre hauteur est ignoré', () => {
    const world = buildCollisionWorld({ circles: [{ x: 0, z: 0, r: 1, hauteur: [10, 12] }], segments: [{ ax: -5, az: 2, bx: 5, bz: 2, hauteur: [10, 12] }] });
    const car = createCarState(0, 0, 0);
    car.vz = 5;
    expect(resolveCollisions(car, CARS.equilibree, world)).toBe(0);
    car.y = 11;
    expect(resolveCollisions(car, CARS.equilibree, world)).toBeGreaterThan(0);
  });
});
