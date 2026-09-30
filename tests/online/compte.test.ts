import { describe, it, expect } from 'vitest';
import { CompteService, type EtatCompte } from '../../src/online/compte';
import { MSG_INDISPONIBLE } from '../../src/online/erreurs';
import { faussClient, session } from './mock';

const attendre = () => new Promise((r) => setTimeout(r, 5));

describe('CompteService', () => {
  it('démarre déconnecté, sans client (hors ligne) : aucun crash', async () => {
    const c = new CompteService(async () => null);
    await c.demarrer();
    expect(c.etat.statut).toBe('deconnecte');
    expect(await c.connexion('a@b.fr', 'secret1')).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    expect(await c.inscription('a@b.fr', 'secret1', 'Max')).toEqual({ ok: false, message: MSG_INDISPONIBLE });
    expect(await c.motDePasseOublie('a@b.fr')).toEqual({ ok: false, message: MSG_INDISPONIBLE });
  });

  it('un fournisseur qui lève une exception ne fait pas planter', async () => {
    const c = new CompteService(async () => { throw new Error('boom'); });
    await c.demarrer();
    expect((await c.connexion('a@b.fr', 'x')).ok).toBe(false);
  });

  it('valide les champs avant tout appel réseau', async () => {
    const m = faussClient();
    const c = new CompteService(m.fournisseur);
    expect((await c.inscription('nul', 'secret1', 'Max')).ok).toBe(false);
    expect((await c.inscription('a@b.fr', '123', 'Max')).ok).toBe(false);
    expect((await c.inscription('a@b.fr', 'secret1', 'M')).ok).toBe(false);
    expect((await c.connexion('a@b.fr', '')).ok).toBe(false);
    expect(m.appels).toHaveLength(0);
  });

  it('inscription avec confirmation par email : pas de session', async () => {
    const m = faussClient({ signUp: { data: { user: { identities: [{}] }, session: null }, error: null } });
    const c = new CompteService(m.fournisseur);
    expect(await c.inscription(' a@b.fr ', 'secret1', ' Max ')).toEqual({ ok: true, confirmation: true });
    const [args] = m.appels[0].args as [{ email: string; options: { data: { pseudo: string } } }];
    expect(args.email).toBe('a@b.fr');
    expect(args.options.data.pseudo).toBe('Max');
    expect(c.etat.statut).toBe('deconnecte');
  });

  it('inscription sans confirmation : connecté, profil créé avec le pseudo', async () => {
    const m = faussClient({
      signUp: { data: { user: { identities: [{}] }, session: session('u1', 'a@b.fr', 'Max') }, error: null },
      'profils.select.maybeSingle': { data: null, error: null },
      'profils.insert': { data: null, error: null },
    });
    const c = new CompteService(m.fournisseur);
    expect(await c.inscription('a@b.fr', 'secret1', 'Max')).toEqual({ ok: true, confirmation: false });
    expect(c.etat).toEqual({ statut: 'connecte', id: 'u1', email: 'a@b.fr', pseudo: 'Max' });
    const ins = m.appels.find((a) => a.nom === 'profils.insert');
    expect(ins?.args[0]).toEqual({ id: 'u1', pseudo: 'Max' });
  });

  it('email déjà inscrit (utilisateur sans identité) et erreurs de signUp', async () => {
    const m = faussClient({ signUp: { data: { user: { identities: [] }, session: null }, error: null } });
    const r = await new CompteService(m.fournisseur).inscription('a@b.fr', 'secret1', 'Max');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/existe déjà/);
    const m2 = faussClient({ signUp: { data: {}, error: { code: 'weak_password', message: 'x' } } });
    const r2 = await new CompteService(m2.fournisseur).inscription('a@b.fr', 'secret1', 'Max');
    expect(r2.ok).toBe(false);
  });

  it('connexion : lit le profil existant', async () => {
    const m = faussClient({
      signInWithPassword: { data: { session: session('u2', 'z@z.fr') }, error: null },
      'profils.select.maybeSingle': { data: { pseudo: 'Zoe' }, error: null },
    });
    const c = new CompteService(m.fournisseur);
    const vus: EtatCompte[] = [];
    c.onChange((e) => vus.push(e));
    expect(await c.connexion('z@z.fr', 'secret1')).toEqual({ ok: true });
    expect(c.etat).toEqual({ statut: 'connecte', id: 'u2', email: 'z@z.fr', pseudo: 'Zoe' });
    expect(vus).toHaveLength(1);
  });

  it('connexion refusée : message français, reste déconnecté', async () => {
    const m = faussClient({ signInWithPassword: { data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } } });
    const c = new CompteService(m.fournisseur);
    const r = await c.connexion('z@z.fr', 'faux');
    expect(r).toEqual({ ok: false, message: 'Email ou mot de passe incorrect.' });
    expect(c.etat.statut).toBe('deconnecte');
  });

  it('connecté sans profil ni pseudo enregistré : pseudo null (à choisir)', async () => {
    const m = faussClient({
      signInWithPassword: { data: { session: session() }, error: null },
      'profils.select.maybeSingle': { data: null, error: null },
    });
    const c = new CompteService(m.fournisseur);
    await c.connexion('a@b.fr', 'secret1');
    expect(c.etat).toMatchObject({ statut: 'connecte', pseudo: null });
    expect(m.appels.some((a) => a.nom === 'profils.insert')).toBe(false);
  });

  it('pseudo de l\'inscription déjà pris à la confirmation : note explicative', async () => {
    const m = faussClient({
      signInWithPassword: { data: { session: session('u1', 'a@b.fr', 'Max') }, error: null },
      'profils.select.maybeSingle': { data: null, error: null },
      'profils.insert': { data: null, error: { code: '23505', message: 'dup' } },
    });
    const c = new CompteService(m.fournisseur);
    await c.connexion('a@b.fr', 'secret1');
    expect(c.etat).toMatchObject({ statut: 'connecte', pseudo: null });
    expect((c.etat as { note?: string }).note).toMatch(/déjà pris/);
  });

  it('profil illisible (tables absentes) : connecté avec un message, sans crash', async () => {
    const m = faussClient({
      signInWithPassword: { data: { session: session() }, error: null },
      'profils.select.maybeSingle': { data: null, error: { code: 'PGRST205', message: 'no table' } },
    });
    const c = new CompteService(m.fournisseur);
    await c.connexion('a@b.fr', 'secret1');
    expect(c.etat).toMatchObject({ statut: 'connecte', pseudo: null });
    expect((c.etat as { note?: string }).note).toMatch(/pas encore disponible/);
  });

  it('restaure la session via onAuthStateChange, puis se déconnecte', async () => {
    const m = faussClient({ 'profils.select.maybeSingle': { data: { pseudo: 'Max' }, error: null } });
    const c = new CompteService(m.fournisseur);
    await c.demarrer();
    expect(m.ecoute()).toBe(true);
    m.emettre('INITIAL_SESSION', session('u1', 'a@b.fr'));
    await attendre();
    expect(c.etat).toMatchObject({ statut: 'connecte', pseudo: 'Max' });
    await c.deconnexion();
    expect(c.etat.statut).toBe('deconnecte');
    expect(m.appels.some((a) => a.nom === 'signOut')).toBe(true);
  });

  it('renouvellement de jeton : pas de nouvelle lecture du profil', async () => {
    const m = faussClient({ 'profils.select.maybeSingle': { data: { pseudo: 'Max' }, error: null } });
    const c = new CompteService(m.fournisseur);
    await c.demarrer();
    m.emettre('SIGNED_IN', session());
    await attendre();
    m.emettre('TOKEN_REFRESHED', session());
    await attendre();
    expect(m.appels.filter((a) => a.nom === 'profils.select.maybeSingle')).toHaveLength(1);
  });

  it('lien « mot de passe oublié » : état de récupération, puis nouveau mot de passe', async () => {
    const m = faussClient({ 'profils.select.maybeSingle': { data: { pseudo: 'Max' }, error: null } });
    const c = new CompteService(m.fournisseur);
    await c.demarrer();
    m.emettre('PASSWORD_RECOVERY', session());
    await attendre();
    expect(c.etat).toMatchObject({ statut: 'connecte', recuperation: true });
    expect((await c.changerMotDePasse('abc')).ok).toBe(false);
    expect(await c.changerMotDePasse('nouveau1')).toEqual({ ok: true });
    expect((c.etat as { recuperation?: boolean }).recuperation).toBe(false);
  });

  it('deconnexion reste locale même si le serveur échoue', async () => {
    const m = faussClient({ signInWithPassword: { data: { session: session() }, error: null }, 'profils.select.maybeSingle': { data: { pseudo: 'Max' }, error: null }, signOut: () => { throw new TypeError('Failed to fetch'); } });
    const c = new CompteService(m.fournisseur);
    await c.connexion('a@b.fr', 'secret1');
    await c.deconnexion();
    expect(c.etat.statut).toBe('deconnecte');
  });

  describe('definirPseudo', () => {
    const connecte = async (rep = {}) => {
      const m = faussClient({ signInWithPassword: { data: { session: session('u1') }, error: null }, 'profils.select.maybeSingle': { data: null, error: null }, ...rep });
      const c = new CompteService(m.fournisseur);
      await c.connexion('a@b.fr', 'secret1');
      return { m, c };
    };
    it('refuse hors connexion et pseudo invalide', async () => {
      const c = new CompteService(faussClient().fournisseur);
      expect((await c.definirPseudo('Max')).ok).toBe(false);
      const { c: c2 } = await connecte();
      expect((await c2.definirPseudo('x')).ok).toBe(false);
    });
    it('enregistre le pseudo (upsert sur id)', async () => {
      const { m, c } = await connecte({ 'profils.upsert': { data: null, error: null } });
      expect(await c.definirPseudo(' Max ')).toEqual({ ok: true });
      expect(c.etat).toMatchObject({ pseudo: 'Max' });
      expect(m.appels.find((a) => a.nom === 'profils.upsert')?.args[0]).toEqual({ id: 'u1', pseudo: 'Max' });
    });
    it('pseudo déjà pris (violation d\'unicité)', async () => {
      const { c } = await connecte({ 'profils.upsert': { data: null, error: { code: '23505', message: 'duplicate key' } } });
      expect(await c.definirPseudo('Max')).toEqual({ ok: false, message: 'Ce pseudo est déjà pris.' });
      expect(c.etat).toMatchObject({ pseudo: null });
    });
  });

  it('motDePasseOublie envoie le lien vers le site', async () => {
    const m = faussClient({ resetPasswordForEmail: { data: {}, error: null } });
    const c = new CompteService(m.fournisseur);
    expect(await c.motDePasseOublie('a@b.fr')).toEqual({ ok: true });
    const a = m.appels[0].args as [string, { redirectTo: string }];
    expect(a[0]).toBe('a@b.fr');
    expect(a[1].redirectTo).toMatch(/^https?:\/\//);
    expect((await c.motDePasseOublie('nul')).ok).toBe(false);
  });

  it('les écouteurs défaillants ne cassent pas le service, désabonnement possible', async () => {
    const m = faussClient({ signInWithPassword: { data: { session: session() }, error: null }, 'profils.select.maybeSingle': { data: { pseudo: 'M1' }, error: null } });
    const c = new CompteService(m.fournisseur);
    let n = 0;
    c.onChange(() => { throw new Error('mal écrit'); });
    const off = c.onChange(() => { n++; });
    await c.connexion('a@b.fr', 'secret1');
    expect(n).toBe(1);
    off();
    await c.deconnexion();
    expect(n).toBe(1);
  });
});
