import { describe, it, expect } from 'vitest';
import { ProgressionEnLigne } from '../../src/online/progression';
import { ClassementService } from '../../src/online/classement';
import { MSG_INDISPONIBLE, messageErreur } from '../../src/online/erreurs';
import { faussClient } from './mock';

const ligne = { joueur: 'u1', cles: 3, debloques: ['turbo:flammes'], caisse_offerte: true, ouvertes: 0, importee: false };
const local = { cles: 9, debloques: { equilibree: ['rayures'], legere: [], turbo: ['flammes', 'unie'], kei: [], muscle: [], rotative: [], break: [], fumee: [] }, caisseOfferte: true, ouvertes: 1 };

describe('ProgressionEnLigne.charger', () => {
  it('appelle ma_progression et convertit la ligne', async () => {
    const m = faussClient({ 'rpc.ma_progression': { data: [ligne], error: null } });
    const r = await new ProgressionEnLigne(m.fournisseur).charger();
    expect(r).toEqual({ ok: true, valeur: { importee: false, progression: { cles: 3, ouvertes: 0, caisseOfferte: true, debloques: { equilibree: [], legere: [], turbo: ['flammes'], kei: [], muscle: [], rotative: [], break: [], fumee: [] } } } });
    expect(m.appels[0].args[0]).toBe('ma_progression');
  });
  it('accepte une réponse sous forme d’objet seul, refuse une réponse vide', async () => {
    const o = faussClient({ 'rpc.ma_progression': { data: ligne, error: null } });
    expect((await new ProgressionEnLigne(o.fournisseur).charger()).ok).toBe(true);
    const v = faussClient({ 'rpc.ma_progression': { data: [], error: null } });
    expect(await new ProgressionEnLigne(v.fournisseur).charger()).toMatchObject({ ok: false, raison: 'autre' });
  });
  it('erreurs : SQL absent, réseau, client absent, connexion requise', async () => {
    const a = faussClient({ 'rpc.ma_progression': { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.ma_progression without parameters in the schema cache' } } });
    expect(await new ProgressionEnLigne(a.fournisseur).charger()).toEqual({ ok: false, message: "La progression en ligne n'est pas encore disponible.", raison: 'absent' });
    const n = faussClient({ 'rpc.ma_progression': () => { throw new TypeError('Failed to fetch'); } });
    expect(await new ProgressionEnLigne(n.fournisseur).charger()).toEqual({ ok: false, message: MSG_INDISPONIBLE, raison: 'reseau' });
    expect(await new ProgressionEnLigne(async () => null).charger()).toEqual({ ok: false, message: MSG_INDISPONIBLE, raison: 'reseau' });
    const c = faussClient({ 'rpc.ma_progression': { data: null, error: { code: 'P0001', message: 'Choisis un pseudo pour garder ta progression en ligne.' } } });
    expect(await new ProgressionEnLigne(c.fournisseur).charger()).toEqual({ ok: false, message: 'Choisis un pseudo pour garder ta progression en ligne.', raison: 'autre' });
  });
});

describe('ProgressionEnLigne.importerLocale', () => {
  it('envoie les livrées « voiture:skin » (sans « unie ») et les clés', async () => {
    const m = faussClient({ 'rpc.importer_progression_locale': { data: [{ ...ligne, cles: 9, importee: true }], error: null } });
    const r = await new ProgressionEnLigne(m.fournisseur).importerLocale(local);
    expect(m.appels[0].args).toEqual(['importer_progression_locale', { p_debloques: ['equilibree:rayures', 'turbo:flammes'], p_cles: 9 }]);
    expect(r).toMatchObject({ ok: true, valeur: { importee: true, progression: { cles: 9 } } });
  });
});

describe('ProgressionEnLigne.ouvrirCaisse', () => {
  it('renvoie la livrée tirée par le serveur', async () => {
    const m = faussClient({ 'rpc.ouvrir_caisse': { data: [{ voiture: 'legere', skin: 'bande', rarete: 'commune', doublon: true, cles: 1 }], error: null } });
    const r = await new ProgressionEnLigne(m.fournisseur).ouvrirCaisse();
    expect(r).toEqual({ ok: true, valeur: { objet: { car: 'legere', skin: 'bande', rarete: 'commune' }, doublon: true, cles: 1 } });
    expect(m.appels[0].args[0]).toBe('ouvrir_caisse');
  });
  it('« Pas assez de clés » en français, tel que levé par le SQL', async () => {
    const m = faussClient({ 'rpc.ouvrir_caisse': { data: null, error: { code: 'P0001', message: 'Pas assez de clés : il en faut 3 pour ouvrir une caisse.' } } });
    expect(await new ProgressionEnLigne(m.fournisseur).ouvrirCaisse()).toEqual({ ok: false, message: 'Pas assez de clés : il en faut 3 pour ouvrir une caisse.', raison: 'autre' });
  });
  it('hors ligne et SQL absent', async () => {
    const n = faussClient({ 'rpc.ouvrir_caisse': () => { throw new TypeError('Failed to fetch'); } });
    expect(await new ProgressionEnLigne(n.fournisseur).ouvrirCaisse()).toMatchObject({ ok: false, raison: 'reseau' });
    const a = faussClient({ 'rpc.ouvrir_caisse': { data: null, error: { code: '42883', message: 'function ouvrir_caisse() does not exist' } } });
    expect(await new ProgressionEnLigne(a.fournisseur).ouvrirCaisse()).toMatchObject({ ok: false, raison: 'absent' });
  });
  it('livrée inconnue de cette version du jeu : message, pas de crash', async () => {
    const m = faussClient({ 'rpc.ouvrir_caisse': { data: [{ voiture: 'turbo', skin: 'super-nouvelle', rarete: 'exotique', doublon: false, cles: 0 }], error: null } });
    const r = await new ProgressionEnLigne(m.fournisseur).ouvrirCaisse();
    expect(r).toMatchObject({ ok: false, raison: 'autre' });
    expect(r.ok ? '' : r.message).toMatch(/recharge/);
  });
});

describe('messages d’erreur de la progression', () => {
  it('fonction ou table absente', () => {
    expect(messageErreur({ code: '42883', message: 'function public.ouvrir_caisse() does not exist' })).toBe("La progression en ligne n'est pas encore disponible.");
    expect(messageErreur({ code: '42P01', message: 'relation "public.progressions" does not exist' })).toBe("La progression en ligne n'est pas encore disponible.");
  });
});

describe('ClassementService.soumettreScore : clés du compte', () => {
  const score = { niveau: 'off:premiers-virages', mode: 'semi', score: 1234, temps: 61.25, voiture: 'turbo', meilleurDrift: 500 };
  it('lit les colonnes ajoutées par la migration 0005', async () => {
    const m = faussClient({ 'rpc.soumettre_score': { data: [{ ameliore: true, rang: 1, total: 4, cles_gagnees: 2, cles_record: 1, cles: 8 }], error: null } });
    expect(await new ClassementService(m.fournisseur).soumettreScore(score)).toEqual({
      ok: true, valeur: { ameliore: true, rang: 1, total: 4, clesGagnees: 2, clesRecord: 1, cles: 8 },
    });
  });
  it('ancien serveur : pas de colonnes de clés, le reste inchangé', async () => {
    const m = faussClient({ 'rpc.soumettre_score': { data: [{ ameliore: false, rang: 2, total: 4 }], error: null } });
    const r = await new ClassementService(m.fournisseur).soumettreScore(score);
    expect(r).toEqual({ ok: true, valeur: { ameliore: false, rang: 2, total: 4 } });
    expect(r.ok && 'clesGagnees' in r.valeur).toBe(false);
  });
});
