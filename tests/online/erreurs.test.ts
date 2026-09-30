import { describe, it, expect } from 'vitest';
import { validerPseudo, validerEmail, validerMotDePasse, messageErreur } from '../../src/online/compte';
import { MSG_INDISPONIBLE } from '../../src/online/erreurs';

describe('validerPseudo', () => {
  it('accepte les pseudos valides', () => {
    for (const p of ['Max', 'abc', 'Drift_King-99', 'Jean Michel', 'a'.repeat(20)]) expect(validerPseudo(p)).toBeNull();
  });
  it('refuse trop court, trop long, caractères interdits', () => {
    expect(validerPseudo('ab')).toMatch(/au moins 3/);
    expect(validerPseudo('  a ')).toMatch(/au moins 3/);
    expect(validerPseudo('a'.repeat(21))).toMatch(/au plus 20/);
    expect(validerPseudo('Zoé')).toMatch(/uniquement/);
    expect(validerPseudo('a<b>c')).toMatch(/uniquement/);
  });
});

describe('validerEmail / validerMotDePasse', () => {
  it('email', () => {
    expect(validerEmail('a@b.fr')).toBeNull();
    expect(validerEmail(' a.b+c@exemple.co.uk ')).toBeNull();
    expect(validerEmail('')).toMatch(/Entre/);
    expect(validerEmail('a@b')).toMatch(/valide/);
    expect(validerEmail('a b@c.fr')).toMatch(/valide/);
  });
  it('mot de passe', () => {
    expect(validerMotDePasse('123456')).toBeNull();
    expect(validerMotDePasse('12345')).toMatch(/au moins 6/);
    expect(validerMotDePasse('x'.repeat(73))).toMatch(/trop long/);
  });
});

describe('messageErreur', () => {
  it('erreurs d\'authentification courantes', () => {
    expect(messageErreur({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toMatch(/incorrect/);
    expect(messageErreur({ message: 'Invalid login credentials' })).toMatch(/incorrect/);
    expect(messageErreur({ code: 'email_not_confirmed' })).toMatch(/confirmé/);
    expect(messageErreur({ code: 'user_already_exists' })).toMatch(/existe déjà/);
    expect(messageErreur({ message: 'User already registered' })).toMatch(/existe déjà/);
    expect(messageErreur({ code: 'weak_password' })).toMatch(/faible/);
    expect(messageErreur({ code: 'over_email_send_rate_limit' })).toMatch(/Trop de/);
    expect(messageErreur({ status: 429, message: 'x' })).toMatch(/Trop de/);
  });
  it('réseau', () => {
    expect(messageErreur(new TypeError('Failed to fetch'))).toBe(MSG_INDISPONIBLE);
    expect(messageErreur({ name: 'AuthRetryableFetchError', message: 'x', status: 0 })).toBe(MSG_INDISPONIBLE);
  });
  it('base de données', () => {
    expect(messageErreur({ code: '23505', message: 'duplicate key' })).toBe('Ce pseudo est déjà pris.');
    expect(messageErreur({ code: 'PGRST202', message: 'no function' })).toMatch(/pas encore disponible/);
    expect(messageErreur({ code: '42P01', message: 'relation does not exist' })).toMatch(/pas encore disponible/);
    expect(messageErreur({ code: 'P0001', message: 'Temps invalide.' })).toBe('Temps invalide.');
    expect(messageErreur({ code: 'P0001', message: 'Voiture invalide.' })).toMatch(/pas encore acceptée/);
    expect(messageErreur({ code: '23514', message: 'new row violates check constraint "scores_voiture_valide"' })).toMatch(/pas encore acceptée/);
  });
  it('niveaux en ligne', () => {
    expect(messageErreur({ code: 'PGRST202', message: 'Could not find the function public.niveaux_en_ligne(p_decalage) in the schema cache' })).toBe('Les niveaux en ligne ne sont pas encore disponibles.');
    expect(messageErreur({ code: '42P01', message: 'relation "public.niveaux_publics" does not exist' })).toMatch(/niveaux en ligne/);
    expect(messageErreur({ code: '42501', message: 'permission denied for function publier_niveau' })).toMatch(/Connecte-toi/);
    expect(messageErreur({ code: 'P0001', message: 'Limite atteinte : 50 niveaux publiés au maximum.' })).toMatch(/^Limite atteinte/);
  });
  it('inconnu : message générique, jamais de crash', () => {
    for (const e of [null, undefined, 'boom', 42, {}, { message: 12 }]) expect(messageErreur(e)).toMatch(/erreur/i);
  });
});
