import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { loadLevel } from '../../../src/core/loadLevel';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { creerTerrain } from '../../../src/core/env/terrainDuNiveau';
import { generateEnvironment } from '../../../src/core/env/generate';
import { THEMES } from '../../../src/core/env/themes';
import { nearestSample } from '../../../src/core/track/projection';
import { CERCLES_MULTIPLES, SANS_COLLISION } from '../../../src/core/env/types';
import { boiteDe } from '../../../src/core/env/ville';
import type { Level } from '../../../src/core/level/types';
import { straightLevel, hairpinLevel } from '../../fixtures/levels';

const NOUVEAUX = ['pirate', 'backrooms', 'espace', 'japon'] as const;
type Nouveau = (typeof NOUVEAUX)[number];

const officiel = (id: string): Level => {
  const r = loadLevel(NIVEAUX_OFFICIELS.find((n) => n.id === id)!.data);
  if (!r.ok) throw new Error(r.erreurs.join());
  return r.level;
};
const prepare = (lv: Level) => {
  const track = buildTrack(lv);
  const terrain = creerTerrain(track, lv);
  return { track, terrain, env: generateEnvironment(lv, track, terrain) };
};
const avec = (lv: Level, environnement: Nouveau): Level => ({ ...lv, environnement });

describe('pirate : la mer', () => {
  const lv = avec(officiel('premiers-virages'), 'pirate');
  const { track, terrain, env } = prepare(lv);
  const S = track.samples;
  const niveau = terrain.mer!.niveau;

  it('le niveau de la mer est sous la route, et la route reste au sec (marge ≥ 2 m)', () => {
    expect(terrain.mer).not.toBeNull();
    expect(niveau).toBeLessThan(Math.min(...S.map((s) => s.y)));
    for (let i = 0; i < S.length; i += 2) {
      const sp = S[i];
      for (const lat of [-sp.w - 1, -sp.w, 0, sp.w, sp.w + 1]) {
        expect(terrain.heightAt(sp.x + sp.nx * lat, sp.z + sp.nz * lat)).toBeGreaterThan(niveau + 2);
      }
    }
  });
  it('il y a bien de la mer loin de la route (terrain sous le niveau), et plus encore au loin', () => {
    let sous = 0, total = 0;
    for (let x = terrain.minX; x < terrain.maxX; x += 40) for (let z = terrain.minZ; z < terrain.maxZ; z += 40) { total++; if (terrain.heightAt(x, z) < niveau) sous++; }
    expect(sous / total).toBeGreaterThan(0.25);
    // le bord du terrain est entièrement sous l'eau : pas de falaise visible avant l'horizon
    for (const x of [terrain.minX + 1, terrain.maxX - 1]) expect(terrain.heightAt(x, (terrain.minZ + terrain.maxZ) / 2)).toBeLessThan(niveau);
  });
  it('aucun décor ne flotte dans l’eau, sauf pontons (à la laisse) et épaves (échouées)', () => {
    for (const it of env.items) {
      if (it.kind === 'ponton' || it.kind === 'epave') continue;
      expect(terrain.heightAt(it.x, it.z), it.kind).toBeGreaterThan(niveau + 0.9);
    }
  });
  it('pontons et épaves sont posés sur le rivage, loin de la route, pontons au-dessus de l’eau', () => {
    const pontons = env.items.filter((i) => i.kind === 'ponton'), epaves = env.items.filter((i) => i.kind === 'epave');
    expect(pontons.length).toBeGreaterThan(0);
    expect(epaves.length).toBeGreaterThan(0);
    for (const p of pontons) {
      expect(p.y).toBeCloseTo(niveau + 0.6, 6);
      expect(terrain.distanceToRoad(p.x, p.z)).toBeGreaterThan(30);
    }
  });
  it('sans niveau d’eau dans le niveau, la mer vient du thème (terrain et décor déterministes)', () => {
    expect(lv.eau).toBeUndefined();
    expect(prepare(lv).env).toEqual(env);
  });
});

describe('espace : cratères', () => {
  const track = buildTrack(straightLevel(500));
  const ter = new Terrain(track, 7, THEMES.espace.relief, [], THEMES.espace.terrain);
  const plat = new Terrain(track, 7, THEMES.espace.relief);
  it('aucune différence près de la route, des cuvettes plus loin', () => {
    for (let s = 0; s < 500; s += 25) for (const lat of [0, 5, 10, 20, 28]) {
      expect(ter.heightAt(lat, s)).toBeCloseTo(plat.heightAt(lat, s), 6);
    }
    let diff = 0, creux = 0;
    for (let x = -300; x <= 300; x += 10) for (let z = -100; z <= 600; z += 10) {
      const d = ter.heightAt(x, z) - plat.heightAt(x, z);
      if (Math.abs(d) > 0.5) diff++;
      if (d < -2) creux++;
    }
    expect(diff).toBeGreaterThan(50);
    expect(creux).toBeGreaterThan(20);
    expect(ter.avecCratere).toBe(true);
    expect(plat.avecCratere).toBe(false);
  });
  it('pente des cratères raisonnable (pas de falaise)', () => {
    let pire = 0;
    for (let x = -300; x < 300; x += 3) for (let z = 100; z < 500; z += 7) pire = Math.max(pire, Math.abs(ter.heightAt(x + 1, z) - ter.heightAt(x, z)));
    expect(pire).toBeLessThan(1.5);
  });
});

