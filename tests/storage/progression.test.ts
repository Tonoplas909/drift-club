import { describe, it, expect } from 'vitest';
import { Store, memoryKV, type KV } from '../../src/storage/store';

const throwingKV: KV = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); } };
const CLE = 'driftclub.v1.progression';

describe('progression (clés et livrées gagnées)', () => {
  it('premier lancement : caisse offerte créditée (3 clés) et enregistrée', () => {
    const kv = memoryKV();
    const p = new Store(kv).loadProgression({});
    expect(p.cles).toBe(3);
    expect(p.caisseOfferte).toBe(true);
    expect(JSON.parse(kv.getItem(CLE)!)).toEqual(p);
  });
  it('la caisse offerte n\'est créditée qu\'une fois, même après rechargement et dépense', () => {
    const kv = memoryKV();
    const st = new Store(kv);
    const p = st.loadProgression({});
    st.saveProgression({ ...p, cles: 0 });
    expect(new Store(kv).loadProgression({}).cles).toBe(0);
  });
  it('aller-retour de la progression', () => {
    const st = new Store(memoryKV());
    const p = { cles: 9, debloques: { equilibree: ['touge'], legere: [], turbo: ['carbone', 'or'], kei: [], muscle: [], rotative: [], break: [], fumee: [] }, caisseOfferte: true, ouvertes: 4 };
    st.saveProgression(p);
    expect(st.loadProgression({})).toEqual(p);
  });
  it('migration : les livrées déjà choisies restent débloquées (uniquement à la création)', () => {
    const kv = memoryKV();
    const p = new Store(kv).loadProgression({ turbo: 'carbone', legere: 'bande', equilibree: 'unie' });
    expect(p.debloques).toEqual({ equilibree: [], legere: ['bande'], turbo: ['carbone'], kei: [], muscle: [], rotative: [], break: [], fumee: [] });
    // une progression existante n'est plus complétée par les réglages
    expect(new Store(kv).loadProgression({ turbo: 'or' }).debloques.turbo).toEqual(['carbone']);
  });
  it('données invalides : ids inconnus retirés, JSON corrompu → progression neuve', () => {
    const kv = memoryKV();
    kv.setItem(CLE, JSON.stringify({ cles: 2, caisseOfferte: true, ouvertes: 1, debloques: { turbo: ['fantome', 'carbone'], velo: ['x'] } }));
    const p = new Store(kv).loadProgression({});
    expect(p.debloques).toEqual({ equilibree: [], legere: [], turbo: ['carbone'], kei: [], muscle: [], rotative: [], break: [], fumee: [] });
    expect(p.cles).toBe(2);
    const kv2 = memoryKV();
    kv2.setItem(CLE, '{pas du json');
    expect(new Store(kv2).loadProgression({ turbo: 'carbone' }).debloques.turbo).toEqual(['carbone']);
  });
  it('stockage refusé : la progression reste utilisable sans lever', () => {
    const st = new Store(throwingKV);
    expect(st.loadProgression({}).cles).toBe(3);
    expect(() => st.saveProgression(st.loadProgression({}))).not.toThrow();
  });
});

describe('progression du compte (copie gardée sur l\'appareil)', () => {
  const compte = { cles: 6, debloques: { equilibree: [], legere: ['bande'], turbo: [], kei: [], muscle: [], rotative: [], break: [], fumee: [] }, caisseOfferte: true, ouvertes: 2 };
  it('aller-retour par compte, sans toucher à la progression locale', () => {
    const kv = memoryKV();
    const st = new Store(kv);
    const locale = st.loadProgression({});
    expect(st.idProgressionCompte()).toBeNull();
    st.saveProgressionCompte({ id: 'u1', progression: compte });
    expect(st.idProgressionCompte()).toBe('u1');
    expect(st.loadProgressionCompte('u1')).toEqual(compte);
    expect(st.loadProgression({})).toEqual(locale);
    expect(JSON.parse(kv.getItem(CLE)!)).toEqual(locale);
  });
  it('un autre compte ne voit pas la copie ; données abîmées → null / valeurs nettoyées', () => {
    const kv = memoryKV();
    const st = new Store(kv);
    st.saveProgressionCompte({ id: 'u1', progression: compte });
    expect(st.loadProgressionCompte('u2')).toBeNull();
    kv.setItem('driftclub.v1.progression-compte', '{pas du json');
    expect(st.loadProgressionCompte('u1')).toBeNull();
    expect(st.idProgressionCompte()).toBeNull();
    kv.setItem('driftclub.v1.progression-compte', JSON.stringify({ id: 'u1', progression: { cles: -5, debloques: { turbo: ['fantome'] } } }));
    expect(st.loadProgressionCompte('u1')?.cles).toBe(0);
  });
  it('stockage refusé : ne lève pas', () => {
    const st = new Store(throwingKV);
    expect(st.loadProgressionCompte('u1')).toBeNull();
    expect(() => st.saveProgressionCompte({ id: 'u1', progression: compte })).not.toThrow();
  });
});
