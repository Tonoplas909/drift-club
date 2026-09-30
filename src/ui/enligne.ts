import type { Resultat } from '../online/classement';
import type { NiveauEnLigne, PageNiveaux, TriNiveaux } from '../online/niveaux';
import { dateCourte } from '../editor/format';
import { dialogue } from './dialog';
import { formatDistance } from './format';
import { h } from './screens';

export interface OptionsEnLigne {
  /** où afficher la confirmation de retrait */
  root: HTMLElement;
  lister(tri: TriNiveaux, page: number): Promise<Resultat<PageNiveaux>>;
  /** id du compte connecté (pour proposer « Retirer » sur ses propres niveaux) */
  moi(): string | null;
  /** lance la course ; un échec (réseau, niveau invalide) revient en message sous la carte */
  onJouer(n: NiveauEnLigne): Promise<Resultat<null>>;
  onClassement(n: NiveauEnLigne): void;
  onEnregistrer(n: NiveauEnLigne): Promise<Resultat<null>>;
  onRetirer(n: NiveauEnLigne): Promise<Resultat<null>>;
}

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Onglet « En ligne » : niveaux publiés, tri, pagination. Tout est rendu en nœuds texte ; ne lève jamais. */
export function panneauEnLigne(o: OptionsEnLigne): HTMLElement {
  let tri: TriNiveaux = 'recent';
  let niveaux: NiveauEnLigne[] = [];
  let page = 0;
  let plus = false;
  let essai = 0;
  let etat: { type: 'chargement' } | { type: 'ok' } | { type: 'erreur'; message: string } = { type: 'chargement' };

  const liste = h('div', { class: 'niv-liste enl-liste' });
  const pied = h('div', { class: 'enl-pied' });
  const tris = h('div', { class: 'seg' });
  const racine = h('div', { class: 'enl' }, tris, liste, pied);

  const charger = (raz: boolean): void => {
    const n = ++essai;
    if (raz) { niveaux = []; page = 0; plus = false; }
    etat = { type: 'chargement' };
    rendre();
    let p: Promise<Resultat<PageNiveaux>>;
    try { p = o.lister(tri, page); } catch { p = Promise.resolve({ ok: false, message: 'Liste indisponible.' }); }
    void p.catch((): Resultat<PageNiveaux> => ({ ok: false, message: 'Liste indisponible.' })).then((r) => {
      if (n !== essai) return;
      if (r.ok) { niveaux = niveaux.concat(r.valeur.niveaux); plus = r.valeur.plus; etat = { type: 'ok' }; }
      else etat = { type: 'erreur', message: r.message };
      rendre();
    });
  };

  const carte = (n: NiveauEnLigne): HTMLElement => {
    const msg = h('small', { class: 'enl-msg' });
    const dire = (t: string, ok = false): void => { msg.textContent = t; msg.className = 'enl-msg ' + (ok ? 'ok' : 'err'); };
    /** bouton d'action : désactivé pendant l'opération, message si échec ; `f` renvoie true pour le laisser désactivé */
    const action = (label: string, titre: string, f: (b: HTMLButtonElement) => Promise<boolean | void> | void): HTMLButtonElement => {
      const b = h('button', { class: 'btn sec sm', title: titre }, label);
      b.addEventListener('click', () => {
        b.disabled = true;
        msg.textContent = '';
        void Promise.resolve(f(b)).catch(() => { dire('Une erreur est survenue.'); return false; }).then((garder) => { b.disabled = garder === true; });
      });
      return b;
    };
    const jouer = action('Jouer', 'Jouer ce niveau', async () => {
      dire('Chargement…', true);
      const r = await o.onJouer(n);
      if (!r.ok) dire(r.message);
    });
    jouer.classList.remove('sec');
    const enregistrer = action('Enregistrer', 'Enregistrer dans mes niveaux', async (b) => {
      const r = await o.onEnregistrer(n);
      if (!r.ok) { dire(r.message); return; }
      dire('Ajouté à Mes niveaux.', true);
      b.textContent = 'Enregistré';
      return true;
    });
    const mien = o.moi() !== null && o.moi() === n.auteur;
    return h('div', { class: 'niv' },
      h('div', { class: 'niv-info' },
        h('b', {}, n.nom),
        h('small', {}, [`par ${n.auteurPseudo}`, formatDistance(n.longueur), pluriel(n.parties, 'partie'), dateCourte(n.creeLe)].filter(Boolean).join(' · ')),
        msg),
      h('div', { class: 'niv-actions' },
        jouer,
        action('Classement', 'Classement de ce niveau', () => o.onClassement(n)),
        enregistrer,
        mien && action('Retirer', 'Retirer ce niveau de la liste en ligne', async () => {
          const c = await dialogue(o.root, { titre: 'Retirer ce niveau ?', lignes: [`« ${n.nom} » ne sera plus disponible en ligne. Ses classements disparaîtront de la liste.`], ok: 'Retirer' });
          if (!c.ok) return;
          const r = await o.onRetirer(n);
          if (!r.ok) { dire(r.message); return; }
          niveaux = niveaux.filter((x) => x.id !== n.id);
          rendre();
        }),
      ));
  };

  const rendre = (): void => {
    tris.replaceChildren(...([['recent', 'Récents'], ['populaire', 'Populaires']] as const).map(([t, label]) =>
      h('button', { class: 'tab' + (tri === t ? ' on' : ''), onclick: () => { if (tri !== t) { tri = t; charger(true); } } }, label)));
    liste.replaceChildren(...niveaux.map(carte));
    if (etat.type === 'chargement') {
      pied.replaceChildren(h('p', { class: 'sub' }, 'Chargement des niveaux…'));
    } else if (etat.type === 'erreur') {
      pied.replaceChildren(
        h('p', { class: 'msg err' }, etat.message),
        h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => charger(niveaux.length === 0) }, 'Réessayer')),
      );
    } else if (niveaux.length === 0) {
      pied.replaceChildren(h('p', { class: 'sub' }, 'Aucun niveau en ligne pour l’instant. Sois le premier : dans l’éditeur, Partager puis « Publier en ligne ».'));
    } else {
      pied.replaceChildren(...(plus ? [h('div', { class: 'row' }, h('button', { class: 'btn sec sm', onclick: () => { page++; charger(false); } }, 'Plus'))] : []));
    }
  };

  charger(true);
  return racine;
}
