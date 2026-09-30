import { NOTES } from '../notes';
import { modale } from './dialog';
import { h } from './screens';

const CLE_VUE = 'driftclub.v1.versionVue';

/** Fenêtre « Nouveautés » : l'historique des mises à jour, la plus récente en premier. */
export function ouvrirNouveautes(root: HTMLElement): void {
  modale(root, 'Nouveautés', (fermer) => [
    h('div', { class: 'notes' }, ...NOTES.map((n, i) =>
      h('section', { class: 'note' + (i === 0 ? ' derniere' : '') },
        h('h3', {}, `v${n.version}`, h('span', {}, ` · ${n.titre}`)),
        h('small', {}, n.date),
        h('ul', {}, ...n.notes.map((t) => h('li', {}, t))),
      ))),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: fermer }, 'Fermer')),
  ]);
}

/** Bouton de version en bas à gauche des menus : ouvre les nouveautés, badge si la version n'a pas encore été vue. */
export function brancherBoutonVersion(bouton: HTMLElement, root: HTMLElement, version: string, build: string): void {
  const lire = (): string | null => { try { return localStorage.getItem(CLE_VUE); } catch { return null; } };
  const marquerVue = (): void => { try { localStorage.setItem(CLE_VUE, version); } catch { /* stockage refusé */ } };
  bouton.textContent = `${version} · Nouveautés`;
  bouton.title = build;
  // premier lancement : rien de « nouveau » à signaler, on retient simplement la version
  const vue = lire();
  if (vue === null) marquerVue();
  else bouton.classList.toggle('nouveau', vue !== version);
  bouton.addEventListener('click', () => {
    bouton.classList.remove('nouveau');
    marquerVue();
    ouvrirNouveautes(root);
  });
}
