import { NO_INPUT, type InputState } from '../core/input';
import type { Actions, KeyboardInput } from './keyboard';
import type { TouchSource } from './touch';

export class InputManager {
  constructor(readonly keyboard: KeyboardInput, readonly touch: TouchSource | null) {}

  get touchActive(): boolean {
    return this.touch?.active ?? false;
  }

  /** `accelAuto` ne concerne que les commandes tactiles (et seulement si elles ont servi). */
  state(accelAuto: boolean): InputState {
    const k = this.keyboard.state();
    const t = this.touch ? this.touch.state(accelAuto && this.touchActive) : NO_INPUT;
    return {
      gaz: Math.max(k.gaz, t.gaz),
      frein: Math.max(k.frein, t.frein),
      direction: k.direction !== 0 ? k.direction : t.direction,
      freinAMain: k.freinAMain || t.freinAMain,
    };
  }

  consumeActions(): Actions {
    const a = this.keyboard.consumeActions();
    if (!this.touch) return a;
    const b = this.touch.consumeActions();
    return {
      replacer: a.replacer || b.replacer,
      pause: a.pause || b.pause,
      camera: a.camera || b.camera,
      muet: a.muet || b.muet,
      pleinEcran: a.pleinEcran || b.pleinEcran,
    };
  }

  reset(): void {
    this.keyboard.clear();
    this.touch?.reset();
    this.consumeActions();
  }
}
