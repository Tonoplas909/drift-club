import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { nearestSample } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import { THEMES, typesDuTheme } from '../../../src/core/env/themes';
import { COLLIDER_RADIUS, VARIANTS } from '../../../src/core/env/types';
import { ENVIRONNEMENTS, type Environnement, type Level, type TypeObjet } from '../../../src/core/level/types';
import { straightLevel, hairpinLevel } from '../../fixtures/levels';

function envOf(level: Level) {
  const track = buildTrack(level);
  const terrain = new Terrain(track, level.decor.graine);
  return { track, terrain, env: generateEnvironment(level, track, terrain) };
}
const avec = (lv: Level, environnement: Environnement): Level => ({ ...lv, environnement });

describe('registre des thèmes (règles)', () => {
  it('chaque environnement a ses règles, avec un nom français', () => {
    expect(Object.keys(THEMES).sort()).toEqual([...ENVIRONNEMENTS].sort());
    for (const id of ENVIRONNEMENTS) expect(THEMES[id].nom.length).toBeGreaterThan(2);
  });
  it('montagne reste en tête (les liens de partage stockent l’indice)', () => {
    expect(ENVIRONNEMENTS[0]).toBe('montagne');
    expect(ENVIRONNEMENTS.slice(0, 4)).toEqual(['montagne', 'neige', 'desert', 'automne']);
  });
  for (const id of ENVIRONNEMENTS) {
    describe(id, () => {
      const t = THEMES[id];
      it('tous les types de décor ont des variantes et un rayon de collision', () => {
        for (const k of typesDuTheme(t)) {
          expect(VARIANTS[k]).toBeGreaterThanOrEqual(1);
          expect(COLLIDER_RADIUS[k]).toBeGreaterThan(0);
        }
      });
      it('poids d’essences valides, chaque type d’objet manuel a un décor', () => {
        expect(t.arbres.essences.length).toBeGreaterThan(0);
        for (const e of t.arbres.essences) {
          expect(e.bas).toBeGreaterThanOrEqual(0);
          expect(e.haut).toBeGreaterThanOrEqual(0);
        }
        expect(t.arbres.essences.reduce((s, e) => s + e.bas, 0)).toBeGreaterThan(0);
        expect(t.arbres.essences.reduce((s, e) => s + e.haut, 0)).toBeGreaterThan(0);
        for (const type of ['arbre', 'sapin', 'rocher', 'pneus', 'panneau'] as const) expect(t.objets[type]).toBeDefined();
        for (const x of t.bord.extras) {
          expect(x.decalage).toBeGreaterThanOrEqual(3);
          expect(x.probabilite).toBeGreaterThan(0);
          expect(x.probabilite).toBeLessThanOrEqual(1);
        }
      });
      it('générateur déterministe, uniquement des types du thème', () => {
        const lv = avec(hairpinLevel(), id);
        const a = envOf(lv).env;
        expect(a).toEqual(envOf(lv).env);
        const permis = new Set(typesDuTheme(t));
        for (const it of a.items) expect(permis.has(it.kind)).toBe(true);
        expect(a.items.length).toBeGreaterThan(50);
      });
      it('rien dans le couloir de la route, un cercle par objet solide', () => {
        const { track, env } = envOf(avec(hairpinLevel(), id));
        for (const it of env.items) {
          const n = nearestSample(track, it.x, it.z);
          if (!n) continue;
          const w = track.samples[n.index].w;
          const bord = it.kind === 'chevron' || it.kind === 'borne' || it.kind === 'piquet';
          expect(n.dist).toBeGreaterThanOrEqual((bord ? w + 1.5 : w + 3) - 0.05);
        }
        expect(env.circles.length).toBe(env.items.filter((i) => i.solid).length);
        for (const c of env.circles) expect(Number.isFinite(c.r + c.x + c.z)).toBe(true);
      });
    });
  }

  it('les thèmes ne donnent pas le même décor', () => {
    const lv = straightLevel(400);
    const kinds = (id: Environnement) => new Set(envOf(avec(lv, id)).env.items.map((i) => i.kind));
    expect(kinds('desert').has('cactus')).toBe(true);
    expect(kinds('desert').has('sapin')).toBe(false);
    expect(kinds('neige').has('piquet')).toBe(true);
    expect(kinds('neige').has('borne')).toBe(false);
    expect(kinds('automne').has('feuillu')).toBe(true);
    expect(kinds('montagne').has('cactus')).toBe(false);
  });

  it('objets manuels : correspondance par thème (désert : sapin → cactus, arbre → arbre sec)', () => {
    const lv = straightLevel(300);
    const types: TypeObjet[] = ['arbre', 'sapin', 'rocher', 'pneus', 'panneau'];
    lv.objets = types.map((type, i) => ({ type, x: 30 + i * 8, z: 150, rot: 0 }));
    const manuels = (id: Environnement) => envOf(avec(lv, id)).env.items.filter((i) => i.manual).map((i) => i.kind);
    expect(manuels('montagne')).toEqual(['feuillu', 'sapin', 'rocher', 'pneus', 'panneau']);
    expect(manuels('desert')).toEqual(['arbreSec', 'cactus', 'rocher', 'pneus', 'panneau']);
    expect(manuels('neige')).toEqual(['feuillu', 'sapin', 'rocher', 'pneus', 'panneau']);
    expect(manuels('automne')).toEqual(['feuillu', 'sapin', 'rocher', 'pneus', 'panneau']);
    // solides, avec le rayon du type
    const { env } = envOf(avec(lv, 'desert'));
    const cactus = env.items.find((i) => i.kind === 'cactus')!;
    expect(env.circles.find((c) => c.x === cactus.x && c.z === cactus.z)!.r).toBeCloseTo(COLLIDER_RADIUS.cactus, 9);
  });
});
