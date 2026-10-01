import { describe, it, expect } from 'vitest';
import { Regions, ambianceA, TRANSITION } from '../../../src/core/zen/regions';
import { Dessinateur } from '../../../src/core/zen/designer';
import { RouteZen, LONGUEUR_TRONCON } from '../../../src/core/zen/route';
import { ZenSim } from '../../../src/core/zen/zenSim';
import { ENVIRONNEMENTS } from '../../../src/core/level/types';
import { CARS } from '../../../src/core/physics/cars';
import { MODES } from '../../../src/core/physics/assists';
import { SIM_DT } from '../../../src/core/constants';
import { wrapAngle, clamp } from '../../../src/core/math/vec';
import type { Environment } from '../../../src/core/env/types';

function empreinte(env: Environment): string {
  const r = (v: number) => Math.round(v * 1000);
  const s = env.items.map((i) => [i.kind, i.variant, r(i.x), r(i.y), r(i.z), r(i.rot), r(i.scale), i.solid ? 1 : 0].join(',')).join(';')
    + '|' + env.circles.length + '|' + env.segments.length;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16);
}

describe('Zen : régions et transitions', () => {
  it('les 5 décors reviennent tour à tour, jamais deux fois de suite, régions de 2,6 à 3,8 km', () => {
    const r = new Regions(99);
    const vus = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const g = r.region(i);
      if (i < 5) vus.add(g.theme);
      if (i > 0) {
        expect(g.theme).not.toBe(r.region(i - 1).theme);
        expect(g.debut).toBe(r.region(i - 1).fin);
      }
      expect(g.fin - g.debut).toBeGreaterThanOrEqual(2600);
      expect(g.fin - g.debut).toBeLessThanOrEqual(3800);
    }
    expect(vus.size).toBe(ENVIRONNEMENTS.length);
  });

  it('même graine ⇒ même suite ; autre graine ⇒ autre suite', () => {
    const a = new Regions(5), b = new Regions(5), c = new Regions(6);
    const suite = (r: Regions) => Array.from({ length: 10 }, (_, i) => `${r.region(i).theme}@${Math.round(r.region(i).fin)}`).join();
    expect(suite(a)).toBe(suite(b));
    expect(suite(a)).not.toBe(suite(c));
  });

  it('poids de transition : 0 → 1 de façon monotone sur la transition, somme des poids = 1', () => {
    const r = new Regions(3);
    for (let i = 0; i < 4; i++) {
      const f = r.region(i).fin;
      const avant = r.melange(f - TRANSITION / 2 - 5);
      expect(avant.t === 0 || avant.a === avant.b).toBe(true);
      let prec = -1;
      for (let s = f - TRANSITION / 2; s <= f + TRANSITION / 2; s += 10) {
        const m = r.melange(s);
        expect(m.a).toBe(r.region(i).theme);
        expect(m.b).toBe(r.region(i + 1).theme);
        expect(m.t).toBeGreaterThanOrEqual(prec - 1e-12);
        prec = m.t;
        const p = r.poids(s);
        expect(Object.values(p).reduce((x, y) => x + y!, 0)).toBeCloseTo(1, 9);
      }
      expect(r.melange(f - TRANSITION / 2).t).toBeCloseTo(0, 6);
      expect(r.melange(f).t).toBeCloseTo(0.5, 6);
      const apres = r.melange(f + TRANSITION / 2 + 1);
      expect(apres.a === apres.b || apres.t === 1).toBe(true);
      expect(r.dominant(f + TRANSITION / 2 + 1)).toBe(r.region(i + 1).theme);
    }
  });

  it('ambiance : entre 0 et 1, jour au départ, coucher plus loin, continue', () => {
    expect(ambianceA(0)).toBe(0);
    let max = 0, prec = 0;
    for (let s = 0; s < 20000; s += 5) {
      const a = ambianceA(s);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(Math.abs(a - prec)).toBeLessThan(0.02);
      prec = a; max = Math.max(max, a);
    }
    expect(max).toBe(1);
  });
});

