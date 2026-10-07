import { h } from './screens';
import {
  COMMANDES_CLAVIER, COMMANDES_MANETTE, NOMS_COMMANDES, TOUCHES_PAR_COMMANDE, TOUCHE_RESERVEE,
  attribuerBouton, attribuerTouche, nomBouton, nomTouche, retirerTouche, touchesParDefaut,
  type CommandeClavier, type CommandeManette, type Touches, type TouchesClavier,
} from '../input/touches';
import type { GamepadInput } from '../input/gamepad';

/** Disposition réelle du clavier (Chrome, Edge) pour afficher le bon caractère ; null ailleurs. */
let disposition: ReadonlyMap<string, string> | null = null;
let dispositionLue = false;
function lireDisposition(apres: () => void): void {
  if (dispositionLue) return;
  dispositionLue = true;
  const kb = (navigator as Navigator & { keyboard?: { getLayoutMap?: () => Promise<ReadonlyMap<string, string>> } }).keyboard;
  void kb?.getLayoutMap?.().then((m) => { disposition = m; apres(); }, () => {});
}

const noms = (codes: string[]): string => codes.map((c) => nomTouche(c, disposition)).join(' ou ');

/** Rappel des touches de l'accueil, selon les touches choisies. */
export function aideTouches(t: TouchesClavier): string {
  const tourner = [...t.gauche, ...t.droite].length ? `${noms(t.gauche)} / ${noms(t.droite)} tourner` : '';
  return [
    t.gaz.length && `${noms(t.gaz)} accélérer`, t.frein.length && `${noms(t.frein)} freiner`, tourner,
    t.freinAMain.length && `${noms(t.freinAMain)} frein à main`, t.replacer.length && `${noms(t.replacer)} replacer`,
    t.recommencer.length && `${noms(t.recommencer)} recommencer`, t.camera.length && `${noms(t.camera)} caméra`,
    'Échap pause', 'manette prise en charge',
  ].filter(Boolean).join(' · ');
}

/**
 * Écran « Touches » : cliquer sur une case puis appuyer sur la touche (ou le bouton de manette) voulue.
 * Échap annule ; une touche déjà prise quitte son ancienne commande, un bouton déjà pris s'échange.
 */
export function ecranTouches(o: { touches: Touches; manette: GamepadInput; onChange(t: Touches): void; onRetour(): void }): HTMLElement {
  let t: Touches = { clavier: { ...o.touches.clavier }, manette: { ...o.touches.manette } };
  /** case en attente d'une touche */
  let attente: { type: 'clavier'; cmd: CommandeClavier; emplacement: number } | { type: 'manette'; cmd: CommandeManette } | null = null;
  let raf = 0;
  const racine = h('div', { class: 'screen' });

  const changer = (n: Touches): void => { t = n; o.onChange({ clavier: { ...t.clavier }, manette: { ...t.manette } }); };
  const finir = (): void => { attente = null; cancelAnimationFrame(raf); render(); };

  const onKey = (e: KeyboardEvent): void => {
    if (!racine.isConnected) { window.removeEventListener('keydown', onKey, true); cancelAnimationFrame(raf); return; }
    if (!attente || attente.type !== 'clavier') return;
    e.preventDefault();
    e.stopPropagation();
    if (e.code !== TOUCHE_RESERVEE) changer({ ...t, clavier: attribuerTouche(t.clavier, attente.cmd, attente.emplacement, e.code) });
    finir();
  };
  window.addEventListener('keydown', onKey, true);

  /** attend un bouton de manette relâché puis appuyé (le clic de la case ne compte pas) */
  const guetterManette = (): void => {
    let relache = false;
    const tour = (): void => {
      if (!racine.isConnected || !attente || attente.type !== 'manette') return;
      const b = o.manette.lireBouton();
      if (b === null) relache = true;
      else if (relache) { changer({ ...t, manette: attribuerBouton(t.manette, attente.cmd, b) }); finir(); return; }
      raf = requestAnimationFrame(tour);
    };
    raf = requestAnimationFrame(tour);
  };

  const caseClavier = (cmd: CommandeClavier, i: number): HTMLElement => {
    const code = t.clavier[cmd][i];
    const enAttente = attente?.type === 'clavier' && attente.cmd === cmd && attente.emplacement === i;
    return h('span', { class: 'touche-case' },
      h('button', {
        class: 'btn sm' + (enAttente ? ' attente' : code ? ' sec' : ' sec vide'),
        onclick: () => { attente = { type: 'clavier', cmd, emplacement: Math.min(i, t.clavier[cmd].length) }; render(); },
      }, enAttente ? 'Appuie…' : code ? nomTouche(code, disposition) : '+'),
      code && !enAttente && h('button', { class: 'retirer', title: 'Retirer cette touche', 'aria-label': 'Retirer', onclick: () => { changer({ ...t, clavier: retirerTouche(t.clavier, cmd, i) }); render(); } }, '×'),
    );
  };

  const render = (): void => {
    const lignesClavier = COMMANDES_CLAVIER.map((cmd) => {
      const n = Math.min(TOUCHES_PAR_COMMANDE, t.clavier[cmd].length + 1);
      return h('div', { class: 'touche-ligne' + (t.clavier[cmd].length === 0 ? ' manque' : '') },
        h('span', {}, NOMS_COMMANDES[cmd]),
        h('span', { class: 'touche-cases' }, ...Array.from({ length: n }, (_, i) => caseClavier(cmd, i))));
    });
    const lignesManette = COMMANDES_MANETTE.map((cmd) => {
      const enAttente = attente?.type === 'manette' && attente.cmd === cmd;
      return h('div', { class: 'touche-ligne' },
        h('span', {}, NOMS_COMMANDES[cmd]),
        h('button', {
          class: 'btn sm' + (enAttente ? ' attente' : ' sec'),
          onclick: () => { attente = { type: 'manette', cmd }; render(); guetterManette(); },
        }, enAttente ? 'Appuie sur un bouton…' : nomBouton(t.manette[cmd])));
    });
    racine.replaceChildren(h('div', { class: 'panel wide touches' },
      h('h2', {}, 'Touches'),
      h('p', { class: 'hint' }, 'Clique sur une case puis appuie sur la touche voulue (Échap annule). Une touche déjà utilisée quitte son ancienne commande. Échap met toujours en pause.'),
      h('h3', {}, 'Clavier'),
      h('div', { class: 'touches-liste' }, ...lignesClavier),
      h('h3', {}, 'Manette'),
      h('p', { class: 'hint' }, o.manette.active ? `Manette : ${o.manette.nom ?? 'branchée'}` : 'Branche une manette et appuie sur un de ses boutons pour la choisir.'),
      h('div', { class: 'touches-liste' }, ...lignesManette),
      h('p', { class: 'hint' }, 'Le stick gauche (et la croix, si ses boutons ne servent à rien d\'autre) sert toujours à tourner.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn sec', onclick: () => { changer(touchesParDefaut()); finir(); } }, 'Touches par défaut'),
        h('button', { class: 'btn', onclick: () => { window.removeEventListener('keydown', onKey, true); cancelAnimationFrame(raf); o.onRetour(); } }, 'Retour'),
      ),
    ));
  };
  render();
  lireDisposition(() => { if (racine.isConnected) render(); });
  return racine;
}
