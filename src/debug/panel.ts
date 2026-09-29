import type { DebugHook } from '../game/session';
import type { AssistParams, CarParams, CarState } from '../core/physics/types';
import type { ChaseConfig } from '../render/camera';
import { DEFAULT_SCORE_PARAMS } from '../core/scoring/score';
import { DEG } from '../core/math/vec';

export function sliderSpec(value: number): { min: number; max: number; step: number } {
  if (value === 0) return { min: 0, max: 1, step: 0.01 };
  const a = Math.abs(value) * 3;
  return { min: value < 0 ? -a : 0, max: a, step: Number((a / 300).toPrecision(2)) };
}

export function numericKeys(obj: object): string[] {
  return Object.entries(obj).filter(([, v]) => typeof v === 'number').map(([k]) => k);
}

export function isDebug(search: string): boolean {
  return new URLSearchParams(search).has('debug');
}

export class DebugPanel implements DebugHook {
  private readonly root = document.createElement('div');
  private readonly readout = document.createElement('pre');
  private sections: { titre: string; obj: Record<string, unknown> }[] = [];
  private acc = 0;
  private frames = 0;

  constructor() {
    this.root.className = 'debug';
    document.body.append(this.root);
  }

  attach(car: CarParams, assists: AssistParams, cam: ChaseConfig): void {
    this.sections = [
      { titre: `Voiture (${car.nom})`, obj: car as unknown as Record<string, unknown> },
      { titre: 'Aides du mode', obj: assists as unknown as Record<string, unknown> },
      { titre: 'Score', obj: DEFAULT_SCORE_PARAMS as unknown as Record<string, unknown> },
      { titre: 'Caméra', obj: cam as unknown as Record<string, unknown> },
    ];
    this.root.replaceChildren();
    const bar = document.createElement('div');
    bar.className = 'debug-bar';
    const copy = document.createElement('button');
    copy.textContent = 'Copier les paramètres';
    copy.onclick = () => {
      const data = Object.fromEntries(this.sections.map((s) => [s.titre, s.obj]));
      void navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
      copy.textContent = 'Copié !';
      setTimeout(() => { copy.textContent = 'Copier les paramètres'; }, 1200);
    };
    const hide = document.createElement('button');
    hide.textContent = 'Masquer';
    hide.onclick = () => this.root.classList.toggle('folded');
    bar.append(copy, hide);
    this.root.append(bar, this.readout);
    for (const s of this.sections) {
      const h = document.createElement('h4');
      h.textContent = s.titre;
      this.root.append(h);
      for (const key of numericKeys(s.obj)) {
        const value = s.obj[key] as number;
        const spec = sliderSpec(value);
        const row = document.createElement('label');
        const name = document.createElement('span');
        name.textContent = key;
        const input = document.createElement('input');
        input.type = 'range';
        input.min = String(spec.min);
        input.max = String(spec.max);
        input.step = String(spec.step);
        input.value = String(value);
        const out = document.createElement('code');
        out.textContent = value.toPrecision(4);
        input.oninput = () => {
          const v = parseFloat(input.value);
          s.obj[key] = v;
          out.textContent = v.toPrecision(4);
        };
        row.append(name, input, out);
        this.root.append(row);
      }
    }
  }

  frame(car: CarState, dt: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc < 0.2) return;
    const fps = this.frames / this.acc;
    this.acc = 0;
    this.frames = 0;
    this.readout.textContent =
      `β ${(car.beta / DEG).toFixed(1)}°  ·  ${(car.speed * 3.6).toFixed(0)} km/h  ·  lacet ${car.yawRate.toFixed(2)} rad/s\n` +
      `glisse arr. ${car.rearSlip.toFixed(2)}  ·  braquage ${(car.steer / DEG).toFixed(1)}°  ·  ${fps.toFixed(0)} i/s`;
  }
}
