import type { Actions } from './keyboard';

/**
 * Touches personnalisables. Clavier : codes physiques (`KeyboardEvent.code`, indépendants de la disposition
 * AZERTY / QWERTY), deux touches au plus par commande. Manette : un bouton (disposition « standard ») par commande.
 */

export type CommandeClavier = 'gaz' | 'frein' | 'gauche' | 'droite' | 'freinAMain' | keyof Actions;
export type CommandeManette = 'gaz' | 'frein' | 'freinAMain' | 'replacer' | 'camera' | 'pause' | 'recommencer';

export const COMMANDES_CLAVIER: readonly CommandeClavier[] = ['gaz', 'frein', 'gauche', 'droite', 'freinAMain', 'replacer', 'recommencer', 'camera', 'pause', 'muet', 'pleinEcran'];
export const COMMANDES_MANETTE: readonly CommandeManette[] = ['gaz', 'frein', 'freinAMain', 'replacer', 'camera', 'pause', 'recommencer'];

export const NOMS_COMMANDES: Record<CommandeClavier, string> = {
  gaz: 'Accélérer', frein: 'Freiner', gauche: 'Tourner à gauche', droite: 'Tourner à droite', freinAMain: 'Frein à main',
  replacer: 'Replacer la voiture', recommencer: 'Recommencer', camera: 'Caméra', pause: 'Pause', muet: 'Couper le son', pleinEcran: 'Plein écran',
};

/** deux touches au plus par commande */
export const TOUCHES_PAR_COMMANDE = 2;

export type TouchesClavier = Record<CommandeClavier, string[]>;
export type BoutonsManette = Record<CommandeManette, number>;

export interface Touches { clavier: TouchesClavier; manette: BoutonsManette }

export const TOUCHES_DEFAUT: Readonly<Touches> = Object.freeze({
  clavier: Object.freeze({
    gaz: ['KeyW', 'ArrowUp'], frein: ['KeyS', 'ArrowDown'], gauche: ['KeyA', 'ArrowLeft'], droite: ['KeyD', 'ArrowRight'],
    freinAMain: ['Space'], replacer: ['KeyR'], recommencer: ['Backspace'], camera: ['KeyC'], pause: ['KeyP'], muet: ['KeyM'], pleinEcran: ['KeyF'],
  }) as TouchesClavier,
  // A / Croix = 0, B / Rond = 1, Y / Triangle = 3, LT = 6, RT = 7, Select = 8, Start = 9
  manette: Object.freeze({ gaz: 7, frein: 6, freinAMain: 0, replacer: 1, camera: 3, pause: 9, recommencer: 8 }) as BoutonsManette,
});

/** Échap met toujours en pause (et ferme les menus) : on ne peut ni l'attribuer ni le retirer. */
export const TOUCHE_RESERVEE = 'Escape';

export function touchesParDefaut(): Touches {
  return {
    clavier: Object.fromEntries(COMMANDES_CLAVIER.map((c) => [c, [...TOUCHES_DEFAUT.clavier[c]]])) as TouchesClavier,
    manette: { ...TOUCHES_DEFAUT.manette },
  };
}

const codeValide = (c: unknown): c is string => typeof c === 'string' && /^[A-Za-z0-9]{1,24}$/.test(c) && c !== TOUCHE_RESERVEE;
const boutonValide = (b: unknown): b is number => typeof b === 'number' && Number.isInteger(b) && b >= 0 && b < 32;

/** Relit des touches enregistrées : chaque commande garde ses touches valides, sans doublon d'une commande à l'autre. */
export function lireTouches(v: unknown): Touches {
  const d = touchesParDefaut();
  const o = typeof v === 'object' && v !== null ? v as Record<string, unknown> : {};
  const c = typeof o.clavier === 'object' && o.clavier !== null ? o.clavier as Record<string, unknown> : {};
  const m = typeof o.manette === 'object' && o.manette !== null ? o.manette as Record<string, unknown> : {};
  const vus = new Set<string>();
  const clavier = {} as TouchesClavier;
  for (const cmd of COMMANDES_CLAVIER) {
    const brut = c[cmd];
    const liste = Array.isArray(brut) ? brut.filter(codeValide) : d.clavier[cmd];
    clavier[cmd] = liste.filter((k) => !vus.has(k) && (vus.add(k), true)).slice(0, TOUCHES_PAR_COMMANDE);
  }
  const manette = {} as BoutonsManette;
  for (const cmd of COMMANDES_MANETTE) manette[cmd] = boutonValide(m[cmd]) ? m[cmd] : d.manette[cmd];
  return { clavier, manette };
}

