import { SIM_DT } from '../core/constants';

/** Accumule le temps réel et exécute la simulation à pas fixe. Renvoie alpha pour l'interpolation. */
export class FixedStepLoop {
  private acc = 0;

  constructor(private readonly step: () => void, private readonly maxFrame = 0.25) {}

  advance(frameDt: number): number {
    const dt = Math.min(Math.max(frameDt, 0), this.maxFrame);
    this.acc += dt;
    while (this.acc >= SIM_DT - 1e-12) {
      this.step();
      this.acc -= SIM_DT;
    }
    if (this.acc < 0) this.acc = 0;
    return this.acc / SIM_DT;
  }

  reset(): void {
    this.acc = 0;
  }
}
