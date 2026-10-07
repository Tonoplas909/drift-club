import { h } from './screens';
import { formatDistance, formatScore, formatTime, libelleAmbiance } from './format';
import { CARS } from '../core/physics/cars';
import { THEMES } from '../core/env/themes';
import { jourEnClair, type DefiDuJour } from '../core/defi';
import type { CarId } from '../core/physics/types';
import type { LigneClassement, Resultat } from '../online/classement';
import type { DefiPasse } from '../online/defi';
import { iconeCle } from './svg';

/** Clés du podium de chaque défi (mêmes valeurs que la migration 0011). */
export const RECOMPENSES_DEFI: readonly [number, number, number] = [5, 3, 2];

/**
 * Écran « Défi du jour » : le niveau du jour (décor, ambiance, météo, voiture imposée), son classement, les
 * récompenses du podium et les vainqueurs des derniers défis.
 */
export function ecranDefi(o: {
  defi: DefiDuJour;
  longueur: number;
  /** meilleur score de l'appareil sur ce défi */
  record: { score: number; temps: number } | null;
  /** id du joueur connecté (pour surligner sa ligne) */
  moi: string | null;
  classement: () => Promise<Resultat<LigneClassement[]>>;
  passes: () => Promise<Resultat<DefiPasse[]>>;
  onJouer(): void;
  onClassement(): void;
  onRetour(): void;
}): HTMLElement {
  const l = o.defi.level;
  const voiture = CARS[o.defi.voiture as CarId];
  const zoneClassement = h('div', { class: 'defi-classement' }, h('p', { class: 'hint' }, 'Chargement du classement…'));
  const zonePasses = h('div', { class: 'defi-passes' }, h('p', { class: 'hint' }, 'Chargement…'));

  void o.classement().then((r) => {
    if (!r.ok) { zoneClassement.replaceChildren(h('p', { class: 'hint' }, r.message)); return; }
    if (r.valeur.length === 0) { zoneClassement.replaceChildren(h('p', { class: 'hint' }, 'Personne n\'a encore couru ce défi : à toi la première place !')); return; }
    zoneClassement.replaceChildren(h('table', { class: 'detail defi-table' }, ...r.valeur.slice(0, 10).map((x) =>
      h('tr', { class: x.joueur === o.moi ? 'moi' : '' }, h('td', {}, `${x.rang}.`), h('td', {}, x.pseudo), h('td', {}, formatScore(x.score)), h('td', {}, formatTime(x.temps))))));
  });
  void o.passes().then((r) => {
    if (!r.ok) { zonePasses.replaceChildren(h('p', { class: 'hint' }, r.message)); return; }
    const lignes = r.valeur.filter((p) => p.pseudo !== null);
    if (lignes.length === 0) { zonePasses.replaceChildren(h('p', { class: 'hint' }, 'Pas encore de vainqueur : les premiers défis commencent aujourd\'hui.')); return; }
    zonePasses.replaceChildren(h('table', { class: 'detail defi-table' }, ...lignes.map((p) =>
      h('tr', {}, h('td', {}, jourEnClair(p.jour)), h('td', {}, `🏆 ${p.pseudo}`), h('td', {}, formatScore(p.score ?? 0)), h('td', {}, `${p.joueurs} pilote${p.joueurs > 1 ? 's' : ''}`)))));
  });

  return h('div', { class: 'screen' }, h('div', { class: 'panel wide defi' },
    h('h2', {}, 'Défi du jour'),
    h('div', { class: 'defi-carte' },
      h('div', {},
        h('b', { class: 'defi-nom' }, l.nom),
        h('small', {}, `${formatDistance(o.longueur)} · ${THEMES[l.environnement].nom} · ${libelleAmbiance(l)}`),
        h('span', { class: 'defi-voiture' }, 'Voiture imposée : ', h('b', {}, voiture.nom)),
        o.record && h('span', { class: 'rec' }, `Ton meilleur : ${formatScore(o.record.score)} (${formatTime(o.record.temps)})`),
      ),
      h('button', { class: 'btn big', onclick: o.onJouer }, 'Jouer'),
    ),
    h('p', { class: 'defi-recompenses' }, iconeCle(), `Podium récompensé : ${RECOMPENSES_DEFI[0]} clés au 1er, ${RECOMPENSES_DEFI[1]} au 2e, ${RECOMPENSES_DEFI[2]} au 3e. Un nouveau défi chaque jour à minuit ; les clés arrivent quand tu reviens ici le lendemain.`),
    h('div', { class: 'defi-colonnes' },
      h('div', {}, h('h3', {}, 'Classement du jour'), zoneClassement, h('button', { class: 'btn sm sec', onclick: o.onClassement }, 'Classement complet')),
      h('div', {}, h('h3', {}, 'Défis passés'), zonePasses),
    ),
    h('button', { class: 'btn sec', onclick: o.onRetour }, 'Retour'),
  ));
}
