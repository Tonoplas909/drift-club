import { describe, it, expect } from 'vitest';
import { buildPonts } from '../../src/render/road';
import { prepareLevel } from '../../src/game/prepare';
import { buildTrack } from '../../src/core/track/buildTrack';
import { pontLevel, straightLevel } from '../fixtures/levels';

describe('rendu des ponts', () => {
  it('tablier et piliers fusionnés en un seul maillage, sous la chaussée', () => {
    const r = prepareLevel('perso:pont', pontLevel(12));
    if (!r.ok) throw new Error(r.erreurs.join());
    const { track, env } = r.prepared;
    expect(env.piliers?.length ?? 0).toBeGreaterThan(0);
    const m = buildPonts(track, env.piliers)!;
    expect(m).not.toBeNull();
    const pos = m.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(100);
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox!;
    expect(b.max.y).toBeLessThan(12.2);
    expect(b.min.y).toBeLessThan(1);
  });
  it('sans pont : rien', () => {
    expect(buildPonts(buildTrack(straightLevel(200)))).toBeNull();
  });
});
