import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from '../src/levels';
import { loadLevel } from '../src/core/loadLevel';
import { Terrain } from '../src/core/track/terrain';
import { generateEnvironment } from '../src/core/env/generate';

describe('niveaux officiels', () => {
  it('trois niveaux dans le bon ordre, identifiants uniques', () => {
    expect(NIVEAUX_OFFICIELS.map((n) => n.id)).toEqual(['premiers-virages', 'foret-des-pins', 'col-du-loup']);
    expect(cleNiveauOfficiel('col-du-loup')).toBe('off:col-du-loup');
  });
  for (const n of NIVEAUX_OFFICIELS) {
    it(`${n.id} : valide, bonne longueur, decor genere`, () => {
      const r = loadLevel(n.data);
      if (!r.ok) throw new Error(r.erreurs.join('\n'));
      expect(r.track.length).toBeGreaterThan(900);
      expect(r.track.length).toBeLessThan(2100);
      expect(r.track.targetTime).toBeGreaterThan(35);
      expect(r.track.targetTime).toBeLessThan(150);
      const terrain = new Terrain(r.track, r.level.decor.graine);
      const env = generateEnvironment(r.level, r.track, terrain);
      expect(env.items.length).toBeGreaterThan(300);
      if (n.id === 'col-du-loup') expect(env.segments.length).toBeGreaterThan(0);
    });
  }
});
