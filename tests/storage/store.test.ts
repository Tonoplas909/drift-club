import { describe, it, expect } from 'vitest';
import { Store, memoryKV, safeStorage, defaultReglages, cleNiveauPerso, type KV } from '../../src/storage/store';
import { skinChoisie } from '../../src/core/skins';
import { straightLevel } from '../fixtures/levels';

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
  it('livrées : aller-retour, mémorisées par voiture', () => {
    const st = new Store(memoryKV());
    const r = { ...defaultReglages(false), voiture: 'legere' as const, skins: { legere: 'bande', turbo: 'carbone' } };
    st.saveReglages(r);
    const l = st.loadReglages(false);
    expect(l).toEqual(r);
    expect(l.skins.equilibree).toBeUndefined();
  });
  it('livrées : anciennes données sans champ « skins » → chargées, livrée par défaut', () => {
    const kv = memoryKV();
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ mode: 'exigeant', voiture: 'turbo', couleur: '#3a6ff0', volume: 0.5, muet: true, qualite: 'haute', accelAuto: false, cameraLoin: true }));
    const r = new Store(kv).loadReglages(false);
    expect(r.voiture).toBe('turbo');
    expect(r.couleur).toBe('#3a6ff0');
    expect(r.skins).toEqual({});
    expect(skinChoisie(r.skins, 'turbo')).toBe('unie');
  });
  it('livrées : inconnue ou mal formée → « unie »', () => {
    const kv = memoryKV();
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ skins: { turbo: 'fantome', legere: 42, equilibree: 'touge' } }));
    const r = new Store(kv).loadReglages(false);
    expect(r.skins).toEqual({ turbo: 'unie', legere: 'unie', equilibree: 'touge' });
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ skins: 'n_importe_quoi' }));
    expect(new Store(kv).loadReglages(false).skins).toEqual({});
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

  // Niveaux personnalisés
  it('sauvegarde et récupère un niveau', () => {
    const st = new Store(memoryKV());
    const l = straightLevel();
    const n = { id: 'test1', level: l, maj: '2026-09-29T10:00:00Z' };
    st.saveNiveau(n);
    const retrieved = st.getNiveau('test1');
    expect(retrieved).toEqual(n);
  });

  it('liste les niveaux triés par date de modification (plus récents en premier)', () => {
    const st = new Store(memoryKV());
    const l = straightLevel();
    st.saveNiveau({ id: 'a', level: l, maj: '2026-09-29T10:00:00Z' });
    st.saveNiveau({ id: 'b', level: l, maj: '2026-09-29T11:00:00Z' });
    st.saveNiveau({ id: 'c', level: l, maj: '2026-09-29T09:00:00Z' });
    const list = st.listNiveaux();
    expect(list[0].id).toBe('b');
    expect(list[1].id).toBe('a');
    expect(list[2].id).toBe('c');
  });

  it('supprime un niveau', () => {
    const st = new Store(memoryKV());
    const l = straightLevel();
    st.saveNiveau({ id: 'test1', level: l, maj: '2026-09-29T10:00:00Z' });
    expect(st.getNiveau('test1')).not.toBeNull();
    st.deleteNiveau('test1');
    expect(st.getNiveau('test1')).toBeNull();
  });

  it('filtre les niveaux invalides', () => {
    const st = new Store(memoryKV());
    const l = straightLevel();
    const invalid = { ...l, route: [] }; // route vide = invalide
    st.saveNiveau({ id: 'valid', level: l, maj: '2026-09-29T10:00:00Z' });
    st.saveNiveau({ id: 'invalid', level: invalid as any, maj: '2026-09-29T10:00:00Z' });
    const list = st.listNiveaux();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe('valid');
  });

  it('génère un nouvel ID aléatoire', () => {
    const st = new Store(memoryKV());
    const id1 = st.nouvelId();
    const id2 = st.nouvelId();
    expect(typeof id1).toBe('string');
    expect(id1.length).toBeGreaterThan(0);
    expect(id1).not.toBe(id2);
  });

  it('génère une clé pour les niveaux personnalisés', () => {
    const empreinte = 'abc123';
    const key = cleNiveauPerso(empreinte);
    expect(key).toBe('perso:abc123');
  });

  it('ne lève jamais d\'exception pour les niveaux, même si le stockage refuse', () => {
    const st = new Store(throwingKV);
    const l = straightLevel();
    expect(() => st.saveNiveau({ id: 'x', level: l, maj: '2026-09-29' })).not.toThrow();
    expect(st.listNiveaux()).toEqual([]);
  });
});

describe('accélération automatique (tactile)', () => {
  it('désactivée par défaut, y compris pour les anciens réglages enregistrés avec true', () => {
    expect(defaultReglages(true).accelAuto).toBe(false);
    const kv = memoryKV();
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ mode: 'arcade', accelAuto: true }));
    expect(new Store(kv).loadReglages(true).accelAuto).toBe(false);
  });
  it('un choix explicite du joueur est conservé', () => {
    const st = new Store(memoryKV());
    st.saveReglages({ ...defaultReglages(true), accelAuto: true });
    expect(st.loadReglages(true).accelAuto).toBe(true);
  });
});

describe('réglages du HUD (v0.3.9)', () => {
  it('activés par défaut, conservés, et anciens réglages sans ces champs chargés correctement', () => {
    expect(defaultReglages(false).detailPoints).toBe(true);
    expect(defaultReglages(false).indicateurAngle).toBe(true);
    const st = new Store(memoryKV());
    st.saveReglages({ ...defaultReglages(false), detailPoints: false, indicateurAngle: false });
    const r = st.loadReglages(false);
    expect(r.detailPoints).toBe(false);
    expect(r.indicateurAngle).toBe(false);
    const kv = memoryKV();
    kv.setItem('driftclub.v1.reglages', JSON.stringify({ mode: 'semi' }));
    expect(new Store(kv).loadReglages(false).detailPoints).toBe(true);
  });
});