describe('Zen : dessin de la route', () => {
  it('continuité au mètre près : position, cap, courbure, hauteur, largeur', () => {
    const d = new Dessinateur(7, new Regions(7));
    d.genererJusqua(12000);
    let p = d.echantillon(0);
    for (let i = 1; i < 12000; i++) {
      const sp = d.echantillon(i);
      expect(Math.hypot(sp.x - p.x, sp.z - p.z)).toBeCloseTo(1, 3);
      const dpsi = Math.abs(wrapAngle(Math.atan2(sp.tx, sp.tz) - Math.atan2(p.tx, p.tz)));
      expect(dpsi).toBeLessThan(1 / 15);
      expect(Math.abs(sp.k - p.k)).toBeLessThan(0.005);
      expect(Math.abs(sp.y - p.y)).toBeLessThan(0.1);
      expect(Math.abs(sp.grade - p.grade)).toBeLessThan(0.0013);
      expect(Math.abs(sp.w - p.w)).toBeLessThan(0.021);
      expect(Math.abs(sp.k)).toBeLessThan(1 / 14);
      expect(sp.w).toBeGreaterThanOrEqual(3.9);
      expect(sp.w).toBeLessThanOrEqual(7);
      p = sp;
    }
  });

  it('30 km sans croisement ni passage trop près (plusieurs graines), mémoire bornée', () => {
    for (const seed of [1, 42, 2024]) {
      const d = new Dessinateur(seed, new Regions(seed));
      const pts: { s: number; x: number; z: number; w: number }[] = [];
      const grille = new Map<string, number[]>();
      let tailleMax = 0;
      for (let s = 0; s < 30000; s += 1000) {
        d.genererJusqua(s + 1000);
        for (let i = Math.max(0, s); i < s + 1000; i += 2) {
          const sp = d.echantillon(i);
          expect(Number.isFinite(sp.x + sp.y + sp.z + sp.k + sp.w)).toBe(true);
          const cx = Math.floor(sp.x / 32), cz = Math.floor(sp.z / 32);
          for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
            for (const j of grille.get(`${cx + a},${cz + b}`) ?? []) {
              const q = pts[j];
              if (i - q.s <= 70 || i - q.s > 3000) continue;
              // règle de croisement de l'éditeur (checkGeometry) : largeurs + 4 m
              expect(Math.hypot(q.x - sp.x, q.z - sp.z)).toBeGreaterThanOrEqual(q.w + sp.w + 4);
            }
          }
          const k = `${cx},${cz}`;
          if (!grille.has(k)) grille.set(k, []);
          grille.get(k)!.push(pts.length);
          pts.push({ s: i, x: sp.x, z: sp.z, w: sp.w });
        }
        d.oublierAvant(s - 500);
        tailleMax = Math.max(tailleMax, d.tailleMemoire);
      }
      expect(tailleMax).toBeLessThan(8000);
    }
  }, 60_000);

  it('même graine ⇒ même route au bit près', () => {
    const a = new Dessinateur(31, new Regions(31)), b = new Dessinateur(31, new Regions(31));
    a.genererJusqua(5000);
    for (let s = 0; s < 5000; s += 250) b.genererJusqua(s); // demandes découpées autrement
    b.genererJusqua(5000);
    for (let i = 0; i < 5000; i += 7) expect(b.echantillon(i)).toEqual(a.echantillon(i));
    const c = new Dessinateur(32, new Regions(32));
    c.genererJusqua(500);
    expect(c.echantillon(400).x).not.toBe(a.echantillon(400).x);
  });
});

