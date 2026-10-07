import type { InputState } from '../core/input';
import { TOUCHES_DEFAUT, TOUCHE_RESERVEE, COMMANDES_CLAVIER, touchesParDefaut, type TouchesClavier } from './touches';

export interface Actions { replacer: boolean; recommencer: boolean; pause: boolean; camera: boolean; muet: boolean; pleinEcran: boolean }
export const NO_ACTIONS: Readonly<Actions> = Object.freeze({ replacer: false, recommencer: false, pause: false, camera: false, muet: false, pleinEcran: false });

const ACTIONS: (keyof Actions)[] = ['replacer', 'recommencer', 'pause', 'camera', 'muet', 'pleinEcran'];
/** touches dont le navigateur ferait autre chose (défilement, page précédente) : bloquées pendant la course */
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Backspace']);

export class KeyboardInput {
  /** true pendant une course : empêche le défilement de la page avec les flèches / Espace */
  capture = false;
  private readonly down = new Set<string>();
  private actions: Actions = { ...NO_ACTIONS };
  private target: Window | null = null;
  private codesActions = new Map<string, keyof Actions>();
  private codesCourse = new Set<string>();
  private _touches: TouchesClavier = touchesParDefaut().clavier;

  constructor() {
    this.touches = TOUCHES_DEFAUT.clavier;
  }

  /** Touches choisies dans les Réglages (Échap met toujours en pause). */
  get touches(): TouchesClavier {
    return this._touches;
  }

  set touches(t: TouchesClavier) {
    this._touches = t;
    this.codesActions = new Map([[TOUCHE_RESERVEE, 'pause']]);
    for (const a of ACTIONS) for (const c of t[a]) this.codesActions.set(c, a);
    this.codesCourse = new Set(COMMANDES_CLAVIER.flatMap((c) => t[c]));
  }

  keyDown(code: string, repeat = false): void {
    this.down.add(code);
    const a = this.codesActions.get(code);
    if (a && !repeat) this.actions[a] = true;
  }

  keyUp(code: string): void {
    this.down.delete(code);
  }

  clear(): void {
    this.down.clear();
  }

  private readonly onDown = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (this.capture && (PREVENT.has(e.code) || this.codesCourse.has(e.code))) e.preventDefault();
    this.keyDown(e.code, e.repeat);
  };
  private readonly onUp = (e: KeyboardEvent): void => this.keyUp(e.code);
  private readonly onBlur = (): void => this.clear();

  attach(w: Window): void {
    this.detach();
    w.addEventListener('keydown', this.onDown);
    w.addEventListener('keyup', this.onUp);
    w.addEventListener('blur', this.onBlur);
    this.target = w;
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onDown);
    this.target.removeEventListener('keyup', this.onUp);
    this.target.removeEventListener('blur', this.onBlur);
    this.target = null;
  }

  state(): InputState {
    const t = this._touches;
    const has = (codes: string[]) => codes.some((c) => this.down.has(c));
    return {
      gaz: has(t.gaz) ? 1 : 0,
      frein: has(t.frein) ? 1 : 0,
      direction: (has(t.gauche) ? 1 : 0) - (has(t.droite) ? 1 : 0),
      freinAMain: has(t.freinAMain),
    };
  }

  consumeActions(): Actions {
    const a = this.actions;
    this.actions = { ...NO_ACTIONS };
    return a;
  }
}
