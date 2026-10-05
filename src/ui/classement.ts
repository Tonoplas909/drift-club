import type { CarId, ModeId } from '../core/physics/types';
import { CARS } from '../core/physics/cars';
import { MODE_NOMS } from '../core/physics/assists';
import type { LigneClassement, MaPlace, RangEnLigne, Resultat } from '../online/classement';
import { h } from './screens';
import { formatScore, formatTime } from './format';

/** 1 → « 1er », 3 → « 3e ». */
export function rangFr(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

/** Ligne affichée sous un niveau : la place du joueur dans le classement en ligne (tous modes). */
export type EtatPlace = 'deconnecte' | 'chargement' | 'erreur' | { place: MaPlace | null };

export function textePlace(e: EtatPlace): string {
  if (e === 'deconnecte') return 'Connecte-toi pour voir ta place';
  if (e === 'chargement') return 'Classement…';
  if (e === 'erreur') return 'Classement indisponible';
  return e.place ? `Place : ${rangFr(e.place.rang)} sur ${e.place.total}` : 'Pas encore classé';
}

const nomVoiture = (id: string): string => CARS[id as CarId]?.nom ?? id;
const nomMode = (id: string): string => MODE_NOMS[id as ModeId] ?? id;

export interface OptionsClassement {
  /** nom du niveau */
  titre: string;
  /** id du joueur connecté, pour surligner sa ligne */
  moi: string | null;
  charger(): Promise<Resultat<LigneClassement[]>>;
  onRetour(): void;
}

/** Écran du classement d'un niveau (tous modes) : chargement, liste, vide ou erreur. Ne lève jamais. */
export function ecranClassement(o: OptionsClassement): HTMLElement {
  const corps = h('div', { class: 'cls-corps' });
  let essai = 0;
  const charger = (): void => {
    const n = ++essai;
    corps.replaceChildren(h('p', { class: 'sub' }, 'Chargement du classement…'));
    let p: Promise<Resultat<LigneClassement[]>>;
    try { p = o.charger(); } catch { p = Promise.resolve({ ok: false, message: 'Classement indisponible.' }); }
    void p.catch((): Resultat<LigneClassement[]> => ({ ok: false, message: 'Classement indisponible.' })).then((r) => {
      if (n !== essai) return;
      if (!r.ok) {
        corps.replaceChildren(
          h('p', { class: 'msg err' }, r.message),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: charger }, 'Réessayer')),
        );
      } else if (r.valeur.length === 0) {
        corps.replaceChildren(h('p', { class: 'sub' }, 'Aucun score pour l\'instant'));
      } else {
        corps.replaceChildren(tableau(r.valeur, o.moi));
      }
    });
  };
  charger();
  return h('div', { class: 'screen' }, h('div', { class: 'panel wide' },
    h('h2', {}, 'Classement'),
    h('p', { class: 'sub' }, h('b', {}, o.titre), ' · Tous modes'),
    corps,
    h('div', { class: 'row' }, h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour')),
  ));
}

function tableau(lignes: LigneClassement[], moi: string | null): HTMLElement {
  return h('div', { class: 'cls-liste' }, h('table', { class: 'cls' },
    h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Pseudo'), h('th', {}, 'Mode'), h('th', {}, 'Score'), h('th', {}, 'Temps'), h('th', { class: 'voi' }, 'Voiture'))),
    h('tbody', {}, ...lignes.map((l) =>
      h('tr', { class: moi !== null && l.joueur === moi ? 'moi' : '' },
        h('td', {}, String(l.rang)),
        h('td', { class: 'pseudo' }, l.pseudo),
        h('td', {}, nomMode(l.mode)),
        h('td', {}, formatScore(l.score)),
        h('td', {}, formatTime(l.temps)),
        h('td', { class: 'voi' }, nomVoiture(l.voiture)),
      ))),
  ));
}

/** Bloc « en ligne » de l'écran des résultats : jamais bloquant, se met à jour quand le réseau répond. */
export interface ZoneEnLigne {
  el: HTMLElement;
  envoi(): void;
  resultat(r: Resultat<RangEnLigne>): void;
  invite(texte: string, onCompte: () => void): void;
}

export function zoneEnLigne(): ZoneEnLigne {
  const el = h('div', { class: 'enligne' });
  return {
    el,
    envoi: () => el.replaceChildren(h('p', { class: 'sub' }, 'Envoi du score…')),
    resultat: (r) => {
      if (!r.ok) { el.replaceChildren(h('p', { class: 'msg err' }, `Score non envoyé : ${r.message}`)); return; }
      const { ameliore, rang, total, verification } = r.valeur;
      el.replaceChildren(
        ...(verification?.statut === 'corrige'
          ? [h('p', { class: 'msg err' }, `Course rejouée par le serveur : score retenu ${formatScore(verification.score)}.`)]
          : []),
        ...(ameliore ? [h('div', { class: 'badge' }, 'Nouveau record en ligne !')] : []),
        h('p', { class: 'rang' }, `Classement : ${rangFr(rang)} sur ${total}`),
        ...(ameliore ? [] : [h('p', { class: 'sub petit' }, 'Ton meilleur score en ligne est conservé.')]),
      );
    },
    invite: (texte, onCompte) => el.replaceChildren(
      h('p', { class: 'sub petit' }, texte),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: onCompte }, 'Compte')),
    ),
  };
}
