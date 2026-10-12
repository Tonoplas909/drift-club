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
import { pontLevel, straightLevel, hairpinLevel } from '../../fixtures/levels';

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
  it('moins de 6 m d\'écart : croisement refusé avec un message clair', () => {
    for (const dy of [0, 4]) {
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
    const r = prepareLevel('perso:pont', pontLevel(12));
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
    expect(sim.phase).toBe('arrivee');
    expect(passages).toHaveLength(2);
    expect(passages[0]).toBeLessThan(1); // dessous
    expect(passages[1]).toBeGreaterThan(10); // dessus
    expect(incidents).toBe(0); // ni choc contre un pilier ou un garde-corps, ni chute
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
