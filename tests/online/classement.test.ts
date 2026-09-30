import { describe, it, expect } from 'vitest';
import { ClassementService, cleEnLigne } from '../../src/online/classement';
import { MSG_INDISPONIBLE } from '../../src/online/erreurs';
import { faussClient } from './mock';

const score = { niveau: 'off:premiers-virages', mode: 'semi', score: 1234.6, temps: 61.25, voiture: 'turbo', meilleurDrift: 5000 };

describe('cleEnLigne', () => {
  it('accepte off: et perso:, refuse le reste', () => {
    expect(cleEnLigne('off:premiers-virages')).toBe(true);
    expect(cleEnLigne(`perso:${'a'.repeat(64)}`)).toBe(true);
    for (const k of ['', 'off:', 'test:abc', 'off:a b', 'off:' + 'x'.repeat(81), 'perso:é']) expect(cleEnLigne(k)).toBe(false);
  });
});

describe('ClassementService.soumettreScore', () => {
  it('appelle la fonction soumettre_score avec des entiers cohérents', async () => {
    const m = faussClient({ 'rpc.soumettre_score': { data: [{ ameliore: true, rang: 3, total: 12 }], error: null } });
    const r = await new ClassementService(m.fournisseur).soumettreScore(score);
    expect(r).toEqual({ ok: true, valeur: { ameliore: true, rang: 3, total: 12 } });
    expect(m.appels[0].args).toEqual(['soumettre_score', {
      p_niveau: 'off:premiers-virages', p_mode: 'semi', p_score: 1235, p_temps: 61.25, p_voiture: 'turbo', p_meilleur_drift: 1235,
    }]);
  });
  it("n'envoie rien pour une clé sans classement", async () => {
    const m = faussClient();
    const r = await new ClassementService(m.fournisseur).soumettreScore({ ...score, niveau: 'test:x' });
    expect(r.ok).toBe(false);
    expect(m.appels).toHaveLength(0);
  });
  it('accepte une réponse sous forme d\'objet seul', async () => {
    const m = faussClient({ 'rpc.soumettre_score': { data: { ameliore: false, rang: '2', total: '2' }, error: null } });
    expect(await new ClassementService(m.fournisseur).soumettreScore(score)).toEqual({ ok: true, valeur: { ameliore: false, rang: 2, total: 2 } });
  });
  it('erreurs : serveur, réseau, client absent, réponse vide', async () => {
    const e = faussClient({ 'rpc.soumettre_score': { data: null, error: { code: 'P0001', message: 'Temps invalide.' } } });
    expect(await new ClassementService(e.fournisseur).soumettreScore(score)).toEqual({ ok: false, message: 'Temps invalide.' });
    const n = faussClient({ 'rpc.soumettre_score': () => { throw new TypeError('Failed to fetch'); } });
    expect(await new ClassementService(n.fournisseur).soumettreScore(score)).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    expect(await new ClassementService(async () => null).soumettreScore(score)).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    const v = faussClient({ 'rpc.soumettre_score': { data: [], error: null } });
    expect((await new ClassementService(v.fournisseur).soumettreScore(score)).ok).toBe(false);
  });
});

describe('ClassementService.chargerClassement', () => {
  it('renvoie les lignes typées', async () => {
    const m = faussClient({ 'rpc.classement': { data: [
      { rang: 1, pseudo: 'Max', score: 5000, temps: 60.5, voiture: 'turbo', maj: '2026-09-30T10:00:00Z', joueur: 'u1' },
      { rang: 2, pseudo: 'Zoe', score: '4000', temps: 70, voiture: 'legere', maj: '2026-09-30T11:00:00Z', joueur: 'u2' },
    ], error: null } });
    const r = await new ClassementService(m.fournisseur).chargerClassement('off:a', 'semi', 10);
    expect(m.appels[0].args).toEqual(['classement', { p_niveau: 'off:a', p_mode: 'semi', p_limite: 10 }]);
    expect(r.ok && r.valeur.map((l) => [l.rang, l.pseudo, l.score])).toEqual([[1, 'Max', 5000], [2, 'Zoe', 4000]]);
  });
  it('limite par défaut 20 ; liste vide', async () => {
    const m = faussClient({ 'rpc.classement': { data: [], error: null } });
    const r = await new ClassementService(m.fournisseur).chargerClassement('perso:abc', 'arcade');
    expect(r).toEqual({ ok: true, valeur: [] });
    expect((m.appels[0].args[1] as { p_limite: number }).p_limite).toBe(20);
  });
  it('tables absentes : message convivial', async () => {
    const m = faussClient({ 'rpc.classement': { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } });
    const r = await new ClassementService(m.fournisseur).chargerClassement('off:a', 'semi');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/pas encore disponible/);
  });
  it('clé invalide : pas d\'appel', async () => {
    const m = faussClient();
    expect((await new ClassementService(m.fournisseur).chargerClassement('zzz', 'semi')).ok).toBe(false);
    expect(m.appels).toHaveLength(0);
  });
});
