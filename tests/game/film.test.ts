import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS } from '../../src/levels';
import { prepareLevel } from '../../src/game/prepare';
import { conduire } from '../fixtures/pilote';
import { tournerFilm, postesBordDeRoute, planBordDeRoute, planHelico } from '../../src/game/film';
import { SIM_DT } from '../../src/core/constants';

function niveau(id: string) {
  const r = prepareLevel(`off:${id}`, NIVEAUX_OFFICIELS.find((n) => n.id === id)!.data);
  if (!r.ok) throw new Error(r.erreurs.join());
  return r.prepared;
}

describe('revoir sa course', () => {
  const n = niveau('premiers-virages');
  const { replay, result } = conduire(n, 'legere', 'semi');

  it('le film rejoue la course jusqu\'à l\'arrivée, avec le même score, puis la roue libre', () => {
    const film = tournerFilm(n, 'legere', 'semi', replay)!;
    expect(film).not.toBeNull();
    expect(result).not.toBeNull();
    const arrivee = film.images.findIndex((i) => i.hud.phase === 'arrivee');
    expect(arrivee).toBeGreaterThan(0);
    expect(film.images[arrivee].hud.score).toBe(result!.score);
    // 2,5 s après la ligne
    expect((film.images.length - 1 - arrivee) * SIM_DT).toBeCloseTo(2.5, 1);
    // départ peu avant la fin du décompte
    expect(film.images[0].hud.phase).toBe('compte');
    expect(film.duree).toBeLessThan(result!.time + 4);
  });
  it('replay d\'une autre voiture : la course ne va plus à l\'arrivée au même score, ou pas du tout', () => {
    const film = tournerFilm(n, 'muscle', 'exigeant', replay);
    if (film) expect(film.images.find((i) => i.hud.phase === 'arrivee')?.hud.score).not.toBe(result!.score);
  });
  it('caméras : postes au bord de la route, zoom, hélicoptère au-dessus', () => {
    const postes = postesBordDeRoute(n.track, (x, z) => n.terrain.heightAt(x, z));
    expect(postes.length).toBeGreaterThan(5);
    for (const p of postes) {
      const sp = n.track.samples[Math.round(p.s)];
      expect(Math.hypot(p.pos[0] - sp.x, p.pos[2] - sp.z)).toBeGreaterThan(sp.w + 5);
    }
    const sp = n.track.samples[200];
    const plan = planBordDeRoute(postes, sp, sp.s)!;
    expect(plan.fov).toBeGreaterThanOrEqual(14);
    expect(plan.fov).toBeLessThanOrEqual(60);
    expect(plan.cible[0]).toBe(sp.x);
    const h = planHelico({ x: 0, y: 0, z: 0 }, 0, 0);
    expect(h.pos[1]).toBeGreaterThan(20);
  });
});
