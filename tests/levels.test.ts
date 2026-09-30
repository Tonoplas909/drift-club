import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from '../src/levels';
import { loadLevel } from '../src/core/loadLevel';
import { Terrain } from '../src/core/track/terrain';
import { generateEnvironment } from '../src/core/env/generate';
import type { TrackData } from '../src/core/track/buildTrack';

const IDS = [
  'premiers-virages', 'foret-des-pins', 'col-du-loup', 'lacets-du-belvedere', 'vallee-des-cretes',
  'circuit-du-lac', 'epingles-du-diable', 'cretes-nord', 'descente-du-moulin', 'grand-huit',
];

function charge(id: string) {
  const n = NIVEAUX_OFFICIELS.find((x) => x.id === id);
  if (!n) throw new Error(`niveau inconnu : ${id}`);
  const r = loadLevel(n.data);
  if (!r.ok) throw new Error(r.erreurs.join('\n'));
  return r;
}

/** Rayon de courbure (m) de chaque échantillon. */
const rayons = (t: TrackData): number[] => t.samples.map((s) => (Math.abs(s.k) > 1e-9 ? 1 / Math.abs(s.k) : Infinity));

/** Nombre de virages distincts (séquences d'au moins 5 échantillons) de rayon inférieur au seuil. */
function virages(t: TrackData, seuil: number): number {
  let n = 0, run = 0;
  for (const r of rayons(t)) {
    if (r < seuil) run++;
    else { if (run >= 5) n++; run = 0; }
  }
  if (run >= 5) n++;
  return n;
}

const minRayon = (t: TrackData): number => Math.min(...rayons(t));
const denivele = (t: TrackData): number => { const y = t.samples.map((s) => s.y); return Math.max(...y) - Math.min(...y); };

/** Point de la piste à l'abscisse normalisée u (0 à 1). */
function pointNormalise(t: TrackData, u: number): { x: number; z: number } {
  const s = t.samples[Math.min(t.samples.length - 1, Math.round(u * (t.samples.length - 1)))];
  return { x: s.x, z: s.z };
}

