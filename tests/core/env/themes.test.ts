import { describe, it, expect } from 'vitest';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { Terrain } from '../../../src/core/track/terrain';
import { creerTerrain } from '../../../src/core/env/terrainDuNiveau';
import { nearestSample } from '../../../src/core/track/projection';
import { generateEnvironment } from '../../../src/core/env/generate';
import { THEMES, typesDuTheme } from '../../../src/core/env/themes';
import { CERCLES_MULTIPLES, COLLIDER_RADIUS, SANS_COLLISION, VARIANTS } from '../../../src/core/env/types';
import { boiteDe, batimentDe, IMMEUBLES, TOURS, HAUTEUR_ETAGE } from '../../../src/core/env/ville';
import { buildCollisionWorld, resolveCollisions, CRASH_IMPACT } from '../../../src/core/physics/collision';
import { createCarState } from '../../../src/core/physics/car';
import { CARS } from '../../../src/core/physics/cars';
import { SIM_DT } from '../../../src/core/constants';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { loadLevel } from '../../../src/core/loadLevel';
import { ENVIRONNEMENTS, type Environnement, type Level, type TypeObjet } from '../../../src/core/level/types';
import { straightLevel, hairpinLevel } from '../../fixtures/levels';

function envOf(level: Level) {
  const track = buildTrack(level);
  const terrain = creerTerrain(track, level);
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
    expect(ENVIRONNEMENTS[4]).toBe('ville'); // ajouté à la fin : les anciens liens gardent leur indice
    expect(ENVIRONNEMENTS.slice(5)).toEqual(['pirate', 'backrooms', 'espace', 'japon', 'cyberpunk']);
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
          const bord = it.kind === 'chevron' || it.kind === 'borne' || it.kind === 'piquet' || it.kind === 'balise';
          if (SANS_COLLISION.has(it.kind)) continue; // dalles suspendues au-dessus de la route
          expect(n.dist).toBeGreaterThanOrEqual((bord ? w + 1.5 : w + 3) - 0.05);
        }
        // un cercle par objet solide rond, 4 segments par objet solide à emprise rectangulaire (ville)
        const solides = env.items.filter((i) => i.solid && !SANS_COLLISION.has(i.kind));
        expect(env.circles.length).toBe(solides.filter((i) => !boiteDe(i.kind, i.variant)).reduce((n, i) => n + (CERCLES_MULTIPLES[i.kind]?.length ?? 1), 0));
        // plus un segment par tronçon de cloison (couloir des backrooms)
        expect(env.segments.length).toBe(4 * solides.filter((i) => boiteDe(i.kind, i.variant)).length + (env.cloisons?.length ?? 0));
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
    expect(kinds('ville').has('immeuble')).toBe(true);
    expect(kinds('ville').has('lampadaire')).toBe(true);
    expect(kinds('ville').has('sapin')).toBe(false);
    expect(kinds('pirate').has('palmier')).toBe(true);
    expect(kinds('pirate').has('tonneau')).toBe(true);
    expect(kinds('pirate').has('sapin')).toBe(false);
    expect(kinds('backrooms').has('mur')).toBe(true);
    expect(kinds('backrooms').has('dalleLumiere')).toBe(true);
    expect(kinds('espace').has('cristal')).toBe(true);
    expect(kinds('espace').has('feuillu')).toBe(false);
    expect(kinds('japon').has('cerisier')).toBe(true);
    expect(kinds('japon').has('toro')).toBe(true);
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
    expect(manuels('ville')).toEqual(['arbreVille', 'lampadaire', 'blocBeton', 'pneus', 'panneau']);
    expect(manuels('pirate')).toEqual(['palmier', 'drapeauPirate', 'rocher', 'tonneau', 'caisse']);
    expect(manuels('backrooms')).toEqual(['pilier', 'lampeBureau', 'mur', 'carton', 'porteBureau']);
    expect(manuels('espace')).toEqual(['cristal', 'antenne', 'rocher', 'bidon', 'balise']);
    expect(manuels('japon')).toEqual(['cerisier', 'bambou', 'rocher', 'toro', 'torii']);
    // solides, avec le rayon du type
    const { env } = envOf(avec(lv, 'desert'));
    const cactus = env.items.find((i) => i.kind === 'cactus')!;
    expect(env.circles.find((c) => c.x === cactus.x && c.z === cactus.z)!.r).toBeCloseTo(COLLIDER_RADIUS.cactus, 9);
  });
});

