import { describe, it, expect } from 'vitest';
import { Store, memoryKV, safeStorage, defaultReglages, type KV } from '../../src/storage/store';

const throwingKV: KV = { getItem: () => { throw new Error('refusé'); }, setItem: () => { throw new Error('refusé'); } };

describe('safeStorage', () => {
  it('utilise le stockage fourni s\'il fonctionne', () => {
    const kv = memoryKV();
    const s = safeStorage(kv);
    expect(s.persistent).toBe(true);
    expect(s.kv).toBe(kv);
  });
  it('se rabat sur la mémoire si le stockage lève une exception', () => {
    const s = safeStorage(throwingKV);
    expect(s.persistent).toBe(false);
    s.kv.setItem('a', '1');
    expect(s.kv.getItem('a')).toBe('1');
  });
  it('se rabat sur la mémoire sans stockage', () => {
    expect(safeStorage(null).persistent).toBe(false);
  });
});

describe('Store', () => {
  it('reglages par defaut (Arcade au tactile, Semi-arcade sinon)', () => {
    expect(new Store(memoryKV()).loadReglages(true).mode).toBe('arcade');
    expect(new Store(memoryKV()).loadReglages(false)).toEqual(defaultReglages(false));
  });
  it('aller-retour des reglages', () => {
    const st = new Store(memoryKV());
    const r = { ...defaultReglages(false), voiture: 'turbo' as const, couleur: '#3a6ff0', volume: 0.3, cameraLoin: true };
    st.saveReglages(r);
    expect(st.loadReglages(false)).toEqual(r);
  });
  it('JSON corrompu ou valeurs invalides → defauts', () => {
    const kv = memoryKV();
    kv.setItem('driftclub.v1.reglages', '{pas du json');
    expect(new Store(kv).loadReglages(false)).toEqual(defaultReglages(false));
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ mode: 'turbo', couleur: 'rouge', volume: 5, voiture: 'legere' }));
    const r = new Store(kv).loadReglages(false);
    expect(r.mode).toBe('semi');
    expect(r.couleur).toBe(defaultReglages(false).couleur);
    expect(r.volume).toBe(defaultReglages(false).volume);
    expect(r.voiture).toBe('legere');
  });
  it('records : seul un meilleur score remplace', () => {
    const st = new Store(memoryKV());
    const e = { score: 1000, temps: 60, voiture: 'equilibree' as const, meilleurDrift: 400, date: '2026-09-29' };
    expect(st.getRecord('off:a', 'semi')).toBeNull();
    expect(st.submitRecord('off:a', 'semi', e)).toBe(true);
    expect(st.submitRecord('off:a', 'semi', { ...e, score: 900 })).toBe(false);
    expect(st.getRecord('off:a', 'semi')!.score).toBe(1000);
    expect(st.submitRecord('off:a', 'semi', { ...e, score: 1200 })).toBe(true);
    expect(st.getRecord('off:a', 'arcade')).toBeNull();
    expect(st.getRecord('off:a', 'semi')!.score).toBe(1200);
  });
  it('ne leve jamais d\'exception, meme si le stockage refuse tout', () => {
    const st = new Store(throwingKV);
    expect(() => st.saveReglages(defaultReglages(false))).not.toThrow();
    expect(st.loadReglages(false)).toEqual(defaultReglages(false));
    expect(() => st.submitRecord('x', 'semi', { score: 1, temps: 1, voiture: 'legere', meilleurDrift: 1, date: 'd' })).not.toThrow();
  });
});