describe('niveaux officiels', () => {
  it('dix niveaux dans le bon ordre, identifiants uniques', () => {
    expect(NIVEAUX_OFFICIELS.map((n) => n.id)).toEqual(IDS);
    expect(new Set(NIVEAUX_OFFICIELS.map((n) => n.id)).size).toBe(10);
    expect(cleNiveauOfficiel('col-du-loup')).toBe('off:col-du-loup');
  });
  const AVEC_BARRIERES = ['col-du-loup', 'lacets-du-belvedere', 'vallee-des-cretes', 'epingles-du-diable', 'cretes-nord', 'descente-du-moulin'];
  for (const n of NIVEAUX_OFFICIELS) {
    it(`${n.id} : valide, bonne longueur, décor généré`, () => {
      const r = loadLevel(n.data);
      if (!r.ok) throw new Error(r.erreurs.join('\n'));
      expect(r.track.length).toBeGreaterThan(900);
      expect(r.track.length).toBeLessThan(2100);
      expect(r.track.targetTime).toBeGreaterThan(35);
      expect(r.track.targetTime).toBeLessThan(150);
      const terrain = new Terrain(r.track, r.level.decor.graine);
      const env = generateEnvironment(r.level, r.track, terrain);
      expect(env.items.length).toBeGreaterThan(300);
      if (AVEC_BARRIERES.includes(n.id)) expect(env.segments.length).toBeGreaterThan(0);
    });
  }

  it('graines de décor uniques', () => {
    const graines = NIVEAUX_OFFICIELS.map((n) => (n.data as { decor: { graine: number } }).decor.graine);
    expect(new Set(graines).size).toBe(graines.length);
  });

  it('aucun doublon : chaque niveau a sa propre géométrie', () => {
    const pistes = NIVEAUX_OFFICIELS.map((n) => ({ id: n.id, t: charge(n.id).track }));
    for (let i = 0; i < pistes.length; i++) {
      for (let j = i + 1; j < pistes.length; j++) {
        const a = pistes[i], b = pistes[j];
        const ecartLongueur = Math.abs(a.t.length - b.t.length);
        // distance moyenne entre points de même abscisse normalisée, après translation du départ à l'origine
        const a0 = pointNormalise(a.t, 0), b0 = pointNormalise(b.t, 0);
        let somme = 0;
        const N = 200;
        for (let k = 0; k <= N; k++) {
          const pa = pointNormalise(a.t, k / N), pb = pointNormalise(b.t, k / N);
          somme += Math.hypot(pa.x - a0.x - (pb.x - b0.x), pa.z - a0.z - (pb.z - b0.z));
        }
        const ecartMoyen = somme / (N + 1);
        expect(ecartLongueur > 20 || ecartMoyen > 10, `${a.id} et ${b.id} sont trop semblables`).toBe(true);
      }
    }
  });

  it('circuit-du-lac : longs virages larges, très peu de dénivelé, départ et arrivée séparés', () => {
    const { track: t, level } = charge('circuit-du-lac');
    expect(level.ambiance).toBe('jour');
    expect(level.route[0].l).toBe(14);
    expect(minRayon(t)).toBeGreaterThan(35);
    expect(virages(t, 50)).toBe(0);
    expect(denivele(t)).toBeLessThan(12);
    const d = Math.hypot(t.samples[0].x - t.samples[t.samples.length - 1].x, t.samples[0].z - t.samples[t.samples.length - 1].z);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(250);
  });

  it('epingles-du-diable : au moins 7 épingles serrées et une grosse montée, barrières extérieures', () => {
    const { track: t, level } = charge('epingles-du-diable');
    expect(level.ambiance).toBe('coucher');
    expect(level.route[0].l).toBe(8.5);
    expect(virages(t, 20)).toBeGreaterThanOrEqual(7);
    expect(t.samples[t.samples.length - 1].y - t.samples[0].y).toBeGreaterThanOrEqual(100);
    expect(level.barrieres.length).toBeGreaterThanOrEqual(8);
    expect(level.barrieres.every((b) => b.cote === 'ext')).toBe(true);
  });

  it('cretes-nord : longue crête, virages rapides et trois épingles moyennes', () => {
    const { track: t, level } = charge('cretes-nord');
    expect(level.route[0].l).toBe(11.5);
    expect(t.length).toBeGreaterThan(1850);
    expect(virages(t, 30)).toBeGreaterThanOrEqual(3);
    expect(virages(t, 30)).toBeLessThanOrEqual(5);
    expect(virages(t, 150)).toBeGreaterThanOrEqual(6);
    expect(denivele(t)).toBeGreaterThan(40);
    expect(denivele(t)).toBeLessThan(80);
  });

  it('descente-du-moulin : descente d\'au moins 60 m, chicanes techniques', () => {
    const { track: t, level } = charge('descente-du-moulin');
    expect(level.ambiance).toBe('coucher');
    expect(level.route[0].l).toBe(10);
    expect(t.samples[0].y - t.samples[t.samples.length - 1].y).toBeGreaterThanOrEqual(60);
    expect(t.samples[0].y).toBeGreaterThanOrEqual(95);
    expect(virages(t, 45)).toBeGreaterThanOrEqual(12);
  });

  it('grand-huit : serpent de dix virages alternés, dénivelé vallonné', () => {
    const { track: t, level } = charge('grand-huit');
    expect(level.route[0].l).toBe(12);
    const signes: number[] = [];
    let run = 0, sens = 0;
    for (const s of t.samples) {
      const r = Math.abs(s.k) > 1e-9 ? 1 / Math.abs(s.k) : Infinity;
      if (r < 55) { run++; sens = Math.sign(s.k); }
      else { if (run >= 8) signes.push(sens); run = 0; }
    }
    if (run >= 8) signes.push(sens);
    expect(signes.length).toBe(10);
    for (let i = 1; i < signes.length; i++) expect(signes[i]).toBe(-signes[i - 1]);
    expect(denivele(t)).toBeGreaterThan(15);
    expect(denivele(t)).toBeLessThan(35);
  });
});
