import { describe, it, expect } from 'vitest';
import { cleVehicule, cleDuNiveau, estCleMoto, FORMAT_CLE_EN_LIGNE } from '../../src/core/cles';
import { Store } from '../../src/storage/store';

describe('clés de classement : voitures et motos à part', () => {
  it('une moto a sa propre clé, une voiture garde celle du niveau ; le défi du jour n\'en a pas', () => {
    expect(cleVehicule('off:col-du-loup', 'turbo')).toBe('off:col-du-loup');
    expect(cleVehicule('off:col-du-loup', 'supermotard')).toBe('moto:off:col-du-loup');
    expect(cleVehicule('perso:abc', 'supermotard')).toBe('moto:perso:abc');
    expect(cleVehicule('moto:off:x', 'supermotard')).toBe('moto:off:x');
    expect(cleVehicule('jour:2026-10-13', 'supermotard')).toBe('jour:2026-10-13');
    expect(estCleMoto('moto:off:x')).toBe(true);
    expect(cleDuNiveau('moto:perso:abc')).toBe('perso:abc');
    expect(cleDuNiveau('off:x')).toBe('off:x');
  });
  it('format en ligne : clés des motos acceptées, sauf pour le défi du jour', () => {
    for (const k of ['off:a', 'perso:b-1', 'moto:off:a', 'moto:perso:b', 'jour:2026-10-13']) expect(FORMAT_CLE_EN_LIGNE.test(k), k).toBe(true);
    for (const k of ['moto:jour:2026-10-13', 'moto:moto:off:a', 'velo:off:a', 'off:']) expect(FORMAT_CLE_EN_LIGNE.test(k), k).toBe(false);
  });
  it('les records et fantômes faits à moto avant passent sous la clé des motos (une seule fois)', () => {
    const m = new Map<string, string>();
    const kv = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    const st = new Store(kv);
    st.submitRecord('off:a', 'semi', { score: 100, temps: 60, voiture: 'turbo', meilleurDrift: 1, date: '2026-10-12' });
    st.submitRecord('off:a', 'arcade', { score: 200, temps: 60, voiture: 'supermotard', meilleurDrift: 1, date: '2026-10-12' });
    st.saveFantome('off:a', 'arcade', { voiture: 'supermotard', replay: 'xx', score: 200 });
    st.rangerMotos();
    expect(st.getRecord('off:a', 'semi')?.score).toBe(100);
    expect(st.getRecord('off:a', 'arcade')).toBeNull();
    expect(st.getRecord('moto:off:a', 'arcade')?.score).toBe(200);
    expect(st.loadFantome('off:a', 'arcade')).toBeNull();
    expect(st.loadFantome('moto:off:a', 'arcade')?.score).toBe(200);
    st.rangerMotos();
    expect(st.getRecord('moto:off:a', 'arcade')?.score).toBe(200);
  });
});
