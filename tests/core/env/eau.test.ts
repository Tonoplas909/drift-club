import { describe, it, expect } from 'vitest';
import { Lac, aire, autoIntersection, problemesEau, BERGE, RIVE } from '../../../src/core/env/eau';
import { Terrain } from '../../../src/core/track/terrain';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { generateEnvironment } from '../../../src/core/env/generate';
import { loadLevel } from '../../../src/core/loadLevel';
import { validateLevel } from '../../../src/core/level/validate';
import { encoderNiveau, decoderNiveau, normaliserNiveau, versBase64url } from '../../../src/core/level/encode';
import { empreinteNiveau } from '../../../src/core/level/fingerprint';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import type { Level, PlanEau } from '../../../src/core/level/types';
import { straightLevel } from '../../fixtures/levels';
import { RaceSim } from '../../../src/core/race/race';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';

/** Carré de 60 m de côté centré en (cx, cz). */
const carre = (cx: number, cz: number, demi = 30, niveau = -2): PlanEau => ({
  niveau,
  points: [{ x: cx - demi, z: cz - demi }, { x: cx + demi, z: cz - demi }, { x: cx + demi, z: cz + demi }, { x: cx - demi, z: cz + demi }],
});

/** Route droite le long de +z, lac à 80 m de l'axe (côté +x). */
const avecLac = (plan: PlanEau = carre(80, 100)): Level => ({ ...straightLevel(300), eau: [plan] });

describe('Lac (géométrie)', () => {
  const lac = new Lac(carre(0, 0));
  it('distance signée : positive dedans, négative dehors', () => {
    expect(lac.distance(0, 0)).toBeCloseTo(30, 6);
    expect(lac.distance(25, 0)).toBeCloseTo(5, 6);
    expect(lac.distance(40, 0)).toBeCloseTo(-10, 6);
    expect(lac.distance(40, 40)).toBeCloseTo(-Math.hypot(10, 10), 6);
  });
  it('hauteur : berge à la limite, fond sous la surface, terre inchangée au loin', () => {
    expect(lac.hauteur(30, 0, 5)).toBeCloseTo(-2 + BERGE, 6); // sur le bord : à la hauteur de la berge
    expect(lac.hauteur(0, 0, 5)).toBeLessThan(-2 - 3); // au milieu : fond profond
    expect(lac.hauteur(30 + RIVE + 1, 0, 5)).toBe(5); // hors de la rive : terre
    // raccord continu entre la terre et la berge
    let prev = lac.hauteur(30 + RIVE, 0, 5);
    for (let x = 30 + RIVE; x >= 20; x -= 0.25) {
      const h = lac.hauteur(x, 0, 5);
      expect(Math.abs(h - prev)).toBeLessThan(1);
      prev = h;
    }
  });
  it('aire et auto-intersection', () => {
    expect(aire(carre(0, 0).points)).toBeCloseTo(3600, 6);
    expect(autoIntersection(carre(0, 0).points)).toBe(false);
    // « nœud papillon »
    expect(autoIntersection([{ x: 0, z: 0 }, { x: 10, z: 10 }, { x: 10, z: 0 }, { x: 0, z: 10 }])).toBe(true);
  });
});

describe('terrain avec lac', () => {
  const level = avecLac();
  const track = buildTrack(level);
  const terrain = new Terrain(track, 1234, 1, level.eau);

  it('le fond descend sous la surface, la rive reste au-dessus', () => {
    expect(terrain.heightAt(80, 100)).toBeLessThan(-2 - 3);
    expect(terrain.distanceEau(80, 100)).toBeGreaterThan(20);
    expect(terrain.distanceEau(0, 100)).toBeLessThan(0);
    expect(terrain.distanceEau(0, 100)).toBeGreaterThan(-100);
  });
  it('sans lac : distanceEau vaut −Infinity et le terrain est celui de toujours', () => {
    const sec = new Terrain(track, 1234);
    expect(sec.distanceEau(80, 100)).toBe(-Infinity);
    expect(sec.plans).toHaveLength(0);
    expect(terrain.heightAt(0, 100)).toBe(sec.heightAt(0, 100)); // la route reste inchangée
  });
  it('le décor n\'est jamais posé dans l\'eau ni sur la rive', () => {
    const env = generateEnvironment(level, track, terrain);
    expect(env.items.length).toBeGreaterThan(50);
    for (const it of env.items) {
      if (it.manual) continue;
      expect(terrain.distanceEau(it.x, it.z), `${it.kind} en (${it.x.toFixed(0)}, ${it.z.toFixed(0)})`).toBeLessThan(0);
    }
  });
});

