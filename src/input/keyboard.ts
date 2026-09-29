import type { InputState } from '../core/input';

export interface Actions { replacer: boolean; pause: boolean; camera: boolean; muet: boolean; pleinEcran: boolean }
export const NO_ACTIONS: Readonly<Actions> = Object.freeze({ replacer: false, pause: false, camera: false, muet: false, pleinEcran: false });

const GAZ = ['KeyW', 'ArrowUp'];
const FREIN = ['KeyS', 'ArrowDown'];
const GAUCHE = ['KeyA', 'ArrowLeft'];
const DROITE = ['KeyD', 'ArrowRight'];
const FREIN_A_MAIN = ['Space'];
const ACTION_CODES: Record<string, keyof Actions> = {
  KeyR: 'replacer', Escape: 'pause', KeyP: 'pause', KeyC: 'camera', KeyM: 'muet', KeyF: 'pleinEcran',
};
const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class KeyboardInput {
  /** true pendant une course : empêche le défilement de la page avec les flèches / Espace */
  capture = false;
  private readonly down = new Set<string>();
  private actions: Actions = { ...NO_ACTIONS };
  private target: Window | null = null;

  keyDown(code: string, repeat = false): void {
    this.down.add(code);
    const a = ACTION_CODES[code];
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
    if (this.capture && PREVENT.has(e.code)) e.preventDefault();
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
    const has = (codes: string[]) => codes.some((c) => this.down.has(c));
    return {
      gaz: has(GAZ) ? 1 : 0,
      frein: has(FREIN) ? 1 : 0,
      direction: (has(GAUCHE) ? 1 : 0) - (has(DROITE) ? 1 : 0),
      freinAMain: has(FREIN_A_MAIN),
    };
  }

  consumeActions(): Actions {
    const a = this.actions;
    this.actions = { ...NO_ACTIONS };
    return a;
  }
}