describe('Zen : tronçons, sol composé, décor', () => {
  it('les tronçons se raccordent exactement (échantillons communs identiques aux jonctions)', () => {
    const r = new RouteZen(11);
    r.viser(1500);
    r.toutFaire();
    for (let n = 1; n < 6; n++) {
      const a = r.troncon(n)!, b = r.troncon(n + 1)!;
      const s = b.debut;
      const sa = a.track.samples[s - a.debutPiste], sb = b.track.samples[s - b.debutPiste];
      for (const k of ['x', 'y', 'z', 'tx', 'tz', 'k', 'w', 'grade'] as const) expect(sb[k]).toBe(sa[k]);
      expect(a.fin).toBe(b.debut);
    }
  });

  it('sol composé : la chaussée a la hauteur de la route, pas de marche aux jonctions ni ailleurs', () => {
    const r = new RouteZen(12);
    r.viser(2000);
    r.toutFaire();
    const sol = r.sol;
    for (let n = 3; n <= 8; n++) {
      const j = n * LONGUEUR_TRONCON;
      for (let s = j - 40; s <= j + 40; s += 1) {
        const sp = r.echantillon(s);
        expect(Math.abs(sol.heightAt(sp.x, sp.z) - sp.y)).toBeLessThan(0.03);
        for (let lat = -60; lat <= 60; lat += 3) {
          const x = sp.x + sp.nx * lat, z = sp.z + sp.nz * lat;
          const h0 = sol.heightAt(x, z);
          expect(Number.isFinite(h0)).toBe(true);
          // pente locale bornée : pas de falaise ni de marche (2 pas de 0,25 m)
          const hx = sol.heightAt(x + 0.25, z), hz = sol.heightAt(x, z + 0.25);
          expect(Math.abs(hx - h0)).toBeLessThan(1);
          expect(Math.abs(hz - h0)).toBeLessThan(1);
        }
      }
    }
  });

  it('fenêtre bornée sur 30 km : tronçons, terrains et décor en nombre limité, jamais de NaN', () => {
    const r = new RouteZen(2025);
    let maxTous = 0, maxTerrains = 0, maxFinis = 0, maxMem = 0;
    const temps: number[] = [], etapes: number[] = [];
    for (let s = 0; s <= 30000; s += 160) {
      r.viser(s);
      const t0 = performance.now();
      for (;;) {
        const e0 = performance.now();
        if (!r.travailler()) break;
        etapes.push(performance.now() - e0);
      }
      temps.push(performance.now() - t0);
      maxTous = Math.max(maxTous, r.tous.length);
      maxTerrains = Math.max(maxTerrains, r.avecTerrain.length);
      maxFinis = Math.max(maxFinis, r.tous.filter((t) => t.etat === 'fini').length);
      maxMem = Math.max(maxMem, r.dessinateur.tailleMemoire);
      const sp = r.echantillon(s + 6);
      for (const lat of [-30, 0, 30]) expect(Number.isFinite(r.sol.heightAt(sp.x + sp.nx * lat, sp.z + sp.nz * lat))).toBe(true);
      expect(r.pret(s)).toBe(true);
    }
    expect(maxTous).toBeLessThanOrEqual(20);
    expect(maxTerrains).toBeLessThanOrEqual(18);
    expect(maxFinis).toBeLessThanOrEqual(6);
    expect(maxMem).toBeLessThan(12000);
    // coût moyen d'un tronçon (route + terrain + décor) : 160 m par pas, donc deux pas par tronçon
    temps.sort((a, b) => a - b);
    const med = temps[temps.length >> 1] * 2;
    // le travail est découpé en petites étapes (une par appel) : aucune ne doit bloquer une image
    etapes.sort((a, b) => a - b);
    const p99 = etapes[Math.floor(etapes.length * 0.99)];
    console.log(`Zen : ~${med.toFixed(1)} ms de calcul par tronçon de ${LONGUEUR_TRONCON} m (médiane), ${etapes.length} étapes, médiane ${etapes[etapes.length >> 1].toFixed(2)} ms, 99 % < ${p99.toFixed(2)} ms, max ${etapes[etapes.length - 1].toFixed(1)} ms`);
    expect(med).toBeLessThan(150);
    expect(p99).toBeLessThan(15);
  }, 180_000);

  it('décor déterministe : même graine ⇒ même décor, quel que soit le chemin pour y arriver', () => {
    const a = new RouteZen(77);
    a.viser(0); a.toutFaire();
    for (let s = 0; s <= 4000; s += 400) { a.viser(s); a.toutFaire(); }
    const b = new RouteZen(77);
    b.viser(4000); b.toutFaire(); // téléportation directe
    const n = RouteZen.indice(4000) + 1;
    const pa = a.troncon(n)!.parties!, pb = b.troncon(n)!.parties!;
    expect(pa.map((p) => p.theme)).toEqual(pb.map((p) => p.theme));
    expect(pa.map((p) => empreinte(p.env))).toEqual(pb.map((p) => empreinte(p.env)));
    expect(pa.reduce((x, p) => x + p.env.items.length, 0)).toBeGreaterThan(50);
  }, 60_000);

  it('décor : rien sur la route, chaque objet chez un seul tronçon, fondu entre deux décors', () => {
    const r = new RouteZen(8);
    const reg = r.regions.region(0);
    r.viser(reg.fin);
    r.toutFaire();
    const n = RouteZen.indice(reg.fin);
    const t = r.troncon(n)!;
    expect(t.themes).toEqual([reg.theme, r.regions.region(1).theme]);
    const cles = new Set<string>();
    for (const tt of r.tous) {
      for (const p of tt.parties ?? []) {
        for (const it of p.env.items) {
          const near = r.sol.plusProche(it.x, it.z, 20);
          if (near) expect(near.dist).toBeGreaterThan(near.w + 1.5);
          const k = `${it.kind}:${Math.round(it.x * 10)}:${Math.round(it.z * 10)}`;
          expect(cles.has(k)).toBe(false);
          cles.add(k);
        }
      }
    }
  }, 60_000);
});