describe('course avec un lac', () => {
  it('la voiture qui entre dans l\'eau est replacée sur la route', () => {
    const level = avecLac(carre(46, 150));
    const track = buildTrack(level);
    const terrain = new Terrain(track, 1234, 1, level.eau);
    const sim = new RaceSim({ level, track, terrain, env: generateEnvironment(level, track, terrain), car: CARS.equilibree, assists: MODES.semi, countdown: 0 });
    sim.step({ gaz: 0, frein: 0, direction: 0, freinAMain: false });
    sim.car.x = 46; sim.car.z = 150; // au milieu du lac
    const ev = sim.step({ gaz: 0, frein: 0, direction: 0, freinAMain: false });
    expect(ev.some((e) => e.type === 'replace' && e.auto)).toBe(true);
    expect(Math.abs(sim.car.x)).toBeLessThan(6); // de retour sur la route
  });
});

describe('validation des lacs', () => {
  const err = (eau: unknown): string => {
    const r = validateLevel({ ...straightLevel(), eau });
    return r.ok ? '' : r.erreurs.join(' | ');
  };
  it('accepte un lac valide et le conserve ; aucun champ eau sans lac', () => {
    const r = validateLevel(avecLac());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level.eau).toEqual(avecLac().eau);
    const sans = validateLevel({ ...straightLevel(), eau: [] });
    expect(sans.ok && 'eau' in sans.level).toBe(false);
    const vide = validateLevel(straightLevel());
    expect(vide.ok && 'eau' in vide.level).toBe(false);
  });
  it('refuse une forme, des limites et des contours invalides (messages en français)', () => {
    expect(err('lac')).toMatch(/liste de lacs/);
    expect(err([1])).toMatch(/niveau/);
    expect(err([{ niveau: 0, points: [{ x: 0, z: 0 }, { x: 5, z: 5 }] }])).toMatch(/3 à 64 points/);
    expect(err([{ niveau: 999, points: carre(80, 100).points }])).toMatch(/hors limites/);
    expect(err([{ niveau: 0, points: [{ x: 0, z: 0 }, { x: 'a', z: 0 }, { x: 1, z: 1 }] }])).toMatch(/x et z/);
    expect(err([{ niveau: 0, points: [{ x: 0, z: 0 }, { x: 10, z: 10 }, { x: 10, z: 0 }, { x: 0, z: 10 }] }])).toMatch(/se croise/);
    expect(err([{ niveau: 0, points: [{ x: 0, z: 0 }, { x: 5, z: 0 }, { x: 5, z: 5 }] }])).toMatch(/trop petit/);
    expect(err([carre(80, 100), carre(80, 200), carre(80, 0), carre(200, 0)])).toMatch(/3 lacs au maximum/);
    const trop = Array.from({ length: 65 }, (_, i) => ({ x: 100 * Math.cos((i / 65) * 6.28), z: 100 * Math.sin((i / 65) * 6.28) }));
    expect(err([{ niveau: 0, points: trop }])).toMatch(/3 à 64 points/);
  });
  it('la route doit rester au sec', () => {
    const r = loadLevel({ ...straightLevel(300), eau: [carre(0, 100)] }); // lac sur la route
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.join()).toMatch(/lac 1 touche la route/);
    // trop près du bord de la route (marge 6 m) : refusé ; à 10 m : accepté
    expect(loadLevel({ ...straightLevel(300), eau: [carre(34, 100)] }).ok).toBe(false); // bord du lac à x = 4 (route large de 10 : bord à 5)
    expect(loadLevel({ ...straightLevel(300), eau: [carre(46, 100)] }).ok).toBe(true); // bord du lac à x = 16
    const t = buildTrack(straightLevel(300));
    expect(problemesEau(undefined, t.samples)).toEqual([]);
  });
});

/** Code de partage d'un JSON compact écrit à la main. */
async function codeDe(compact: unknown): Promise<string> {
  const flux = new CompressionStream('deflate-raw');
  const w = flux.writable.getWriter();
  void w.write(new TextEncoder().encode(JSON.stringify(compact)));
  void w.close();
  const morceaux: Uint8Array[] = [];
  const rd = flux.readable.getReader();
  for (;;) { const { done, value } = await rd.read(); if (done) break; morceaux.push(value); }
  const octets = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  let o = 0;
  for (const m of morceaux) { octets.set(m, o); o += m.length; }
  return `1.${versBase64url(octets)}`;
}

