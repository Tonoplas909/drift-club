import { describe, it, expect } from 'vitest';
import {
  appliquerOuvertureServeur, choisirProgression, debloquesVersLignes, donneesImport, doitImporter, gainServeur,
  lireObjetServeur, lireProgressionCompte, PLAFOND_CLES_IMPORT, type EtatProgressionCompte,
} from '../../src/core/progressionCompte';
import { progressionVide, skinsAutorises, type Progression } from '../../src/core/economie';
import { INDEX_GAGNANT, TAILLE_BANDE, construireBande } from '../../src/core/caisses';
import { mulberry32 } from '../../src/core/math/rng';
import { SKINS } from '../../src/core/skins';

const local: Progression = { cles: 7, debloques: { equilibree: ['rayures'], legere: [], turbo: ['flammes'] }, caisseOfferte: true, ouvertes: 2 };
const compteProg: Progression = { cles: 12, debloques: { equilibree: [], legere: ['bande'], turbo: [] }, caisseOfferte: true, ouvertes: 5 };
const etat = (o: Partial<EtatProgressionCompte> = {}): EtatProgressionCompte => ({ id: 'u1', progression: compteProg, importee: true, synchro: 'ok', ...o });

describe('lecture de la progression du serveur', () => {
  it('convertit une ligne progressions (« voiture:skin »)', () => {
    const c = lireProgressionCompte({ joueur: 'u1', cles: 5, debloques: ['turbo:flammes', 'equilibree:rayures'], caisse_offerte: true, ouvertes: 3, importee: true, maj: 'x' });
    expect(c).toEqual({ importee: true, progression: { cles: 5, ouvertes: 3, caisseOfferte: true, debloques: { equilibree: ['rayures'], legere: [], turbo: ['flammes'] } } });
  });
  it('ignore les livrées inconnues de cette version, les valeurs abîmées et les nombres négatifs', () => {
    const c = lireProgressionCompte({ cles: '4', debloques: ['turbo:inconnue', 'bidon:x', 'turbo', 12, 'turbo:unie', 'legere:bande'], importee: false });
    expect(c?.progression.cles).toBe(4);
    expect(c?.progression.debloques).toEqual({ equilibree: [], legere: ['bande'], turbo: [] });
    expect(c?.importee).toBe(false);
    expect(lireProgressionCompte({ cles: -3 })?.progression.cles).toBe(0);
  });
  it('null si la réponse est inutilisable', () => {
    for (const v of [null, undefined, 'x', 3, [], {}]) expect(lireProgressionCompte(v)).toBeNull();
  });
});

describe('import de la progression locale', () => {
  it('envoie les livrées au format serveur et les clés', () => {
    expect(donneesImport(local)).toEqual({ debloques: ['equilibree:rayures', 'turbo:flammes'], cles: 7 });
    expect(debloquesVersLignes(progressionVide().debloques)).toEqual([]);
  });
  it("n'envoie jamais « unie » ni une livrée inconnue", () => {
    const p = { ...local, debloques: { equilibree: ['unie', 'rayures', 'nimporte'], legere: [], turbo: [] } };
    expect(debloquesVersLignes(p.debloques)).toEqual(['equilibree:rayures']);
  });
  it("n'a lieu qu'une fois : seulement si le serveur ne l'a pas marqué", () => {
    expect(doitImporter(null)).toBe(false);
    expect(doitImporter({ progression: compteProg, importee: false })).toBe(true);
    expect(doitImporter({ progression: compteProg, importee: true })).toBe(false);
  });
  it('le plafond client est le même que celui du SQL (30 clés)', () => {
    expect(PLAFOND_CLES_IMPORT).toBe(30);
  });
});