describe('ville : bâtiments et mobilier', () => {
  const ville = (lv: Level): Level => avec(lv, 'ville');
  const cas: [string, () => Level][] = [['ligne droite', () => straightLevel(500)], ['épingle', hairpinLevel]];
  const officiel = (id: string): Level => {
    const r = loadLevel(NIVEAUX_OFFICIELS.find((n) => n.id === id)!.data);
    if (!r.ok) throw new Error(r.erreurs.join());
    return ville(r.level);
  };
  const niveaux: [string, () => Level][] = [...cas, ['premiers-virages', () => officiel('premiers-virages')], ['col-du-loup', () => officiel('col-du-loup')]];
  const recul = THEMES.ville.batiments!.recul;

  it('les dimensions des bâtiments sont cohérentes (2 à 12 étages, tours plus hautes)', () => {
    for (const b of [...IMMEUBLES, ...TOURS]) {
      expect(b.etages).toBeGreaterThanOrEqual(2);
      expect(b.etages).toBeLessThanOrEqual(12);
      expect(b.w).toBeGreaterThan(6);
      expect(b.d).toBeGreaterThan(6);
    }
    expect(Math.min(...TOURS.map((t) => t.etages))).toBeGreaterThan(Math.max(...IMMEUBLES.map((t) => t.etages)));
    expect(VARIANTS.immeuble).toBe(IMMEUBLES.length);
    expect(VARIANTS.tour).toBe(TOURS.length);
    expect(HAUTEUR_ETAGE).toBeGreaterThan(2.5);
  });

  it('le couloir des bâtiments est plus large que celui du reste du décor (≥ largeur/2 + 6 m)', () => {
    expect(recul).toBeGreaterThanOrEqual(6);
  });

  for (const [nom, mk] of niveaux) {
    describe(nom, () => {
      const { track, env } = envOf(ville(mk()));
      const batiments = env.items.filter((i) => batimentDe(i.kind, i.variant));

      it('génère des bâtiments, déterministe', () => {
        expect(batiments.length).toBeGreaterThan(10);
        expect(envOf(ville(mk())).env).toEqual(env);
      });
      it('aucun point d’un bâtiment à moins de largeur/2 + 6 m de la route', () => {
        for (const b of batiments) {
          const [w, d] = boiteDe(b.kind, b.variant)!;
          const ex = [Math.cos(b.rot), -Math.sin(b.rot)], ez = [Math.sin(b.rot), Math.cos(b.rot)];
          const pts: [number, number][] = [];
          for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) {
            if (i % 8 !== 0 && j % 8 !== 0) continue; // pourtour
            const u = (i / 8 - 0.5) * w, v = (j / 8 - 0.5) * d;
            pts.push([b.x + u * ex[0] + v * ez[0], b.z + u * ex[1] + v * ez[1]]);
          }
          for (const [x, z] of pts) {
            const n = nearestSample(track, x, z);
            if (!n) continue;
            expect(n.dist).toBeGreaterThanOrEqual(track.samples[n.index].w + 6 - 0.6); // 0,6 m : pas d'échantillonnage de la route
          }
        }
      });
      it('les segments (bâtiments, voitures garées, abribus…) restent hors de la chaussée', () => {
        expect(batiments.some((b) => b.solid)).toBe(true);
        // sans les glissières du niveau (à w + 0,8 m, voulues)
        const { env: sansGlissieres } = envOf({ ...ville(mk()), barrieres: [] });
        for (const s of sansGlissieres.segments) {
          for (const t of [0, 0.5, 1]) {
            const x = s.ax + (s.bx - s.ax) * t, z = s.az + (s.bz - s.az) * t;
            const n = nearestSample(track, x, z);
            if (n) expect(n.dist).toBeGreaterThanOrEqual(track.samples[n.index].w + 1.5 - 0.6);
          }
        }
      });
      it('bâtiments hors de portée = visuels ; pas de chevauchement entre bâtiments', () => {
        for (const b of batiments) expect(Number.isFinite(b.y)).toBe(true);
        for (let i = 0; i < batiments.length; i++) {
          for (let j = i + 1; j < batiments.length; j++) {
            const a = batiments[i], b = batiments[j];
            // deux emprises dont les cercles inscrits (demi-plus-petit côté) se recouvrent se chevauchent forcément
            const ia = Math.min(...boiteDe(a.kind, a.variant)!) / 2, ib = Math.min(...boiteDe(b.kind, b.variant)!) / 2;
            expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(ia + ib);
          }
        }
      });
    });
  }

  it('les bâtiments proches sont solides (4 segments), pas les lointains', () => {
    const { terrain, env } = envOf(ville(straightLevel(500)));
    const solides = env.items.filter((i) => batimentDe(i.kind, i.variant) && i.solid);
    expect(solides.length).toBeGreaterThan(5);
    for (const b of solides) {
      const [w, d] = boiteDe(b.kind, b.variant)!;
      expect(terrain.distanceToRoad(b.x, b.z)).toBeLessThan(40 + Math.hypot(w, d) / 2);
    }
    for (const b of env.items.filter((i) => batimentDe(i.kind, i.variant) && !i.solid)) {
      expect(terrain.distanceToRoad(b.x, b.z)).toBeGreaterThanOrEqual(40);
    }
  });

  it('une voiture lancée contre un bâtiment est arrêtée', () => {
    const lv = ville(straightLevel(500));
    const { env } = envOf(lv);
    const b = env.items.find((i) => batimentDe(i.kind, i.variant) && i.solid)!;
    const [w] = boiteDe(b.kind, b.variant)!;
    const world = buildCollisionWorld(env);
    const P = CARS.equilibree;
    // face du côté route : le long de l'axe x local (façade), on part de la route et on fonce sur le centre du bâtiment
    const dir = Math.sign(b.x - 0) || 1;
    const car = createCarState(b.x - dir * (w + 25), b.z, dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.vx = dir * 25;
    let choc = 0;
    for (let k = 0; k < 400; k++) {
      car.vx = dir * Math.max(car.vx * dir, 15);
      car.x += dir * 15 * SIM_DT;
      choc = Math.max(choc, resolveCollisions(car, P, world));
      if (choc > CRASH_IMPACT) break;
    }
    expect(choc).toBeGreaterThan(CRASH_IMPACT);
    expect(Math.abs(car.x - b.x)).toBeGreaterThan(0.5); // jamais à l'intérieur : repoussée à la façade
  });

  it('pas d’arbre ni de mobilier posé dans un bâtiment', () => {
    const { env } = envOf(ville(straightLevel(500)));
    const bats = env.items.filter((i) => batimentDe(i.kind, i.variant));
    for (const it of env.items) {
      if (batimentDe(it.kind, it.variant) || it.manual) continue;
      for (const b of bats) {
        const [w, d] = boiteDe(b.kind, b.variant)!;
        const dx = it.x - b.x, dz = it.z - b.z;
        const u = dx * Math.cos(b.rot) - dz * Math.sin(b.rot), v = dx * Math.sin(b.rot) + dz * Math.cos(b.rot);
        expect(Math.abs(u) <= w / 2 && Math.abs(v) <= d / 2, `${it.kind} dans un bâtiment`).toBe(false);
      }
    }
  });

  it('le terrain de la ville a moins de relief que celui de la montagne', () => {
    const track = buildTrack(straightLevel(300));
    const plat = new Terrain(track, 5, THEMES.ville.relief);
    const monts = new Terrain(track, 5);
    expect(plat.heightAt(120, 150)).toBeLessThan(monts.heightAt(120, 150));
    expect(THEMES.montagne.relief).toBeUndefined();
  });
});
