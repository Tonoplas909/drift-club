import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { loadLevel } from '../../../src/core/loadLevel';
import { Terrain } from '../../../src/core/track/terrain';
import { generateEnvironment } from '../../../src/core/env/generate';
import type { Environment } from '../../../src/core/env/types';

/** Empreinte FNV-1a de tout le décor (positions au mm) : change si UN objet bouge. */
export function empreinteDecor(env: Environment): string {
  const r = (v: number) => Math.round(v * 1000);
  const s = env.items.map((i) => [i.kind, i.variant, r(i.x), r(i.y), r(i.z), r(i.rot), r(i.scale), i.solid ? 1 : 0, i.manual ? 1 : 0].join(',')).join(';')
    + '|' + env.circles.map((c) => [r(c.x), r(c.z), r(c.r)].join(',')).join(';')
    + '|' + env.barriers.length + '|' + env.segments.length;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

/** Valeurs mesurées AVANT l'introduction des thèmes (règles de montagne inchangées). */
const ATTENDU: Record<string, { items: number; hash: string }> = {
  'premiers-virages': { items: 4581, hash: 'd618c241' },
  'col-du-loup': { items: 5996, hash: '9f3f5814' },
};

describe('montagne : le décor des niveaux officiels ne change pas', () => {
  for (const id of ['premiers-virages', 'col-du-loup']) {
    it(id, () => {
      const n = NIVEAUX_OFFICIELS.find((x) => x.id === id)!;
      const r = loadLevel(n.data);
      if (!r.ok) throw new Error(r.erreurs.join('\n'));
      const env = generateEnvironment(r.level, r.track, new Terrain(r.track, r.level.decor.graine));
      expect({ items: env.items.length, hash: empreinteDecor(env) }).toEqual(ATTENDU[id]);
    });
  }
});
