import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/core/math/rng';
import { RARETES, RARETE_IDS, formatPoids } from '../../src/core/raretes';
import { SKINS, SKIN_DEFAUT } from '../../src/core/skins';
import { FUMEES } from '../../src/core/fumees';
import { CAR_IDS } from '../../src/core/physics/cars';
import { catalogue, contenuCaisses, construireBande, objetsDeRarete, tirer, tirerObjet, tirerRarete, INDEX_GAGNANT, TAILLE_BANDE, estDebloque } from '../../src/core/caisses';

describe('raretés', () => {
  it('les poids valent 100 % (79,9 / 16 / 3,2 / 0,64 / 0,26)', () => {
    expect(RARETE_IDS.reduce((s, r) => s + RARETES[r].poids, 0)).toBeCloseTo(100, 9);
    expect(RARETE_IDS.map((r) => RARETES[r].poids)).toEqual([79.9, 16, 3.2, 0.64, 0.26]);
  });
  it('libellés français et couleurs #rrggbb', () => {
    expect(RARETE_IDS.map((r) => RARETES[r].nom)).toEqual(['Commune', 'Rare', 'Épique', 'Légendaire', 'Exotique']);
    for (const r of RARETE_IDS) expect(RARETES[r].couleur).toMatch(/^#[0-9a-f]{6}$/i);
  });
  it('formatPoids : virgule française', () => {
    expect(formatPoids(79.9)).toBe('79,9 %');
    expect(formatPoids(16)).toBe('16 %');
  });
});

describe('catalogue', () => {
  it('toutes les livrées de toutes les voitures et toutes les fumées, sauf « unie » et « classique »', () => {
    const c = catalogue();
    const attendu = CAR_IDS.reduce((n, car) => n + SKINS[car].length - 1, 0) + FUMEES.length - 1;
    expect(c).toHaveLength(attendu);
    expect(c.some((o) => o.skin === SKIN_DEFAUT)).toBe(false);
    expect(new Set(c.map((o) => `${o.car}/${o.skin}`)).size).toBe(c.length);
    for (const car of CAR_IDS) expect(c.some((o) => o.car === car)).toBe(true);
  });
  it('chaque voiture a au moins 12 livrées, ids et raretés valides', () => {
    for (const car of CAR_IDS) {
      const l = SKINS[car];
      expect(l.length).toBeGreaterThanOrEqual(12);
      expect(new Set(l.map((s) => s.id)).size).toBe(l.length);
      for (const s of l) expect(RARETE_IDS).toContain(s.rarete);
    }
    for (const r of RARETE_IDS) expect(objetsDeRarete(r).length).toBeGreaterThan(0);
  });
});

describe('tirer', () => {
  it('déterministe avec un rng à graine', () => {
    const a = tirer(mulberry32(42), {}), b = tirer(mulberry32(42), {});
    expect(a).toEqual(b);
    const suite = (g: number) => { const r = mulberry32(g); return Array.from({ length: 20 }, () => tirerObjet(r)); };
    expect(suite(1)).toEqual(suite(1));
    expect(suite(1)).not.toEqual(suite(2));
  });
  it('fréquences par rareté sur 100 000 tirages proches des poids', () => {
    const rng = mulberry32(2026), N = 100_000, n = { commune: 0, rare: 0, epique: 0, legendaire: 0, exotique: 0 };
    for (let i = 0; i < N; i++) n[tirerRarete(rng)]++;
    for (const r of RARETE_IDS) {
      const p = RARETES[r].poids / 100, attendu = N * p, sigma = Math.sqrt(N * p * (1 - p));
      expect(Math.abs(n[r] - attendu)).toBeLessThan(5 * sigma + 1);
    }
  });
  it('à l\'intérieur d\'une rareté, uniforme sur les livrées', () => {
    const rng = mulberry32(5), N = 60_000, cpt = new Map<string, number>();
    const rares = objetsDeRarete('rare');
    for (let i = 0; i < N; i++) { const o = tirerObjet(rng); if (o.rarete === 'rare') cpt.set(`${o.car}/${o.skin}`, (cpt.get(`${o.car}/${o.skin}`) ?? 0) + 1); }
    const total = [...cpt.values()].reduce((s, v) => s + v, 0);
    expect(cpt.size).toBe(rares.length);
    for (const v of cpt.values()) expect(Math.abs(v / total - 1 / rares.length)).toBeLessThan(0.02);
  });
  it('le tirage porte sa rareté et sa voiture, et signale les doublons', () => {
    const rng = mulberry32(9);
    const t = tirer(rng, {});
    expect(t.doublon).toBe(false);
    expect(contenuCaisses()[t.objet.car].find((s) => s.id === t.objet.skin)!.rarete).toBe(t.objet.rarete);
    const inv = { [t.objet.car]: [t.objet.skin] };
    expect(tirer(mulberry32(9), inv).doublon).toBe(true);
    expect(estDebloque(inv, t.objet.car, t.objet.skin)).toBe(true);
    expect(estDebloque({}, 'turbo', SKIN_DEFAUT)).toBe(true);
    expect(estDebloque({}, 'turbo', 'carbone')).toBe(false);
  });
  it('rareté vide : ignorée, poids renormalisés (rng extrême renvoie toujours une livrée)', () => {
    for (const x of [0, 0.5, 0.999999, 0.9999999999]) expect(catalogue()).toContainEqual(tirerObjet(() => x));
  });
});

describe('construireBande', () => {
  const gagnant = { car: 'turbo' as const, skin: 'or', rarete: 'exotique' as const };
  it('longueur 60, gagnant à l\'index fixe près de la fin', () => {
    const b = construireBande(mulberry32(1), gagnant);
    expect(b).toHaveLength(TAILLE_BANDE);
    expect(b[INDEX_GAGNANT]).toBe(gagnant);
    expect(INDEX_GAGNANT).toBeGreaterThan(TAILLE_BANDE - 12);
    expect(INDEX_GAGNANT).toBeLessThan(TAILLE_BANDE - 3);
  });
  it('taille et index personnalisés, index borné', () => {
    const b = construireBande(mulberry32(1), gagnant, 30, 22);
    expect(b).toHaveLength(30);
    expect(b[22]).toBe(gagnant);
    expect(construireBande(mulberry32(1), gagnant, 10, 99)[9]).toBe(gagnant);
  });
  it('remplissage tiré selon les poids et déterministe', () => {
    const a = construireBande(mulberry32(3), gagnant), b = construireBande(mulberry32(3), gagnant);
    expect(a).toEqual(b);
    const communes = a.filter((o) => o.rarete === 'commune').length;
    expect(communes).toBeGreaterThan(TAILLE_BANDE * 0.5);
    for (const o of a) expect(catalogue()).toContainEqual(o);
  });
});
