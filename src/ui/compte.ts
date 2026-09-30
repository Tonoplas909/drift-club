import type { CompteService, Issue } from '../online/compte';
import { PSEUDO_MAX } from '../online/compte';
import { h } from './screens';

/** Valeurs saisies, conservées quand l'écran se redessine (changement d'onglet, mise à jour du compte). */
type Champs = { email: string; mdp: string; pseudo: string; pseudoEdit: string | null; nouveauMdp: string };

/** Écran Compte : connexion / inscription, ou pseudo et déconnexion une fois connecté. Se met à jour tout seul. */
export function ecranCompte(compte: CompteService, o: { onRetour(): void }): HTMLElement {
  const racine = h('div', { class: 'screen' });
  let onglet: 'connexion' | 'inscription' = 'connexion';
  const v: Champs = { email: '', mdp: '', pseudo: '', pseudoEdit: null, nouveauMdp: '' };
  let msg: { texte: string; ok: boolean } | null = null;

  const champ = (label: string, type: string, cle: 'email' | 'mdp' | 'pseudo' | 'nouveauMdp' | 'pseudoEdit', auto: string, max?: number, valeur?: string): HTMLElement =>
    h('label', { class: 'champ' }, h('span', {}, label),
      h('input', {
        type, value: valeur ?? v[cle] ?? '', autocomplete: auto, spellcheck: 'false', autocapitalize: 'off',
        ...(max ? { maxlength: String(max) } : {}),
        oninput: (e: Event) => { v[cle] = (e.target as HTMLInputElement).value; },
      }));

  const info = (): HTMLElement => h('p', { class: 'msg' + (msg ? (msg.ok ? ' ok' : ' err') : ''), role: 'status' }, msg?.texte ?? '');
  const dire = (texte: string, ok: boolean): void => {
    msg = { texte, ok };
    const el = racine.querySelector('[role=status]');
    if (el) { el.textContent = texte; el.className = 'msg ' + (ok ? 'ok' : 'err'); }
  };

  /** Lance une action : bouton grisé pendant l'attente, message d'erreur affiché sous le formulaire. */
  const agir = async (bouton: HTMLButtonElement, f: () => Promise<Issue>, ok: () => void): Promise<void> => {
    const libelle = bouton.textContent;
    bouton.disabled = true;
    bouton.textContent = 'Un instant…';
    const r = await f();
    bouton.disabled = false;
    bouton.textContent = libelle;
    if (r.ok) ok(); else dire(r.message, false);
  };

  const vueDeconnecte = (): HTMLElement[] => {
    const inscription = onglet === 'inscription';
    const valider = h('button', { class: 'btn', type: 'submit' }, inscription ? "S'inscrire" : 'Se connecter');
    const soumettre = (e: Event): void => {
      e.preventDefault();
      if (inscription) {
        void agir(valider, async () => {
          const r = await compte.inscription(v.email, v.mdp, v.pseudo);
          if (r.ok && r.confirmation) dire("Compte créé ! Un email de confirmation vient de t'être envoyé : clique sur le lien qu'il contient, puis connecte-toi.", true);
          return r.ok ? { ok: true } : r;
        }, () => { /* connecté sans confirmation : l'écran se met à jour tout seul */ });
      } else {
        void agir(valider, () => compte.connexion(v.email, v.mdp), () => { msg = null; });
      }
    };
    return [
      h('h2', {}, 'Compte'),
      h('p', { class: 'sub' }, 'Crée un compte pour apparaître au classement en ligne. Le jeu reste jouable sans.'),
      h('div', { class: 'tabs' },
        h('button', { class: 'tab' + (inscription ? '' : ' on'), type: 'button', onclick: () => { onglet = 'connexion'; msg = null; render(); } }, 'Connexion'),
        h('button', { class: 'tab' + (inscription ? ' on' : ''), type: 'button', onclick: () => { onglet = 'inscription'; msg = null; render(); } }, 'Inscription'),
      ),
      h('form', { class: 'form', novalidate: true, onsubmit: soumettre },
        champ('Email', 'email', 'email', 'email'),
        champ('Mot de passe', 'password', 'mdp', inscription ? 'new-password' : 'current-password'),
        inscription && champ('Pseudo (visible dans le classement)', 'text', 'pseudo', 'nickname', PSEUDO_MAX),
        info(),
        h('div', { class: 'row' }, valider),
        !inscription && h('button', {
          class: 'lien', type: 'button',
          onclick: (e: Event) => void agir(e.currentTarget as HTMLButtonElement, () => compte.motDePasseOublie(v.email),
            () => dire("Si un compte existe pour cette adresse, un email de réinitialisation vient d'être envoyé.", true)),
        }, 'Mot de passe oublié ?'),
      ),
      h('div', { class: 'row' }, h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour')),
    ];
  };

  const vueConnecte = (): (HTMLElement | null)[] => {
    const e = compte.etat;
    if (e.statut !== 'connecte') return [];
    const sansPseudo = e.pseudo === null;
    const enregistrer = h('button', { class: 'btn', type: 'submit' }, sansPseudo ? 'Choisir ce pseudo' : 'Enregistrer');
    const changer = h('button', { class: 'btn', type: 'submit' }, 'Changer le mot de passe');
    return [
      h('h2', {}, 'Compte'),
      sansPseudo
        ? h('p', { class: 'sub' }, 'Choisis un pseudo : il apparaîtra dans le classement en ligne.')
        : h('p', { class: 'sub' }, 'Connecté en tant que ', h('b', {}, e.pseudo)),
      e.note ? h('p', { class: 'msg err' }, e.note) : null,
      e.recuperation ? h('form', {
        class: 'form', novalidate: true,
        onsubmit: (ev: Event) => { ev.preventDefault(); void agir(changer, () => compte.changerMotDePasse(v.nouveauMdp), () => { v.nouveauMdp = ''; dire('Mot de passe changé.', true); render(); }); },
      }, champ('Nouveau mot de passe', 'password', 'nouveauMdp', 'new-password'), h('div', { class: 'row' }, changer)) : null,
      h('form', {
        class: 'form', novalidate: true,
        onsubmit: (ev: Event) => { ev.preventDefault(); void agir(enregistrer, () => compte.definirPseudo(v.pseudoEdit ?? e.pseudo ?? ''), () => { v.pseudoEdit = null; dire('Pseudo enregistré.', true); }); },
      },
        champ('Pseudo', 'text', 'pseudoEdit', 'nickname', PSEUDO_MAX, v.pseudoEdit ?? e.pseudo ?? ''),
        h('div', { class: 'row' }, enregistrer),
      ),
      info(),
      h('p', { class: 'sub petit' }, `Email : ${e.email}`),
      h('div', { class: 'row' },
        h('button', { class: 'btn sec', onclick: () => void compte.deconnexion() }, 'Déconnexion'),
        h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour'),
      ),
    ];
  };

  const render = (): void => {
    const connecte = compte.etat.statut === 'connecte';
    racine.replaceChildren(h('div', { class: 'panel' }, ...(connecte ? vueConnecte() : vueDeconnecte())));
  };

  const arreter = compte.onChange(() => {
    if (!racine.isConnected) { arreter(); return; }
    msg = null;
    render();
  });
  render();
  return racine;
}
