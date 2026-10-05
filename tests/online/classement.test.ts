import { describe, it, expect } from 'vitest';
import { ClassementService, cleEnLigne } from '../../src/online/classement';
import { MSG_INDISPONIBLE } from '../../src/online/erreurs';
import { faussClient } from './mock';
import { EMPREINTE_SIMULATION } from '../../src/online/empreinteSimulation';
import { decompresserReplay, depuisBase64 } from '../../src/core/replay/replay';

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

describe('ClassementService.soumettreScore : course vérifiée par le serveur', () => {
  const replay = Uint8Array.from([1, 5, 255, 0, 127, 0, 3, 0, 0, 127, 1]);
  const avecCourse = { ...score, course: { replay, level: { format: 1 } } };
  const ligne = { ameliore: true, rang: 1, total: 4, cles_gagnees: 2, cles_record: 1, cles: 9 };

  it('envoie score et replay compressé à verifier-course ; renvoie rang, clés et verdict', async () => {
    const m = faussClient({ 'functions.verifier-course': { data: { ok: true, statut: 'conforme', score: 1235, ...ligne }, error: null } });
    const r = await new ClassementService(m.fournisseur).soumettreScore(avecCourse);
    expect(r).toEqual({ ok: true, valeur: { ameliore: true, rang: 1, total: 4, clesGagnees: 2, clesRecord: 1, cles: 9, verification: { statut: 'conforme', score: 1235 } } });
    expect(m.appels.map((a) => a.nom)).toEqual(['functions.verifier-course']);
    const corps = (m.appels[0].args[1] as { body: Record<string, unknown> }).body;
    expect(corps).toMatchObject({ version: EMPREINTE_SIMULATION, niveau: 'off:premiers-virages', mode: 'semi', voiture: 'turbo', score: 1234.6, temps: 61.25, meilleurDrift: 5000, compression: 'deflate-raw' });
    expect(corps.level).toBeUndefined(); // niveau officiel : le serveur l'a déjà
    expect(await decompresserReplay(depuisBase64(corps.replay as string)!, 1000)).toEqual(replay);
  });
  it('niveau perso : son contenu part avec la course ; score corrigé par le serveur', async () => {
    const m = faussClient({ 'functions.verifier-course': { data: { ok: true, statut: 'corrige', score: 800, ...ligne, ameliore: false }, error: null } });
    const r = await new ClassementService(m.fournisseur).soumettreScore({ ...avecCourse, niveau: 'perso:abc' });
    expect(r.ok && r.valeur.verification).toEqual({ statut: 'corrige', score: 800 });
    expect((m.appels[0].args[1] as { body: Record<string, unknown> }).body.level).toEqual({ format: 1 });
  });
  it('refus du serveur (version, course invalide) : message, pas de repli', async () => {
    const m = faussClient({ 'functions.verifier-course': { data: { ok: false, code: 'version', message: 'Recharge la page.' }, error: null } });
    expect(await new ClassementService(m.fournisseur).soumettreScore(avecCourse)).toEqual({ ok: false, message: 'Recharge la page.' });
    expect(m.appels).toHaveLength(1);
  });
  it('fonction pas encore déployée ou SQL 0008 absent : repli sur soumettre_score', async () => {
    for (const rep of [
      { data: null, error: { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code' } },
      { data: { ok: false, code: 'indisponible', message: 'pas installé' }, error: null },
    ]) {
      const m = faussClient({ 'functions.verifier-course': rep, 'rpc.soumettre_score': { data: [{ ameliore: false, rang: 2, total: 3 }], error: null } });
      expect(await new ClassementService(m.fournisseur).soumettreScore(avecCourse)).toEqual({ ok: true, valeur: { ameliore: false, rang: 2, total: 3 } });
      expect(m.appels.map((a) => a.nom)).toEqual(['functions.verifier-course', 'rpc.soumettre_score']);
    }
  });
  it('hors ligne : pas de repli ; soumettre_score fermée (0008) et fonction muette : message clair', async () => {
    const h = faussClient({ 'functions.verifier-course': { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to send a request' } } });
    expect(await new ClassementService(h.fournisseur).soumettreScore(avecCourse)).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    expect(h.appels).toHaveLength(1);
    const f = faussClient({
      'functions.verifier-course': { data: null, error: { name: 'FunctionsRelayError', message: 'relay' } },
      'rpc.soumettre_score': { data: null, error: { code: '42501', message: 'permission denied for function soumettre_score' } },
    });
    const r = await new ClassementService(f.fournisseur).soumettreScore(avecCourse);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/vérification des scores ne répond pas/);
  });
});

describe('ClassementService.chargerClassement', () => {
  it('renvoie les lignes typées', async () => {
    const m = faussClient({ 'rpc.classement_niveau': { data: [
      { rang: 1, pseudo: 'Max', mode: 'exigeant', score: 5000, temps: 60.5, voiture: 'turbo', maj: '2026-09-30T10:00:00Z', joueur: 'u1' },
      { rang: 2, pseudo: 'Zoe', mode: 'arcade', score: '4000', temps: 70, voiture: 'legere', maj: '2026-09-30T11:00:00Z', joueur: 'u2' },
    ], error: null } });
    const r = await new ClassementService(m.fournisseur).chargerClassement('off:a', 10);
    expect(m.appels[0].args).toEqual(['classement_niveau', { p_niveau: 'off:a', p_limite: 10 }]);
    expect(r.ok && r.valeur.map((l) => [l.rang, l.pseudo, l.mode, l.score])).toEqual([[1, 'Max', 'exigeant', 5000], [2, 'Zoe', 'arcade', 4000]]);
  });
  it('limite par défaut 20 ; liste vide', async () => {
    const m = faussClient({ 'rpc.classement_niveau': { data: [], error: null } });
    const r = await new ClassementService(m.fournisseur).chargerClassement('perso:abc');
    expect(r).toEqual({ ok: true, valeur: [] });
    expect((m.appels[0].args[1] as { p_limite: number }).p_limite).toBe(20);
  });
  it('tables absentes : message convivial', async () => {
    const m = faussClient({ 'rpc.classement_niveau': { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } });
    const r = await new ClassementService(m.fournisseur).chargerClassement('off:a');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/pas encore disponible/);
  });
  it('clé invalide : pas d\'appel', async () => {
    const m = faussClient();
    expect((await new ClassementService(m.fournisseur).chargerClassement('zzz')).ok).toBe(false);
    expect(m.appels).toHaveLength(0);
  });
});

describe('ClassementService.mesPlaces', () => {
  it('un seul appel pour tous les niveaux, clés invalides ignorées, lignes incohérentes rejetées', async () => {
    const m = faussClient({ 'rpc.mes_places': { data: [
      { niveau: 'off:a', rang: 3, total: 12, score: 5000, mode: 'semi' },
      { niveau: 'off:b', rang: 5, total: 2, score: 10, mode: 'semi' },
    ], error: null } });
    const r = await new ClassementService(m.fournisseur).mesPlaces(['off:a', 'off:b', 'zzz', 'off:a']);
    expect(m.appels).toHaveLength(1);
    expect(m.appels[0].args).toEqual(['mes_places', { p_niveaux: ['off:a', 'off:b'] }]);
    expect(r.ok && [...r.valeur.entries()]).toEqual([['off:a', { rang: 3, total: 12, score: 5000, mode: 'semi' }]]);
  });
  it('aucune clé : pas d\'appel ; erreur serveur : message', async () => {
    const m = faussClient({ 'rpc.mes_places': { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } });
    expect((await new ClassementService(m.fournisseur).mesPlaces([])).ok).toBe(true);
    expect(m.appels).toHaveLength(0);
    expect((await new ClassementService(m.fournisseur).mesPlaces(['off:a'])).ok).toBe(false);
  });
});
