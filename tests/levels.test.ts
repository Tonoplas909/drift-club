import { describe, it, expect } from 'vitest';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from '../src/levels';
import { loadLevel } from '../src/core/loadLevel';
import { Terrain } from '../src/core/track/terrain';
import { generateEnvironment } from '../src/core/env/generate';
import type { TrackData } from '../src/core/track/buildTrack';

const IDS = [
  'premiers-virages', 'foret-des-pins', 'col-du-loup', 'lacets-du-belvedere', 'vallee-des-cretes',
  'circuit-du-lac', 'epingles-du-diable', 'cretes-nord', 'descente-du-moulin', 'grand-huit',
  'serpentin-des-aigles', 'angles-droits', 'spirale-du-belvedere', 'trois-epingles', 'chicanes-du-port',
  'grande-descente', 'virages-en-cascade', 'route-des-vignes', 'touge-de-minuit', 'tire-bouchon',
  'sentier-des-cerisiers', 'col-du-torii', 'dragon-de-jade', 'baie-des-naufrages', 'crique-du-perroquet',
  'recif-du-kraken', 'orbite-basse', 'cratere-rouge', 'couloirs-jaunes', 'labyrinthe-de-neons',
  'neo-shinjuku',
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

interface Groupe { angle: number; rmin: number; de: number; a: number }

/**
 * Virages : suites d'échantillons de même sens dont le rayon est inférieur au seuil (au moins 5 échantillons).
 * Deux virages de même sens séparés d'au plus `ecart` mètres sont fusionnés. `angle` est en degrés (signé, + = gauche).
 */
function groupes(t: TrackData, seuil: number, ecart = 0): Groupe[] {
  const S = t.samples, out: Groupe[] = [];
  let i = 0;
  while (i < S.length) {
    if (!(Math.abs(S[i].k) > 1e-9 && 1 / Math.abs(S[i].k) < seuil)) { i++; continue; }
    const sens = Math.sign(S[i].k);
    let j = i, angle = 0, rmin = Infinity, n = 0;
    let fin = i;
    while (j < S.length) {
      const r = Math.abs(S[j].k) > 1e-9 ? 1 / Math.abs(S[j].k) : Infinity;
      if (r < seuil && Math.sign(S[j].k) === sens) { angle += S[j].k * (S[j + 1] ? S[j + 1].s - S[j].s : 1); rmin = Math.min(rmin, r); n++; fin = j; j++; }
      else if (S[j].s - S[fin].s <= ecart && r >= seuil) j++;
      else break;
    }
    if (n >= 5) out.push({ angle: (angle * 180) / Math.PI, rmin, de: i, a: fin });
    i = Math.max(j, i + 1);
  }
  return out;
}

/** Point de la piste à l'abscisse normalisée u (0 à 1). */
function pointNormalise(t: TrackData, u: number): { x: number; z: number } {
  const s = t.samples[Math.min(t.samples.length - 1, Math.round(u * (t.samples.length - 1)))];
  return { x: s.x, z: s.z };
}

describe('niveaux officiels', () => {
  it('trente et un niveaux dans le bon ordre, identifiants uniques', () => {
    expect(NIVEAUX_OFFICIELS.map((n) => n.id)).toEqual(IDS);
    expect(new Set(NIVEAUX_OFFICIELS.map((n) => n.id)).size).toBe(31);
    expect(cleNiveauOfficiel('col-du-loup')).toBe('off:col-du-loup');
  });
  const AVEC_BARRIERES = ['col-du-loup', 'lacets-du-belvedere', 'vallee-des-cretes', 'epingles-du-diable', 'cretes-nord', 'descente-du-moulin',
    'serpentin-des-aigles', 'spirale-du-belvedere', 'trois-epingles', 'virages-en-cascade', 'touge-de-minuit', 'tire-bouchon'];
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

  it('serpentin-des-aigles : montée de 100 m, quatre épingles étirées et des virages moyens', () => {
    const { track: t, level } = charge('serpentin-des-aigles');
    expect(level.route[0].l).toBe(9);
    expect(t.samples[t.samples.length - 1].y - t.samples[0].y).toBeGreaterThanOrEqual(95);
    const epingles = groupes(t, 40, 30).filter((g) => Math.abs(g.angle) > 150);
    expect(epingles.length).toBe(4);
    expect(groupes(t, 90).filter((g) => g.rmin >= 40).length).toBeGreaterThanOrEqual(6);
  });

  it('angles-droits : au moins huit angles droits, route plate en ville', () => {
    const { track: t, level } = charge('angles-droits');
    expect(level.environnement).toBe('ville');
    expect(groupes(t, 40).filter((g) => Math.abs(g.angle) >= 70 && Math.abs(g.angle) <= 110).length).toBeGreaterThanOrEqual(8);
    expect(denivele(t)).toBeLessThan(6);
    expect(minRayon(t)).toBeGreaterThan(9);
  });

  it('spirale-du-belvedere : spirale de plus d\'un tour et demi dont le rayon diminue, puis sortie', () => {
    const { track: t } = charge('spirale-du-belvedere');
    const g = groupes(t, 130, 15).filter((x) => Math.abs(x.angle) >= 480);
    expect(g.length).toBe(2);
    const [entree, sortie] = g;
    // bras d'entrée : le rayon diminue ; bras de sortie (sens inverse) : il augmente
    const moy = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const moyennes = (x: Groupe) => {
      const r = rayons(t).slice(x.de, x.a + 1);
      const tiers = Math.floor(r.length / 3);
      return [moy(r.slice(0, tiers)), moy(r.slice(-tiers))];
    };
    const [e0, e1] = moyennes(entree), [s0, s1] = moyennes(sortie);
    expect(e0).toBeGreaterThan(e1 * 1.5);
    expect(s1).toBeGreaterThan(s0 * 1.5);
    expect(Math.sign(entree.angle)).toBe(-Math.sign(sortie.angle));
    // la sortie est une longue ligne droite après le dernier virage
    expect(t.length - t.samples[sortie.a].s).toBeGreaterThan(150);
  });

  it('trois-epingles : exactement trois grandes épingles, longues lignes rapides, grosse montée', () => {
    const { track: t } = charge('trois-epingles');
    const ep = groupes(t, 30);
    expect(ep.length).toBe(3);
    for (const g of ep) { expect(Math.abs(g.angle)).toBeGreaterThan(150); expect(g.rmin).toBeGreaterThan(17); }
    expect(t.samples[t.samples.length - 1].y - t.samples[0].y).toBeGreaterThanOrEqual(100);
    expect(virages(t, 150)).toBe(3);
    // au moins trois lignes droites de 150 m entre les épingles
    for (let i = 1; i < ep.length; i++) expect(t.samples[ep[i].de].s - t.samples[ep[i - 1].a].s).toBeGreaterThan(150);
  });

  it('chicanes-du-port : beaucoup de chicanes serrées, route plate en ville', () => {
    const { track: t, level } = charge('chicanes-du-port');
    expect(level.environnement).toBe('ville');
    expect(virages(t, 30)).toBeGreaterThanOrEqual(20);
    expect(denivele(t)).toBeLessThan(4);
    expect(minRayon(t)).toBeGreaterThan(9);
  });

  it('grande-descente : environ 2 km, au moins 120 m de descente, virages fluides', () => {
    const { track: t } = charge('grande-descente');
    expect(t.length).toBeGreaterThan(1800);
    expect(t.samples[0].y - t.samples[t.samples.length - 1].y).toBeGreaterThanOrEqual(120);
    expect(minRayon(t)).toBeGreaterThan(35);
  });

  it('virages-en-cascade : deux séries de virages qui se resserrent, côtés alternés', () => {
    const { track: t } = charge('virages-en-cascade');
    const g = groupes(t, 140).filter((x) => Math.abs(x.angle) >= 45);
    expect(g.length).toBeGreaterThanOrEqual(12);
    let resserres = 0;
    for (let i = 1; i < g.length; i++) {
      expect(Math.sign(g[i].angle)).toBe(-Math.sign(g[i - 1].angle));
      if (g[i].rmin < g[i - 1].rmin) resserres++;
    }
    expect(resserres).toBeGreaterThanOrEqual(10);
    expect(minRayon(t)).toBeLessThan(15);
  });

  it('route-des-vignes : large, débutants, aucun virage sous 40 m de rayon', () => {
    const { track: t, level } = charge('route-des-vignes');
    expect(level.route[0].l).toBeGreaterThanOrEqual(14);
    expect(minRayon(t)).toBeGreaterThanOrEqual(40);
    expect(denivele(t)).toBeLessThan(25);
  });

  it('touge-de-minuit : de nuit, longs virages rapides et une seule épingle, à la fin', () => {
    const { track: t, level } = charge('touge-de-minuit');
    expect(level.ambiance).toBe('nuit');
    const serres = groupes(t, 25);
    expect(serres.length).toBe(1);
    expect(t.samples[serres[0].de].s).toBeGreaterThan(t.length * 0.9);
    expect(Math.abs(serres[0].angle)).toBeGreaterThan(150);
    const avant = t.samples.filter((s) => s.s < t.samples[serres[0].de].s - 20);
    expect(Math.min(...avant.map((s) => (Math.abs(s.k) > 1e-9 ? 1 / Math.abs(s.k) : Infinity)))).toBeGreaterThan(50);
  });

  it('tire-bouchon : environ 270° de virages de même sens en descendant, puis sens inverse', () => {
    const { track: t } = charge('tire-bouchon');
    const g = groupes(t, 130, 20);
    const vis = g.sort((a, b) => Math.abs(b.angle) - Math.abs(a.angle))[0];
    expect(Math.abs(vis.angle)).toBeGreaterThanOrEqual(250);
    expect(Math.abs(vis.angle)).toBeLessThanOrEqual(300);
    expect(t.samples[0].y - t.samples[t.samples.length - 1].y).toBeGreaterThanOrEqual(70);
    // ensuite, le premier virage suivant tourne dans l'autre sens
    const suivant = groupes(t, 130, 20).filter((x) => x.de > vis.a)[0];
    expect(Math.sign(suivant.angle)).toBe(-Math.sign(vis.angle));
  });
});
