import { describe, it, expect } from 'vitest';
import { AtelierEnLigne } from '../../src/online/atelier';
import { faussClient } from './mock';

const ID = '8dd9e82d-e9f9-4b6f-8e21-0a7c5d9e1f34';
const ligne = (o: Record<string, unknown> = {}) => ({
  id: ID, voiture: 'kei', nom: 'Néon', description: 'Pour la nuit.', rarete: 'epique', pseudo: 'Max',
  donnees: { elements: [{ type: 'grille', teinte: '#28e6ff', pas: 0.13, epaisseur: 0.012 }], couleurForcee: '#111116' }, ...o,
});
const svc = (rep: Parameters<typeof faussClient>[0]) => {
  const m = faussClient(rep);
  return { m, s: new AtelierEnLigne(m.fournisseur) };
};

describe('AtelierEnLigne', () => {
  it('lit les livrées officielles et ignore celles qui ne passent pas la validation', async () => {
    const { s } = svc({ 'rpc.livrees_officielles': { data: [ligne(), ligne({ id: 'x', nom: '' }), ligne({ donnees: { elements: [{ type: 'inconnu' }] } })], error: null } });
    const r = await s.officielles();
    expect(r.ok && r.valeur.map((l) => [l.idServeur, l.rarete, l.pseudo, l.livree.couleurForcee])).toEqual([[ID, 'epique', 'Max', '#111116']]);
  });

  it('migration absente : échec en douceur avec un message français', async () => {
    const { s } = svc({ 'rpc.livrees_officielles': { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.livrees_officielles' } } });
    const r = await s.officielles();
    expect(r).toEqual({ ok: false, message: "L'Atelier en ligne n'est pas encore disponible." });
  });

  it('propose seulement les champs utiles, déjà nettoyés', async () => {
    const { m, s } = svc({ 'rpc.proposer_livree': { data: ID, error: null } });
    const r = await s.proposer({ voiture: 'kei', nom: '  Néon  ', description: 'Nuit', elements: [{ type: 'toit', teinte: 'sombre' }] });
    expect(r).toEqual({ ok: true, valeur: ID });
    expect(m.appels[0].args).toEqual(['proposer_livree', { p_voiture: 'kei', p_nom: 'Néon', p_description: 'Nuit', p_donnees: { elements: [{ type: 'toit', teinte: 'sombre' }] } }]);
  });

  it('refuse d\'envoyer une livrée invalide', async () => {
    const { m, s } = svc({});
    const r = await s.proposer({ voiture: 'kei', nom: 'A', description: 'B', elements: [] });
    expect(r.ok).toBe(false);
    expect(m.appels).toHaveLength(0);
  });

  it('remonte les messages du serveur (limite atteinte)', async () => {
    const { s } = svc({ 'rpc.proposer_livree': { data: null, error: { code: 'P0001', message: 'Limite atteinte : 3 propositions par 24 h.' } } });
    expect(await s.proposer({ voiture: 'kei', nom: 'A', description: 'B', elements: [{ type: 'toit', teinte: 'sombre' }] }))
      .toEqual({ ok: false, message: 'Limite atteinte : 3 propositions par 24 h.' });
  });

  it('mes propositions : statut, rareté et motif de refus', async () => {
    const { s } = svc({ 'rpc.mes_livrees': { data: [ligne({ statut: 'refusee', rarete: null, motif_refus: 'Trop proche', cree_le: '2026-10-01' })], error: null } });
    const r = await s.mesPropositions();
    expect(r.ok && r.valeur[0]).toMatchObject({ id: ID, statut: 'refusee', rarete: null, motifRefus: 'Trop proche' });
  });

  it('administrateur : faux si la fonction manque ou répond autre chose que true', async () => {
    expect(await svc({ 'rpc.est_admin': { data: true, error: null } }).s.estAdmin()).toBe(true);
    expect(await svc({ 'rpc.est_admin': { data: 'true', error: null } }).s.estAdmin()).toBe(false);
    expect(await svc({ 'rpc.est_admin': { data: null, error: { code: 'PGRST202', message: 'est_admin' } } }).s.estAdmin()).toBe(false);
  });

  it('modération : valider avec rareté, refuser avec motif', async () => {
    const { m, s } = svc({ 'rpc.moderer_livree': { data: null, error: null } });
    await s.moderer(ID, { valider: true, rarete: 'rare' });
    await s.moderer(ID, { valider: false, motif: 'Non' });
    expect(m.appels.map((a) => a.args[1])).toEqual([
      { p_id: ID, p_valider: true, p_rarete: 'rare', p_motif: null },
      { p_id: ID, p_valider: false, p_rarete: null, p_motif: 'Non' },
    ]);
  });

  it('votes : propositions en attente avec les votes, vote envoyé, livrée de la semaine', async () => {
    const { m, s } = svc({
      'rpc.livrees_en_vote': { data: [ligne({ statut: 'proposee', rarete: null, pour: 4, contre: 1, mon_vote: 1, mienne: false })], error: null },
      'rpc.voter_livree': { data: [{ pour: 3, contre: 1, mon_vote: null }], error: null },
      'rpc.livree_de_la_semaine': { data: [{ id: ID, voiture: 'kei', nom: 'Néon', pseudo: 'Max', pour: 12 }], error: null },
    });
    const r = await s.enVote();
    expect(r.ok && r.valeur[0]).toMatchObject({ pseudo: 'Max', pour: 4, contre: 1, monVote: 1, mienne: false });
    expect(await s.voter(ID, 0)).toEqual({ ok: true, valeur: { pour: 3, contre: 1 } });
    expect(m.appels.find((a) => a.nom === 'rpc.voter_livree')?.args).toEqual(['voter_livree', { p_id: ID, p_vote: 0 }]);
    expect(await s.livreeDeLaSemaine()).toEqual({ voiture: 'kei', nom: 'Néon', pseudo: 'Max', pour: 12 });
  });

  it('votes : migration 0012 absente → pas de livrée de la semaine, message clair', async () => {
    const err = { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.livrees_en_vote' } };
    const { s } = svc({ 'rpc.livrees_en_vote': err, 'rpc.livree_de_la_semaine': err });
    expect(await s.livreeDeLaSemaine()).toBeNull();
    const r = await s.enVote();
    expect(r.ok).toBe(false);
  });
});