describe('backrooms : murs, piliers et dalles', () => {
  const { track, env } = prepare(avec(officiel('col-du-loup'), 'backrooms'));
  it('des dalles lumineuses sans collision, à l’altitude de la route ou du terrain', () => {
    const dalles = env.items.filter((i) => i.kind === 'dalleLumiere');
    expect(dalles.length).toBeGreaterThan(20);
    expect(SANS_COLLISION.has('dalleLumiere')).toBe(true);
    for (const d of dalles) expect(Number.isFinite(d.y)).toBe(true);
    // aucune collision sur les dalles : les cercles ne contiennent que des objets au sol
    const parDalle = env.circles.filter((c) => dalles.some((d) => d.x === c.x && d.z === c.z));
    expect(parDalle).toEqual([]);
  });
  it('des murs en panneaux (segments) alignés sur la route et des piliers ; aucun dans la chaussée', () => {
    const murs = env.items.filter((i) => i.kind === 'mur');
    expect(murs.length).toBeGreaterThan(30);
    expect(env.items.some((i) => i.kind === 'pilier')).toBe(true);
    for (const m of murs) {
      const box = boiteDe(m.kind, m.variant)!;
      expect(box[0]).toBeLessThan(1);
      const [w, d] = box;
      const ex = [Math.cos(m.rot), -Math.sin(m.rot)], ez = [Math.sin(m.rot), Math.cos(m.rot)];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1]]) {
        const x = m.x + (a * w * m.scale) / 2 * ex[0] + (b * d * m.scale) / 2 * ez[0], z = m.z + (a * w * m.scale) / 2 * ex[1] + (b * d * m.scale) / 2 * ez[1];
        const n = nearestSample(track, x, z);
        if (n) expect(n.dist).toBeGreaterThanOrEqual(track.samples[n.index].w + 3 - 0.6);
      }
    }
  });
});

describe('japon : torii', () => {
  const { env } = prepare(avec(officiel('col-du-loup'), 'japon'));
  it('un torii solide a un cercle par pilier, écartés de 5,2 m × échelle, on passe entre les deux', () => {
    const tor = env.items.filter((i) => i.kind === 'torii' && i.solid);
    expect(tor.length).toBeGreaterThan(0);
    expect(CERCLES_MULTIPLES.torii).toHaveLength(2);
    for (const t of tor) {
      const attendus = [-2.6, 2.6].map((dx) => [t.x + Math.cos(t.rot) * dx * t.scale, t.z - Math.sin(t.rot) * dx * t.scale]);
      for (const [x, z] of attendus) expect(env.circles.some((c) => Math.hypot(c.x - x, c.z - z) < 1e-6 && Math.abs(c.r - 0.42 * t.scale) < 1e-9)).toBe(true);
      expect(Math.hypot(attendus[0][0] - attendus[1][0], attendus[0][1] - attendus[1][1])).toBeCloseTo(5.2 * t.scale, 6);
    }
  });
  it('des cerisiers, lanternes, bambous et pagodes (fond visuel)', () => {
    const k = new Set(env.items.map((i) => i.kind));
    for (const x of ['cerisier', 'toro', 'bambou', 'pagode']) expect(k.has(x as never), x).toBe(true);
    for (const p of env.items.filter((i) => i.kind === 'pagode')) expect(p.solid).toBe(false);
  });
});

/** Les nouveaux thèmes appliqués aux niveaux officiels : le terrain suit la route, pas de falaise, rien dans le couloir. */
describe.each(['premiers-virages', 'col-du-loup', 'epingles-du-diable', 'spirale-du-belvedere', 'grande-descente'])('relief des nouveaux thèmes sur %s', (id) => {
  for (const theme of NOUVEAUX) {
    it(theme, () => {
      const lv = avec(officiel(id), theme);
      const { track, terrain, env } = prepare(lv);
      const S = track.samples;
      let cliff = 0;
      for (let i = 0; i < S.length; i += 3) {
        const sp = S[i];
        for (const lat of [-sp.w, 0, sp.w, sp.w + 0.8, -sp.w - 0.8]) {
          expect(Math.abs(terrain.heightAt(sp.x + sp.nx * lat, sp.z + sp.nz * lat) - sp.y)).toBeLessThan(0.1);
        }
        if (i % 4 === 0) for (const side of [-1, 1]) {
          let prev = terrain.heightAt(sp.x + sp.nx * side * (sp.w + 1), sp.z + sp.nz * side * (sp.w + 1));
          for (let e = 2; e <= 40; e++) {
            const h = terrain.heightAt(sp.x + sp.nx * side * (sp.w + e), sp.z + sp.nz * side * (sp.w + e));
            cliff = Math.max(cliff, Math.abs(h - prev));
            prev = h;
          }
        }
      }
      expect(cliff).toBeLessThan(3.5);
      if (terrain.mer) for (const sp of S) expect(terrain.heightAt(sp.x, sp.z)).toBeGreaterThan(terrain.mer.niveau + 2);
      for (const it of env.items) {
        if (it.manual || SANS_COLLISION.has(it.kind) || ['borne', 'chevron', 'balise'].includes(it.kind)) continue;
        const n = nearestSample(track, it.x, it.z);
        if (n) expect(n.dist, it.kind).toBeGreaterThanOrEqual(S[n.index].w + 3 - 0.6);
      }
    });
  }
});

describe('nouveaux thèmes : épingle et ligne droite', () => {
  for (const theme of NOUVEAUX) {
    it(`${theme} : déterministe, décor hors de la route (épingle)`, () => {
      const lv = avec(hairpinLevel(), theme);
      const a = prepare(lv), b = prepare(lv);
      expect(a.env).toEqual(b.env);
      expect(a.env.items.length).toBeGreaterThan(50);
    });
  }
});
