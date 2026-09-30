import { describe, it, expect } from 'vitest';
import { NiveauxEnLigneService } from '../../src/online/niveaux';
import { MSG_INDISPONIBLE } from '../../src/online/erreurs';
import { empreinteNiveau } from '../../src/core/level/fingerprint';
import { normaliserNiveau } from '../../src/core/level/encode';
import { NIVEAUX_OFFICIELS } from '../../src/levels';
import { loadLevel } from '../../src/core/loadLevel';
import { faussClient } from './mock';
import type { Level } from '../../src/core/level/types';

const ID = '3f2b8c1e-9d4a-4b6f-8e21-0a7c5d9e1f34';
const H = 'ab'.repeat(32);
const officiel = (): Level => {
  const r = loadLevel(NIVEAUX_OFFICIELS[1].data);
  if (!r.ok) throw new Error('niveau');
  return r.level;
};
const ligne = (o: Record<string, unknown> = {}) => ({
  id: ID, nom: 'Mon niveau', auteur: 'u1', auteur_pseudo: 'Max', empreinte: H, longueur: 812.5, cree_le: '2026-09-29T10:00:00Z', parties: 7, ...o,
});
const svc = (rep: Parameters<typeof faussClient>[0]) => {
  const m = faussClient(rep);
  return { m, s: new NiveauxEnLigneService(m.fournisseur) };
};

describe('publier', () => {
  it('envoie le niveau arrondi, son empreinte et sa longueur, renvoie l\'id', async () => {
    const { m, s } = svc({ 'rpc.publier_niveau': { data: ID, error: null } });
    const l = officiel();
    l.route[1].x += 0.04; // sera arrondi
    const r = await s.publier(l);
    const attendu = normaliserNiveau(l);
    expect(r).toEqual({ ok: true, valeur: { id: ID, empreinte: await empreinteNiveau(attendu) } });
    const [nom, args] = m.appels[0].args as [string, { p_donnees: Level; p_empreinte: string; p_longueur: number }];
    expect(nom).toBe('publier_niveau');
    expect(args.p_donnees).toEqual(attendu);
    expect(args.p_empreinte).toMatch(/^[0-9a-f]{64}$/);
    expect(args.p_longueur).toBeGreaterThan(500);
    expect(args.p_longueur).toBeLessThanOrEqual(3000);
  });
  it('valide localement avant tout envoi', async () => {
    const { m, s } = svc({});
    const l = officiel();
    l.route = l.route.slice(0, 1);
    const r = await s.publier(l);
    expect(r.ok).toBe(false);
    expect(m.appels).toHaveLength(0);
  });
  it('erreurs du serveur traduites : limite, connexion, service absent, réseau, réponse bizarre', async () => {
    const cas: [unknown, RegExp | string][] = [
      [{ code: 'P0001', message: 'Limite atteinte : 10 niveaux publiés par 24 heures. Réessaie plus tard.' }, /^Limite atteinte/],
      [{ code: 'P0001', message: 'Choisis un pseudo avant de publier un niveau.' }, /pseudo/],
      [{ code: '42501', message: 'permission denied for function publier_niveau' }, /Connecte-toi/],
      [{ code: 'PGRST202', message: 'Could not find the function public.publier_niveau' }, /pas encore disponibles/],
    ];
    for (const [error, attendu] of cas) {
      const { s } = svc({ 'rpc.publier_niveau': { data: null, error } });
      const r = await s.publier(officiel());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toMatch(attendu);
    }
    const reseau = svc({ 'rpc.publier_niveau': () => { throw new TypeError('Failed to fetch'); } });
    expect(await reseau.s.publier(officiel())).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    expect(await new NiveauxEnLigneService(async () => null).publier(officiel())).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    const bizarre = svc({ 'rpc.publier_niveau': { data: { id: ID }, error: null } });
    expect((await bizarre.s.publier(officiel())).ok).toBe(false);
  });
});

