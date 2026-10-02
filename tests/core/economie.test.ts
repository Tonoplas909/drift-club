import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/core/math/rng';
import {
  ECONOMIE, gagnerCourse, offrirCaisse, ouvrirCaisse, peutOuvrir, progressionInitiale, progressionVide, skinsAutorises, validerProgression, livreeDebloquee,
} from '../../src/core/economie';
import { catalogue } from '../../src/core/caisses';

describe('économie : gains', () => {
  it('valeurs par défaut : 1 clé par arrivée, +1 record, caisse à 3 clés, 1 caisse offerte, doublon rendu 1 clé', () => {
    expect(ECONOMIE).toMatchObject({ clesParArrivee: 1, clesRecord: 1, coutCaisse: 3, caissesOffertes: 1, remboursementDoublon: 1 });
  });
  it('arrivée : +1 clé ; nouveau record : +1 de plus', () => {
    const p = { ...progressionVide(), cles: 2 };
    const a = gagnerCourse(p, false);
    expect(a.progression.cles).toBe(3);
    expect(a.gain).toEqual({ arrivee: 1, record: 0, total: 3 });
    const b = gagnerCourse(p, true);
    expect(b.progression.cles).toBe(4);
    expect(b.gain).toEqual({ arrivee: 1, record: 1, total: 4 });
    expect(p.cles).toBe(2); // immuable
  });
});

describe('économie : caisse offerte', () => {
  it('créditée une seule fois (3 clés = une caisse)', () => {
    const p = offrirCaisse(progressionVide());
    expect(p.cles).toBe(ECONOMIE.caissesOffertes * ECONOMIE.coutCaisse);
    expect(p.caisseOfferte).toBe(true);
    expect(peutOuvrir(p)).toBe(true);
    expect(offrirCaisse(p)).toBe(p);
    expect(offrirCaisse(p).cles).toBe(3);
  });
});

describe('économie : ouverture', () => {
  it('refusée sans assez de clés', () => {
    expect(ouvrirCaisse({ ...progressionVide(), cles: 2 }, mulberry32(1))).toBeNull();
    expect(peutOuvrir({ ...progressionVide(), cles: 2 })).toBe(false);
  });
  it('nouvelle livrée : coûte 3 clés, est débloquée, compte l\'ouverture', () => {
    const p = { ...progressionVide(), cles: 5 };
    const o = ouvrirCaisse(p, mulberry32(11))!;
    expect(o.tirage.doublon).toBe(false);
    expect(o.remboursement).toBe(0);
    expect(o.progression.cles).toBe(2);
    expect(o.progression.ouvertes).toBe(1);
    expect(livreeDebloquee(o.progression, o.tirage.objet.car, o.tirage.objet.skin)).toBe(true);
    expect(livreeDebloquee(p, o.tirage.objet.car, o.tirage.objet.skin)).toBe(false);
  });
  it('doublon : 1 clé rendue, rien de nouveau débloqué', () => {
    // tout est débloqué : tout tirage est un doublon
    const debloques = progressionVide().debloques;
    for (const o of catalogue()) debloques[o.car].push(o.skin);
    const p = { ...progressionVide(), cles: 3, debloques };
    const o = ouvrirCaisse(p, mulberry32(4))!;
    expect(o.tirage.doublon).toBe(true);
    expect(o.remboursement).toBe(1);
    expect(o.progression.cles).toBe(1);
    expect(o.progression.debloques).toEqual(p.debloques);
  });
  it('enchaînement : les livrées gagnées s\'accumulent sans doublon dans l\'inventaire', () => {
    let p = { ...progressionVide(), cles: 300 };
    const rng = mulberry32(77);
    for (let i = 0; i < 60; i++) p = ouvrirCaisse(p, rng)!.progression;
    expect(p.ouvertes).toBe(60);
    for (const l of Object.values(p.debloques)) expect(new Set(l).size).toBe(l.length);
    expect(Object.values(p.debloques).flat().length).toBeGreaterThan(10);
  });
});

describe('progression : validation et migration', () => {
  it('migration : les livrées déjà choisies restent débloquées, « unie » n\'est jamais stockée', () => {
    const p = progressionInitiale({ turbo: 'carbone', legere: 'unie', equilibree: 'touge' });
    expect(p.debloques).toEqual({ equilibree: ['touge'], legere: [], turbo: ['carbone'], kei: [], muscle: [], rotative: [], break: [], fumee: [] });
    expect(p.cles).toBe(0);
    expect(p.caisseOfferte).toBe(false);
    expect(progressionInitiale(undefined).debloques).toEqual({ equilibree: [], legere: [], turbo: [], kei: [], muscle: [], rotative: [], break: [], fumee: [] });
  });
  it('validation : ids inconnus, doublons et types invalides écartés', () => {
    const p = validerProgression({ cles: 7.9, ouvertes: -3, caisseOfferte: true, debloques: { turbo: ['carbone', 'carbone', 'fantome', 42, 'unie'], legere: 'nope', velo: ['x'], equilibree: ['bande'] } });
    expect(p.cles).toBe(7);
    expect(p.ouvertes).toBe(0);
    expect(p.caisseOfferte).toBe(true);
    expect(p.debloques).toEqual({ equilibree: [], legere: [], turbo: ['carbone'], kei: [], muscle: [], rotative: [], break: [], fumee: [] }); // « bande » n'existe que pour la Légère
    expect(validerProgression('n_importe_quoi')).toEqual(progressionVide());
    expect(validerProgression({ cles: 'beaucoup', caisseOfferte: 'oui' })).toEqual(progressionVide());
    expect(validerProgression({ cles: Infinity }).cles).toBe(0);
  });
  it('skinsAutorises : une livrée verrouillée retombe sur « unie »', () => {
    const p = { ...progressionVide(), debloques: { equilibree: ['touge'], legere: [], turbo: [], kei: [], muscle: [], rotative: [], break: [], fumee: [] } };
    expect(skinsAutorises({ equilibree: 'touge', legere: 'bande', turbo: 'unie' }, p)).toEqual({ equilibree: 'touge', legere: 'unie', turbo: 'unie' });
    expect(skinsAutorises({}, p)).toEqual({});
  });
});
