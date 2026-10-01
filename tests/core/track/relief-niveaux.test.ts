import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { loadLevel } from '../../../src/core/loadLevel';
import { Terrain } from '../../../src/core/track/terrain';
import { THEMES } from '../../../src/core/env/themes';
import { generateEnvironment } from '../../../src/core/env/generate';
import { SANS_COLLISION } from '../../../src/core/env/types';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { makeLevel } from '../../fixtures/levels';

/** Terrain de chaque niveau officiel : la route n'est jamais sous le terrain ni suspendue sans talus, et la physique voit le même sol que le rendu. */
describe.each(NIVEAUX_OFFICIELS.map((n) => [n.id, n.data] as const))('relief du niveau %s', (_id, data) => {
  const r = loadLevel(data);
  if (!r.ok) throw new Error(r.erreurs.join('\n'));
  const { level, track } = r;
  const terrain = new Terrain(track, level.decor.graine, THEMES[level.environnement].relief, level.eau);
  const S = track.samples;

  it('le terrain suit la chaussée et l\'accotement (centre, bords) : jamais au-dessus de la route', () => {
    let pire = -Infinity;
    for (let i = 0; i < S.length; i += 2) {
      const sp = S[i];
      for (const lat of [-sp.w, -sp.w / 2, 0, sp.w / 2, sp.w, sp.w + 0.8, -sp.w - 0.8]) {
        const x = sp.x + sp.nx * lat, z = sp.z + sp.nz * lat;
        // la physique (heightAt) colle à la route ; la surface affichée est 15 cm plus bas sous la chaussée
        expect(Math.abs(terrain.heightAt(x, z) - sp.y)).toBeLessThan(0.1);
        pire = Math.max(pire, terrain.hauteurRendue(x, z) - sp.y);
      }
    }
    expect(pire).toBeLessThan(-0.1);
  });

  it('pente de la route pour la physique : raisonnable', () => {
    for (let i = 0; i < S.length; i += 3) {
      const g = terrain.gradientAt(S[i].x, S[i].z);
      expect(Math.hypot(g.gx, g.gz)).toBeLessThan(0.6);
    }
  });

  it('pas de falaise : le terrain ne varie jamais de plus de 3,5 m d\'un mètre à l\'autre près de la route', () => {
    let pire = 0;
    for (let i = 0; i < S.length; i += 4) {
      const sp = S[i];
      for (const side of [-1, 1]) {
        let prev = terrain.heightAt(sp.x + sp.nx * side * (sp.w + 1), sp.z + sp.nz * side * (sp.w + 1));
        for (let e = 2; e <= 40; e++) {
          const h = terrain.heightAt(sp.x + sp.nx * side * (sp.w + e), sp.z + sp.nz * side * (sp.w + e));
          pire = Math.max(pire, Math.abs(h - prev));
          prev = h;
        }
      }
    }
    expect(pire).toBeLessThan(3.5);
  });

  it('aucun élément de décor dans le couloir de la route (toutes les branches proches)', () => {
    const env = generateEnvironment(level, track, terrain);
    for (const it of env.items) {
      if (it.manual || it.kind === 'borne' || it.kind === 'chevron' || it.kind === 'piquet') continue;
      // dalles suspendues (backrooms) : au-dessus de la route, sans collision
      if (SANS_COLLISION.has(it.kind)) continue;
      let d = Infinity;
      let w = 0;
      const voisins: number[] = [];
      track.grid.query(it.x, it.z, 30, voisins);
      for (const i of voisins) {
        const dd = Math.hypot(S[i].x - it.x, S[i].z - it.z) - S[i].w;
        if (dd < d) { d = dd; w = S[i].w; }
      }
      expect(d, `${it.kind} en (${it.x.toFixed(1)}, ${it.z.toFixed(1)}), route de demi-largeur ${w}`).toBeGreaterThan(0);
    }
  });
});

describe('talus entre deux branches de route à des hauteurs différentes', () => {
  // deux branches parallèles distantes de 26 m, l'une 15 m plus haut (épingles empilées)
  const level = makeLevel([
    [0, 0, 0, 10], [0, 40, 0, 10], [0, 80, 0, 10], [0, 120, 0, 10],
    [13, 150, 5, 10], [26, 120, 15, 10], [26, 80, 15, 10], [26, 40, 15, 10], [26, 0, 15, 10],
  ]);
  const track = buildTrack(level);
  const terrain = new Terrain(track, 7);

  it('rampe continue : pas de marche de plus de 3,5 m entre les deux branches', () => {
    let prev = terrain.heightAt(0, 60);
    let pire = 0;
    for (let x = 0.5; x <= 26; x += 0.5) {
      const h = terrain.heightAt(x, 60);
      pire = Math.max(pire, Math.abs(h - prev));
      prev = h;
    }
    expect(pire).toBeLessThan(3.5);
    expect(terrain.heightAt(0, 60)).toBeCloseTo(0, 1);
    expect(terrain.heightAt(26, 60)).toBeCloseTo(15, 1);
    // entre les deux, la hauteur est comprise entre celles des deux routes
    const milieu = terrain.heightAt(13, 60);
    expect(milieu).toBeGreaterThan(0);
    expect(milieu).toBeLessThan(15);
  });

  it('déterministe', () => {
    const t2 = new Terrain(track, 7);
    for (const [x, z] of [[5, 60], [13, 60], [40, 20], [-30, 100]]) expect(t2.heightAt(x, z)).toBe(terrain.heightAt(x, z));
  });
});
