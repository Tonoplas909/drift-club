import { h } from './screens';

export interface OptionsDialogue {
  titre: string;
  /** paragraphes (ou lignes d'erreur) */
  lignes?: string[];
  /** champ texte : valeur initiale et longueur maximale */
  champ?: { valeur: string; max: number; label: string };
  ok?: string;
  annuler?: string | null;
  /** boutons de choix supplémentaires (ex. liste de niveaux) */
  choix?: { label: string; detail?: string; valeur: string }[];
}

export type ResultatDialogue = { ok: boolean; texte: string; choix: string | null };

/** Fenêtre modale par-dessus l'écran courant ; se ferme avec Échap ou un clic sur le fond. */
export function dialogue(root: HTMLElement, o: OptionsDialogue): Promise<ResultatDialogue> {
  return new Promise((resolve) => {
    let input: HTMLInputElement | null = null;
    const fin = (ok: boolean, choix: string | null = null): void => {
      overlay.remove();
      window.removeEventListener('keydown', onKey, true);
      resolve({ ok, texte: input?.value ?? '', choix });
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') { e.stopPropagation(); fin(false); }
      else if (e.key === 'Enter' && input) { e.stopPropagation(); fin(true); }
    };
    if (o.champ) {
      input = h('input', { type: 'text', maxlength: String(o.champ.max), 'aria-label': o.champ.label, spellcheck: 'false' });
      input.value = o.champ.valeur;
    }
    const actions = [
      o.annuler !== null && h('button', { class: 'btn sec', onclick: () => fin(false) }, o.annuler ?? 'Annuler'),
      o.ok !== '' && (o.champ || !o.choix) && h('button', { class: 'btn', onclick: () => fin(true) }, o.ok ?? 'OK'),
    ];
    const overlay = h('div', { class: 'modal', onclick: (e: Event) => { if (e.target === overlay) fin(false); } },
      h('div', { class: 'panel', role: 'dialog', 'aria-label': o.titre },
        h('h2', {}, o.titre),
        ...(o.lignes ?? []).map((l) => h('p', { class: 'pre' }, l)),
        input && h('label', { class: 'ed-f' }, h('span', {}, o.champ!.label), input),
        o.choix && h('div', { class: 'choices' }, ...o.choix.map((c) =>
          h('button', { class: 'choice', onclick: () => fin(true, c.valeur) }, h('b', {}, c.label), c.detail && h('small', {}, c.detail)))),
        h('div', { class: 'row' }, ...actions),
      ));
    window.addEventListener('keydown', onKey, true);
    root.append(overlay);
    input?.focus();
    input?.select();
  });
}