describe('progression qui fait foi', () => {
  it('non connecté : la progression locale, modifiable', () => {
    expect(choisirProgression({ idCompte: null, local, compte: etat(), serviceAbsent: false })).toEqual({ source: 'local', progression: local, lectureSeule: false });
  });
  it('connecté : celle du compte, jamais mélangée avec la locale', () => {
    const a = choisirProgression({ idCompte: 'u1', local, compte: etat(), serviceAbsent: false });
    expect(a).toEqual({ source: 'compte', progression: compteProg, lectureSeule: false });
    expect(a.progression.debloques.turbo).not.toContain('flammes');
  });
  it('connecté mais injoignable : dernière valeur connue en lecture seule', () => {
    const a = choisirProgression({ idCompte: 'u1', local, compte: etat({ synchro: 'hors-ligne' }), serviceAbsent: false });
    expect(a).toMatchObject({ source: 'compte', progression: compteProg, lectureSeule: true });
  });
  it('compte pas encore connu (ou autre compte) : progression vide en lecture seule, pas la locale', () => {
    for (const compte of [null, etat({ id: 'autre' })]) {
      expect(choisirProgression({ idCompte: 'u1', local, compte, serviceAbsent: false })).toEqual({ source: 'compte', progression: progressionVide(), lectureSeule: true });
    }
  });
  it('SQL de progression absent : on reste sur la locale', () => {
    expect(choisirProgression({ idCompte: 'u1', local, compte: null, serviceAbsent: true }).source).toBe('local');
  });
  it('les livrées équipées doivent être débloquées dans la progression active (sinon « unie »)', () => {
    const skins = { equilibree: 'rayures', legere: 'bande', turbo: 'flammes' };
    const a = choisirProgression({ idCompte: 'u1', local, compte: etat(), serviceAbsent: false });
    expect(skinsAutorises(skins, a.progression)).toEqual({ equilibree: 'unie', legere: 'bande', turbo: 'unie' });
    expect(skinsAutorises(skins, local)).toEqual({ equilibree: 'rayures', legere: 'unie', turbo: 'flammes' });
  });
});

describe('livrée tirée par le serveur', () => {
  const ligne = { voiture: 'turbo', skin: 'flammes', rarete: 'epique', doublon: false, cles: 4 };
  it('lit le résultat', () => {
    const l = lireObjetServeur(ligne);
    expect(l?.doublon).toBe(false);
    expect(l?.cles).toBe(4);
    expect(l?.objet).toEqual({ car: 'turbo', skin: 'flammes', rarete: 'epique' });
  });
  it('refuse une voiture, une livrée, une rareté ou un nombre inconnus', () => {
    for (const x of [null, {}, { ...ligne, voiture: 'fusee' }, { ...ligne, skin: 'inconnue' }, { ...ligne, skin: 'unie' }, { ...ligne, rarete: 'mythique' }, { ...ligne, cles: 'x' }]) {
      expect(lireObjetServeur(x)).toBeNull();
    }
  });
  it('applique l’ouverture : clés du serveur, livrée ajoutée (sauf doublon), +1 ouverte', () => {
    const objet = { car: 'turbo' as const, skin: 'flammes', rarete: 'epique' as const };
    const p = appliquerOuvertureServeur(compteProg, objet, false, 9);
    expect(p.cles).toBe(9);
    expect(p.debloques.turbo).toEqual(['flammes']);
    expect(p.ouvertes).toBe(compteProg.ouvertes + 1);
    expect(compteProg.debloques.turbo).toEqual([]); // entrée non modifiée
    const d = appliquerOuvertureServeur(p, objet, true, 7);
    expect(d.debloques.turbo).toEqual(['flammes']);
    expect(d.cles).toBe(7);
  });
  it('la roulette s’arrête sur la livrée du SERVEUR, à la place du gagnant', () => {
    const gagnant = lireObjetServeur({ voiture: 'legere', skin: SKINS.legere[SKINS.legere.length - 1].id, rarete: SKINS.legere[SKINS.legere.length - 1].rarete, doublon: false, cles: 0 })!.objet;
    for (const graine of [1, 2, 3]) {
      const bande = construireBande(mulberry32(graine), gagnant);
      expect(bande).toHaveLength(TAILLE_BANDE);
      expect(bande[INDEX_GAGNANT]).toEqual(gagnant);
    }
  });
});

describe('gain d’une arrivée d’après le serveur', () => {
  it('sépare arrivée et record', () => {
    expect(gainServeur(2, 1, 8)).toEqual({ arrivee: 1, record: 1, total: 8 });
    expect(gainServeur(1, 0, 4)).toEqual({ arrivee: 1, record: 0, total: 4 });
    expect(gainServeur(0, 0, 4)).toEqual({ arrivee: 0, record: 0, total: 4 });
    expect(gainServeur(1, 5, 3)).toEqual({ arrivee: 0, record: 1, total: 3 });
  });
});
