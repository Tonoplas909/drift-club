import { NO_INPUT, type InputState } from '../core/input';
import type { Actions, KeyboardInput } from './keyboard';
import type { TouchSource } from './touch';
import type { GamepadInput } from './gamepad';

const fusionner = (a: Actions, b: Actions): Actions => ({
  replacer: a.replacer || b.replacer,
  recommencer: a.recommencer || b.recommencer,
  pause: a.pause || b.pause,
  camera: a.camera || b.camera,
  muet: a.muet || b.muet,
  pleinEcran: a.pleinEcran || b.pleinEcran,
});

export class InputManager {
  constructor(readonly keyboard: KeyboardInput, readonly touch: TouchSource | null, readonly gamepad: GamepadInput | null = null) {}

  get touchActive(): boolean {
    return this.touch?.active ?? false;
  }

  /** `accelAuto` ne concerne que les commandes tactiles (et seulement si elles ont servi). */
  state(accelAuto: boolean): InputState {
    const k = this.keyboard.state();
    const t = this.touch ? this.touch.state(accelAuto && this.touchActive) : NO_INPUT;
    const g = this.gamepad ? this.gamepad.state() : NO_INPUT;
    return {
      gaz: Math.max(k.gaz, t.gaz, g.gaz),
      frein: Math.max(k.frein, t.frein, g.frein),
      direction: k.direction !== 0 ? k.direction : g.direction !== 0 ? g.direction : t.direction,
      freinAMain: k.freinAMain || t.freinAMain || g.freinAMain,
    };
  }

  /** Une fois par image : lit aussi la manette (son état sert aux pas de simulation qui suivent). */
  consumeActions(): Actions {
    this.gamepad?.poll();
    let a = this.keyboard.consumeActions();
    if (this.touch) a = fusionner(a, this.touch.consumeActions());
    if (this.gamepad) a = fusionner(a, this.gamepad.consumeActions());
    return a;
  }

  reset(): void {
    this.keyboard.clear();
    this.touch?.reset();
    this.consumeActions();
  }
}
