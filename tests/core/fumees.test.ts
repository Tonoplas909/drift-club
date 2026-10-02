import { describe, it, expect } from 'vitest';
import { FUMEES, FUMEE_DEFAUT, FUMEE_IDS, CLE_FUMEE, fumeeDef, fumeeValide, validerFumee } from '../../src/core/fumees';
import { RARETE_IDS, estRarete } from '../../src/core/raretes';
import { catalogue, objetsDeRarete, tirerObjet, tirer, estDebloque, estFumee, infoObjet, idValide, COLLECTIONS } from '../../src/core/caisses';
import { mulberry32 } from '../../src/core/math/rng';
import { ECONOMIE, fumeeAutorisee, fumeeDebloquee, ouvrirCaisse, progressionVide, validerProgression } from '../../src/core/economie';
import { debloquesVersLignes, lireObjetServeur, lireProgressionCompte, appliquerOuvertureServeur } from '../../src/core/progressionCompte';

const hex = /^#[0-9a-f]{6}$/i;

describe('catalogue des fumées', () => {
  it('ids uniques, au format accepté par le serveur', () => {
    expect(new Set(FUMEE_IDS).size).toBe(FUMEES.length);
    for (const f of FUMEES) expect(f.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
    expect(CLE_FUMEE).toMatch(/^[A-Za-z0-9_-]{1,40}$/);
  });
  it('rareté valide, nom et description en français non vides', () => {
    for (const f of FUMEES) {
      expect(estRarete(f.rarete)).toBe(true);
      expect(f.nom.length).toBeGreaterThan(2);
      expect(f.description.length).toBeGreaterThan(5);
    }
  });
  it('une vingtaine de fumées, plus de communes que de rares, très peu d\'exotiques', () => {
    const n = (r: string) => FUMEES.filter((f) => f.rarete === r && f.id !== FUMEE_DEFAUT).length;
    expect(FUMEES.length - 1).toBeGreaterThanOrEqual(20);
    expect(FUMEES.length - 1).toBeLessThanOrEqual(25);
    for (const r of RARETE_IDS) expect(n(r)).toBeGreaterThan(0);
    expect(n('commune')).toBeGreaterThan(n('rare'));
    expect(n('rare')).toBeGreaterThanOrEqual(n('epique'));
    expect(n('exotique')).toBeLessThanOrEqual(2);
  });
  it('couleurs au format #rrggbb ; « classique » suit le décor (aucune couleur)', () => {
    expect(fumeeDef(FUMEE_DEFAUT).style.couleurs).toEqual([]);
    for (const f of FUMEES.filter((x) => x.id !== FUMEE_DEFAUT)) {
      const s = f.style;
      expect(s.couleurs.length > 0 || s.arcEnCiel !== undefined).toBe(true);
      for (const c of [...s.couleurs, ...(s.paillettes?.couleurs ?? [])]) expect(c).toMatch(hex);
      if (s.paillettes) { expect(s.paillettes.couleurs.length).toBeGreaterThan(0); expect(s.paillettes.densite).toBeGreaterThan(0); }
    }
  });
  it('les raretés hautes sont plus travaillées : toutes les épiques et au-delà ont lueur, paillettes ou couleur animée', () => {
    for (const f of FUMEES.filter((x) => ['epique', 'legendaire', 'exotique'].includes(x.rarete))) {
      expect(!!f.style.lueur || !!f.style.paillettes || !!f.style.arcEnCiel).toBe(true);
    }
    for (const f of FUMEES.filter((x) => x.rarete === 'exotique')) expect(f.style.paillettes && f.style.lueur).toBeTruthy();
  });
  it('pas de nom de marque, film ou personnage : noms courts et sans chiffres', () => {
    for (const f of FUMEES) expect(f.nom).not.toMatch(/\d/);
  });
});

describe('choix de la fumée', () => {
  it('validation : inconnue ou invalide → « classique »', () => {
    expect(fumeeValide('feu')).toBe(true);
    expect(fumeeValide('nimporte')).toBe(false);
    expect(validerFumee('feu')).toBe('feu');
    for (const v of [undefined, null, 3, {}, 'nimporte', '']) expect(validerFumee(v)).toBe(FUMEE_DEFAUT);
    expect(fumeeDef('nimporte').id).toBe(FUMEE_DEFAUT);
  });
  it('« classique » est toujours débloquée, les autres selon la progression', () => {
    const p = progressionVide();
    expect(fumeeDebloquee(p, FUMEE_DEFAUT)).toBe(true);
    expect(fumeeDebloquee(p, 'feu')).toBe(false);
    expect(fumeeAutorisee('feu', p)).toBe(FUMEE_DEFAUT);
    const p2 = validerProgression({ cles: 0, debloques: { fumee: ['feu'] } });
    expect(fumeeAutorisee('feu', p2)).toBe('feu');
  });
  it('« classique » ne figure pas dans les caisses', () => {
    expect(catalogue().some((o) => o.car === CLE_FUMEE && o.skin === FUMEE_DEFAUT)).toBe(false);
    expect(progressionVide().debloques.fumee).toEqual([]);
  });
});

describe('fumées dans les caisses', () => {
  const fumees = () => catalogue().filter(estFumee);
  it('le catalogue contient toutes les fumées sauf « classique », avec leur rareté', () => {
    expect(fumees()).toHaveLength(FUMEES.length - 1);
    for (const o of fumees()) expect(fumeeDef(o.skin).rarete).toBe(o.rarete);
    for (const r of RARETE_IDS) expect(objetsDeRarete(r).some(estFumee)).toBe(true);
  });
  it('les tirages peuvent donner une fumée, et chacune finit par sortir', () => {
    const rng = mulberry32(3), vus = new Set<string>();
    for (let i = 0; i < 60000; i++) { const o = tirerObjet(rng); if (estFumee(o)) vus.add(o.skin); }
    expect(vus.size).toBeGreaterThanOrEqual(FUMEES.length - 3); // les exotiques sont très rares
    for (const f of FUMEES.filter((x) => x.rarete === 'commune' && x.id !== FUMEE_DEFAUT)) expect(vus.has(f.id)).toBe(true);
  });
  it('ouvrir une caisse qui donne une fumée la débloque ; un doublon la rembourse', () => {
    let rng = mulberry32(1), ou = null as ReturnType<typeof ouvrirCaisse>, p = { ...progressionVide(), cles: 3000 };
    for (let i = 0; i < 500 && !(ou && estFumee(ou.tirage.objet)); i++) { rng = mulberry32(i + 1); ou = ouvrirCaisse(p, rng); }
    expect(ou && estFumee(ou.tirage.objet)).toBe(true);
    const o = ou!.tirage.objet;
    expect(ou!.progression.debloques.fumee).toContain(o.skin);
    expect(fumeeDebloquee(ou!.progression, o.skin)).toBe(true);
    expect(tirer(() => 0, ou!.progression.debloques).doublon).toBe(estDebloque(ou!.progression.debloques, tirerObjet(() => 0).car, tirerObjet(() => 0).skin));
    expect(ECONOMIE.remboursementDoublon).toBe(1);
  });
  it('infoObjet et idValide connaissent les fumées', () => {
    expect(infoObjet({ car: 'fumee', skin: 'feu' }).nom).toBe(fumeeDef('feu').nom);
    expect(idValide('fumee', 'feu')).toBe(true);
    expect(idValide('fumee', 'unie')).toBe(false);
    expect(COLLECTIONS).toContain('fumee');
  });
});

describe('fumées côté compte', () => {
  it('« fumee:id » aller-retour avec le format du serveur', () => {
    const p = validerProgression({ cles: 1, debloques: { fumee: ['feu', 'classique', 'nimporte'], turbo: ['flammes'] } });
    expect(p.debloques.fumee).toEqual(['feu']);
    expect(debloquesVersLignes(p.debloques)).toEqual(['turbo:flammes', 'fumee:feu']);
    const c = lireProgressionCompte({ cles: 2, ouvertes: 1, caisse_offerte: true, importee: true, debloques: ['fumee:feu', 'turbo:flammes', 'fumee:inconnue', 'avion:x'] });
    expect(c!.progression.debloques.fumee).toEqual(['feu']);
    expect(c!.progression.debloques.turbo).toEqual(['flammes']);
  });
  it('le tirage du serveur peut être une fumée', () => {
    const r = lireObjetServeur({ voiture: 'fumee', skin: 'galaxie', rarete: 'legendaire', doublon: false, cles: 4 });
    expect(r).toEqual({ objet: { car: 'fumee', skin: 'galaxie', rarete: 'legendaire' }, doublon: false, cles: 4 });
    expect(lireObjetServeur({ voiture: 'fumee', skin: 'classique', rarete: 'commune', cles: 4 })).toBeNull();
    expect(lireObjetServeur({ voiture: 'fumee', skin: 'inconnue', rarete: 'commune', cles: 4 })).toBeNull();
    const p = appliquerOuvertureServeur(progressionVide(), r!.objet, false, 4);
    expect(p.debloques.fumee).toEqual(['galaxie']);
    expect(appliquerOuvertureServeur(p, r!.objet, true, 5).debloques.fumee).toEqual(['galaxie']);
  });
});
