import type { GainCourse } from '../core/economie';
import { h, blocGains } from './screens';

/** Bloc « clés » des résultats quand elles viennent du compte : rempli après la réponse du serveur, jamais bloquant. */
export interface ZoneGains {
  el: HTMLElement;
  /** en attente de la réponse du serveur */
  envoi(): void;
  /** clés créditées (ou 0 : rien cette fois) et total du compte */
  gain(g: GainCourse, onCaisses: () => void): void;
  /** clés non créditées (hors ligne, erreur) ou explication */
  note(texte: string): void;
  /** total du compte changé depuis (caisses ouvertes) : le bloc est redessiné avec le nouveau total */
  majTotal(total: number): void;
}

export function zoneGains(): ZoneGains {
  const el = h('div', { class: 'gains-zone' });
  let dernier: { g: GainCourse; onCaisses: () => void } | null = null;
  const dessiner = (): void => {
    if (!dernier) return;
    const { g, onCaisses } = dernier;
    el.replaceChildren(g.arrivee + g.record > 0 ? blocGains(g, onCaisses) : h('p', { class: 'sub petit' }, `Pas de clé cette fois : la précédente est trop récente. Total : ${g.total} clé${g.total > 1 ? 's' : ''}.`));
  };
  return {
    el,
    envoi: () => { dernier = null; el.replaceChildren(h('p', { class: 'sub petit' }, 'Clés du compte…')); },
    gain: (g, onCaisses) => { dernier = { g, onCaisses }; dessiner(); },
    note: (texte) => { dernier = null; el.replaceChildren(h('p', { class: 'sub petit' }, texte)); },
    majTotal: (total) => { if (dernier) { dernier = { ...dernier, g: { ...dernier.g, total } }; dessiner(); } },
  };
}
