import type { InputState } from '../core/input';
import { clamp } from '../core/math/vec';
import { NO_ACTIONS, type Actions } from './keyboard';

/** Glisser vers la droite = tourner a droite (direction negative). Course pleine = 18 % de la zone (60 px min). */
export function steerFromDrag(dx: number, zoneWidth: number): number {
  const full = Math.max(60, zoneWidth * 0.18);
  return -clamp(dx / full, -1, 1);
}

export interface TouchSource {
  readonly active: boolean;
  state(accelAuto: boolean): InputState;
  consumeActions(): Actions;
  reset(): void;
}

export class TouchControls implements TouchSource {
  active = false;
  private steer = 0;
  private gaz = false;
  private frein = false;
  private drift = false;
  private actions: Actions = { ...NO_ACTIONS };
  private steerPointer: number | null = null;
  private steerOrigin = 0;
  private readonly knob: HTMLElement;

  constructor(private readonly root: HTMLElement) {
    root.innerHTML = `
      <div class="t-steer"><div class="t-steer-track"><div class="t-knob"></div></div><span>Glisse pour tourner</span></div>
      <div class="t-pedals">
        <button class="t-btn t-frein" type="button">Frein</button>
        <button class="t-btn t-drift" type="button">Drift</button>
        <button class="t-btn t-gaz" type="button">Gaz</button>
      </div>
      <div class="t-top">
        <button class="t-small t-replace" type="button">Replacer</button>
        <button class="t-small t-pause" type="button">Pause</button>
      </div>`;
    this.knob = root.querySelector('.t-knob') as HTMLElement;
    const zone = root.querySelector('.t-steer') as HTMLElement;

    zone.addEventListener('pointerdown', (e) => {
      if (this.steerPointer !== null) return;
      this.steerPointer = e.pointerId;
      this.steerOrigin = e.clientX;
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.steerPointer) return;
      this.steer = steerFromDrag(e.clientX - this.steerOrigin, zone.clientWidth);
      this.knob.style.transform = `translateX(${-this.steer * 80}px)`;
    });
    const endSteer = (e: PointerEvent) => {
      if (e.pointerId !== this.steerPointer) return;
      this.steerPointer = null;
      this.steer = 0;
      this.knob.style.transform = '';
    };
    zone.addEventListener('pointerup', endSteer);
    zone.addEventListener('pointercancel', endSteer);

    const hold = (sel: string, set: (v: boolean) => void) => {
      const b = root.querySelector(sel) as HTMLElement;
      b.addEventListener('pointerdown', (e) => { set(true); b.classList.add('down'); b.setPointerCapture(e.pointerId); });
      const up = () => { set(false); b.classList.remove('down'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    };
    hold('.t-gaz', (v) => { this.gaz = v; });
    hold('.t-frein', (v) => { this.frein = v; });
    hold('.t-drift', (v) => { this.drift = v; });
    (root.querySelector('.t-pause') as HTMLElement).addEventListener('pointerdown', () => { this.actions.pause = true; });
    (root.querySelector('.t-replace') as HTMLElement).addEventListener('pointerdown', () => { this.actions.replacer = true; });

    window.addEventListener('touchstart', () => { this.active = true; }, { passive: true });
  }

  show(visible: boolean): void {
    this.root.classList.toggle('on', visible);
  }

  state(accelAuto: boolean): InputState {
    return {
      gaz: this.gaz || (accelAuto && !this.frein) ? 1 : 0,
      frein: this.frein ? 1 : 0,
      direction: this.steer,
      freinAMain: this.drift,
    };
  }

  consumeActions(): Actions {
    const a = this.actions;
    this.actions = { ...NO_ACTIONS };
    return a;
  }

  reset(): void {
    this.gaz = this.frein = this.drift = false;
    this.steer = 0;
    this.steerPointer = null;
    this.knob.style.transform = '';
    this.actions = { ...NO_ACTIONS };
  }
}