/**
 * Attribue `code` à la commande, à la place `emplacement` (0 ou 1). La touche quitte la commande qui l'avait :
 * une touche ne fait jamais deux choses.
 */
export function attribuerTouche(t: TouchesClavier, cmd: CommandeClavier, emplacement: number, code: string): TouchesClavier {
  if (!codeValide(code)) return t;
  const r = Object.fromEntries(COMMANDES_CLAVIER.map((c) => [c, t[c].filter((k) => k !== code)])) as TouchesClavier;
  const liste = [...r[cmd]];
  const i = Math.max(0, Math.min(emplacement, liste.length, TOUCHES_PAR_COMMANDE - 1));
  liste[i] = code;
  r[cmd] = liste.slice(0, TOUCHES_PAR_COMMANDE);
  return r;
}

/** Retire une touche d'une commande. */
export function retirerTouche(t: TouchesClavier, cmd: CommandeClavier, emplacement: number): TouchesClavier {
  return { ...t, [cmd]: t[cmd].filter((_, i) => i !== emplacement) };
}

/** Attribue un bouton de manette ; s'il servait à une autre commande, les deux s'échangent leurs boutons. */
export function attribuerBouton(m: BoutonsManette, cmd: CommandeManette, bouton: number): BoutonsManette {
  if (!boutonValide(bouton)) return m;
  const r = { ...m };
  const autre = COMMANDES_MANETTE.find((c) => c !== cmd && m[c] === bouton);
  if (autre) r[autre] = m[cmd];
  r[cmd] = bouton;
  return r;
}

const NOMS_SPECIAUX: Record<string, string> = {
  Space: 'Espace', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backspace: '⌫', Enter: 'Entrée', Tab: 'Tab',
  ShiftLeft: 'Maj gauche', ShiftRight: 'Maj droite', ControlLeft: 'Ctrl gauche', ControlRight: 'Ctrl droite', AltLeft: 'Alt', AltRight: 'Alt Gr',
  CapsLock: 'Verr. maj', Escape: 'Échap', Delete: 'Suppr', Insert: 'Inser', Home: 'Début', End: 'Fin', PageUp: 'Page ↑', PageDown: 'Page ↓',
};

/**
 * Nom à afficher pour une touche. `disposition` (lue par `navigator.keyboard.getLayoutMap()`, si le navigateur le
 * permet) donne le caractère réel ; sinon les lettres qui changent de place entre AZERTY et QWERTY s'affichent
 * sous leurs deux noms (« Z/W »).
 */
export function nomTouche(code: string, disposition?: ReadonlyMap<string, string> | null): string {
  const lu = disposition?.get(code);
  if (lu && lu.trim()) return lu.toUpperCase();
  if (NOMS_SPECIAUX[code]) return NOMS_SPECIAUX[code];
  const deuxNoms: Record<string, string> = { KeyA: 'Q/A', KeyQ: 'A/Q', KeyW: 'Z/W', KeyZ: 'W/Z', KeyM: ',/M', Semicolon: 'M/;' };
  if (deuxNoms[code]) return deuxNoms[code];
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad/.test(code)) return 'Pavé ' + code.slice(6);
  return code;
}

const NOMS_BOUTONS: Record<number, string> = {
  0: 'A / Croix', 1: 'B / Rond', 2: 'X / Carré', 3: 'Y / Triangle', 4: 'LB / L1', 5: 'RB / R1', 6: 'LT / L2', 7: 'RT / R2',
  8: 'Select / Share', 9: 'Start / Options', 10: 'Stick gauche', 11: 'Stick droit', 12: 'Croix ↑', 13: 'Croix ↓', 14: 'Croix ←', 15: 'Croix →', 16: 'Bouton central',
};

export function nomBouton(b: number): string {
  return NOMS_BOUTONS[b] ?? `Bouton ${b + 1}`;
}