describe('lac et partage', () => {
  it('lien : aller-retour d\'un niveau avec lac (arrondi au 0,1 m)', async () => {
    const l: Level = { ...avecLac(), eau: [{ niveau: -2.34, points: [{ x: 60.04, z: 70 }, { x: 110, z: 70.26 }, { x: 110.1, z: 130 }, { x: 60, z: 130.5 }] }] };
    const code = await encoderNiveau(l);
    const r = await decoderNiveau(code);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level).toEqual(normaliserNiveau(l));
    if (r.ok) expect(r.level.eau![0].niveau).toBeCloseTo(-2.3, 6);
  });
  it('un niveau sans lac produit exactement le même code qu\'avant (pas de clé d\'eau)', async () => {
    const l = straightLevel(200);
    expect(JSON.stringify(normaliserNiveau(l))).not.toContain('eau');
    const r = await decoderNiveau(await encoderNiveau(l));
    expect(r.ok && r.level.eau).toBeFalsy();
  });
  it('un ancien code (sans clé « w ») se décode toujours', async () => {
    // JSON compact tel que l'écrivait la version précédente : aucune clé « w »
    const r = await decoderNiveau(await codeDe({ n: 'Ancien', a: 'A', e: 0, m: 0, r: [[0, 0, 0, 100], [0, 300, 0, 0]], b: [], d: [5, 50], o: [] }));
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.level.nom).toBe('Ancien'); expect(r.level.eau).toBeUndefined(); }
  });
  it('un champ « w » abîmé est refusé, un « w » correct est lu', async () => {
    const base = { n: 'Lac', a: 'A', e: 0, m: 0, r: [[0, 0, 0, 100], [0, 300, 0, 0]], b: [], d: [5, 50], o: [] };
    expect((await decoderNiveau(await codeDe({ ...base, w: [[1, 2]] }))).ok).toBe(false);
    expect((await decoderNiveau(await codeDe({ ...base, w: 'x' }))).ok).toBe(false);
    // niveau −2 ; points (60, 70), (110, 70), (110, 130), (60, 130) : premier point absolu, puis différences (× 10)
    const bon = await decoderNiveau(await codeDe({ ...base, w: [[-20, 600, 700, 500, 0, 0, 600, -500, 0]] }));
    expect(bon.ok).toBe(true);
    if (bon.ok) expect(bon.level.eau).toEqual([{ niveau: -2, points: [{ x: 60, z: 70 }, { x: 110, z: 70 }, { x: 110, z: 130 }, { x: 60, z: 130 }] }]);
  });
  it('empreinte : inchangée sans lac, différente avec lac', async () => {
    const l = straightLevel(200);
    // forme canonique d'avant l'introduction de l'eau
    const canon = JSON.stringify({ format: l.format, environnement: l.environnement, ambiance: l.ambiance, route: l.route, barrieres: l.barrieres, decor: l.decor, objets: l.objets });
    const h = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(canon));
    const attendu = Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, '0')).join('');
    expect(await empreinteNiveau(l)).toBe(attendu);
    expect(await empreinteNiveau({ ...l, eau: [] })).toBe(attendu);
    expect(await empreinteNiveau(avecLac())).not.toBe(await empreinteNiveau(straightLevel(300)));
  });
  it('empreinte : indépendante de l\'ordre des clés du lac (niveau chargé ou normalisé)', async () => {
    const a: Level = { ...straightLevel(300), eau: [{ niveau: -2, points: carre(80, 100).points }] };
    const b: Level = { ...straightLevel(300), eau: [{ points: carre(80, 100).points, niveau: -2 }] };
    expect(await empreinteNiveau(a)).toBe(await empreinteNiveau(b));
  });
  it('export / import JSON conserve l\'eau', () => {
    const l = avecLac();
    const r = loadLevel(JSON.parse(JSON.stringify(l)));
    expect(r.ok && r.level.eau).toEqual(l.eau);
  });
});

describe('Circuit du Lac', () => {
  const n = NIVEAUX_OFFICIELS.find((x) => x.id === 'circuit-du-lac')!;
  const r = loadLevel(n.data);

  it('a un vrai lac, à sec sur la route, à plus de 35 m de l\'axe (limite de zone)', () => {
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.level.eau).toHaveLength(1);
    const lac = new Lac(r.level.eau![0]);
    expect(aire(r.level.eau![0].points)).toBeGreaterThan(40000);
    let mini = Infinity;
    for (const sp of r.track.samples) mini = Math.min(mini, -lac.distance(sp.x, sp.z));
    expect(mini).toBeGreaterThan(35);
    // la surface est sous toute la route
    expect(r.level.eau![0].niveau).toBeLessThan(Math.min(...r.level.route.map((p) => p.y)));
  });
});
