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
    const p = { cles: 9, debloques: { equilibree: ['touge'], legere: [], turbo: ['carbone', 'or'] }, caisseOfferte: true, ouvertes: 4 };
    st.saveProgression(p);
    expect(st.loadProgression({})).toEqual(p);
  });
  it('migration : les livrées déjà choisies restent débloquées (uniquement à la création)', () => {
    const kv = memoryKV();
    const p = new Store(kv).loadProgression({ turbo: 'carbone', legere: 'bande', equilibree: 'unie' });
    expect(p.debloques).toEqual({ equilibree: [], legere: ['bande'], turbo: ['carbone'] });
    // une progression existante n'est plus complétée par les réglages
    expect(new Store(kv).loadProgression({ turbo: 'or' }).debloques.turbo).toEqual(['carbone']);
  });
  it('données invalides : ids inconnus retirés, JSON corrompu → progression neuve', () => {
    const kv = memoryKV();
    kv.setItem(CLE, JSON.stringify({ cles: 2, caisseOfferte: true, ouvertes: 1, debloques: { turbo: ['fantome', 'carbone'], velo: ['x'] } }));
    const p = new Store(kv).loadProgression({});
    expect(p.debloques).toEqual({ equilibree: [], legere: [], turbo: ['carbone'] });
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