describe('Zen : conduite', () => {
  it('pilote automatique : 3 km de route générée sans chute, sans NaN, au sol', () => {
    const route = new RouteZen(4242);
    route.viser(0);
    route.toutFaire();
    const sim = new ZenSim(route, CARS.equilibree, MODES.semi);
    let replaces = 0, regions = 0;
    for (let step = 0; step < 120 * 400 && sim.maxProgressS < 3000; step++) {
      if (step % 120 === 0) { route.viser(sim.progressS); route.toutFaire(); }
      const car = sim.car;
      const cible = route.echantillon(sim.progressS + 8 + car.speed * 0.5);
      const err = wrapAngle(Math.atan2(cible.x - car.x, cible.z - car.z) - car.heading);
      let kMax = 0;
      for (let d = 0; d < 50; d += 5) kMax = Math.max(kMax, Math.abs(route.echantillon(sim.progressS + d).k));
      const v = clamp(Math.sqrt(5 / Math.max(kMax, 1e-4)), 8, 24);
      const ev = sim.step({ gaz: car.speed < v ? 1 : 0, frein: car.speed > v + 3 ? 1 : 0, direction: clamp(err * 2.5, -1, 1), freinAMain: false });
      for (const e of ev) { if (e.type === 'replace') replaces++; if (e.type === 'region') regions++; }
      expect(Number.isFinite(car.x + car.y + car.z + car.heading)).toBe(true);
      if (step % 60 === 0) expect(Math.abs(car.y - route.sol.heightAt(car.x, car.z))).toBeLessThan(1e-6);
    }
    expect(sim.maxProgressS).toBeGreaterThanOrEqual(3000);
    expect(replaces).toBeLessThanOrEqual(2);
    expect(sim.hud().distance).toBeGreaterThan(2990);
    void regions;
    void SIM_DT;
  }, 120_000);
});