describe('lister', () => {
  it('appelle niveaux_en_ligne (page + 1 ligne pour savoir s\'il en reste) et convertit les lignes', async () => {
    const { m, s } = svc({ 'rpc.niveaux_en_ligne': { data: [ligne(), ligne({ id: ID.replace('3f', '4f'), nom: 'Deux', parties: '3', longueur: '99' })], error: null } });
    const r = await s.lister('populaire', 2, 5);
    expect(m.appels[0].args).toEqual(['niveaux_en_ligne', { p_tri: 'populaire', p_limite: 6, p_decalage: 10 }]);
    expect(r).toEqual({ ok: true, valeur: { plus: false, niveaux: [
      { id: ID, nom: 'Mon niveau', auteur: 'u1', auteurPseudo: 'Max', empreinte: H, longueur: 812.5, creeLe: '2026-09-29T10:00:00Z', parties: 7 },
      { id: ID.replace('3f', '4f'), nom: 'Deux', auteur: 'u1', auteurPseudo: 'Max', empreinte: H, longueur: 99, creeLe: '2026-09-29T10:00:00Z', parties: 3 },
    ] } });
  });
  it('plus = true quand la base renvoie plus qu\'une page', async () => {
    const { s } = svc({ 'rpc.niveaux_en_ligne': { data: [ligne(), ligne(), ligne()], error: null } });
    const r = await s.lister('recent', 0, 2);
    expect(r.ok && r.valeur.niveaux).toHaveLength(2);
    expect(r.ok && r.valeur.plus).toBe(true);
  });
  it('ignore les lignes mal formées (id, empreinte, nom)', async () => {
    const { s } = svc({ 'rpc.niveaux_en_ligne': { data: [ligne({ id: 'pas-un-uuid' }), ligne({ empreinte: 'zz' }), ligne({ nom: 42 }), null, 'x', ligne()], error: null } });
    const r = await s.lister('recent', 0);
    expect(r.ok && r.valeur.niveaux.map((n) => n.id)).toEqual([ID]);
  });
  it('liste vide, erreurs', async () => {
    expect(await svc({ 'rpc.niveaux_en_ligne': { data: [], error: null } }).s.lister('recent', 0)).toEqual({ ok: true, valeur: { niveaux: [], plus: false } });
    const abs = await svc({ 'rpc.niveaux_en_ligne': { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.niveaux_en_ligne' } } }).s.lister('recent', 0);
    expect(abs).toEqual({ ok: false, message: 'Les niveaux en ligne ne sont pas encore disponibles.' });
    expect(await new NiveauxEnLigneService(async () => null).lister('recent', 0)).toEqual({ ok: false, message: MSG_INDISPONIBLE });
  });
});

describe('charger', () => {
  const pret = async () => {
    const level = normaliserNiveau(officiel());
    return { level, empreinte: await empreinteNiveau(level) };
  };

  it('re-valide et renvoie le niveau avec son empreinte locale', async () => {
    const { level, empreinte } = await pret();
    const { m, s } = svc({ 'rpc.niveau_en_ligne': { data: [{ ...ligne({ empreinte }), donnees: level }], error: null } });
    const r = await s.charger(ID);
    expect(m.appels[0].args).toEqual(['niveau_en_ligne', { p_id: ID }]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valeur.level).toEqual(level);
      expect(r.valeur.empreinte).toBe(empreinte);
      expect(r.valeur.meta.auteurPseudo).toBe('Max');
    }
  });
  it('accepte des clés dans un autre ordre (jsonb les réordonne)', async () => {
    const { level, empreinte } = await pret();
    const melange = Object.fromEntries(Object.entries({ ...level, route: level.route.map((p) => ({ l: p.l, y: p.y, z: p.z, x: p.x })) }).reverse());
    const { s } = svc({ 'rpc.niveau_en_ligne': { data: [{ ...ligne({ empreinte }), donnees: melange }], error: null } });
    expect((await s.charger(ID)).ok).toBe(true);
  });
  it('refuse des données invalides venues du serveur', async () => {
    const { level, empreinte } = await pret();
    const mauvais: unknown[] = [
      { ...level, route: level.route.slice(0, 1) },
      { ...level, route: level.route.map((p) => ({ ...p, l: 999 })) },
      { ...level, objets: [{ type: 'bombe', x: 0, z: 0, rot: 0 }] },
      'du texte',
      null,
      { format: 1 },
    ];
    for (const donnees of mauvais) {
      const { s } = svc({ 'rpc.niveau_en_ligne': { data: [{ ...ligne({ empreinte }), donnees }], error: null } });
      const r = await s.charger(ID);
      expect(r.ok, JSON.stringify(donnees)?.slice(0, 40)).toBe(false);
      if (!r.ok) expect(r.message).toMatch(/invalide/);
    }
  });
  it('refuse un niveau dont le contenu ne correspond pas à l\'empreinte annoncée', async () => {
    const { level } = await pret();
    const { s } = svc({ 'rpc.niveau_en_ligne': { data: [{ ...ligne({ empreinte: H }), donnees: level }], error: null } });
    expect(await s.charger(ID)).toEqual({ ok: false, message: 'Ce niveau en ligne est corrompu.' });
  });
  it('introuvable, id invalide, ligne mal formée, erreurs', async () => {
    expect(await svc({ 'rpc.niveau_en_ligne': { data: [], error: null } }).s.charger(ID)).toEqual({ ok: false, message: "Ce niveau n'existe pas ou a été retiré." });
    const m = faussClient();
    expect((await new NiveauxEnLigneService(m.fournisseur).charger('../../x')).ok).toBe(false);
    expect(m.appels).toHaveLength(0);
    expect((await svc({ 'rpc.niveau_en_ligne': { data: [{ id: 'x', donnees: {} }], error: null } }).s.charger(ID)).ok).toBe(false);
    const r = await svc({ 'rpc.niveau_en_ligne': () => { throw new TypeError('Failed to fetch'); } }).s.charger(ID);
    expect(r).toEqual({ ok: false, message: MSG_INDISPONIBLE });
  });
});

describe('retirer / compterPartie', () => {
  it('retirer : succès et message français du serveur', async () => {
    const ok = svc({ 'rpc.retirer_niveau': { data: null, error: null } });
    expect(await ok.s.retirer(ID)).toEqual({ ok: true, valeur: null });
    expect(ok.m.appels[0].args).toEqual(['retirer_niveau', { p_id: ID }]);
    const ko = svc({ 'rpc.retirer_niveau': { data: null, error: { code: 'P0001', message: "Ce niveau n'existe pas ou ne t'appartient pas." } } });
    expect(await ko.s.retirer(ID)).toEqual({ ok: false, message: "Ce niveau n'existe pas ou ne t'appartient pas." });
  });
  it('compterPartie : appelle la fonction, ne lève jamais', async () => {
    const m = faussClient();
    await new NiveauxEnLigneService(m.fournisseur).compterPartie(ID);
    expect(m.appels[0].args).toEqual(['compter_partie', { p_id: ID }]);
    await new NiveauxEnLigneService(faussClient({ 'rpc.compter_partie': () => { throw new Error('boom'); } }).fournisseur).compterPartie(ID);
    await new NiveauxEnLigneService(async () => null).compterPartie(ID);
    const n = faussClient();
    await new NiveauxEnLigneService(n.fournisseur).compterPartie('pas un uuid');
    expect(n.appels).toHaveLength(0);
  });
});
