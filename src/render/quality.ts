import type { Qualite } from '../storage/store';

export type QualityLevel = 'basse' | 'haute';

export interface QualitySettings {
  maxPixelRatio: number;
  shadows: boolean;
  fogFar: number;
  smokeMax: number;
  /** étincelles des fumées à paillettes */
  sparkMax: number;
  skidMax: number;
}

export const QUALITY: Record<QualityLevel, QualitySettings> = {
  basse: { maxPixelRatio: 1, shadows: false, fogFar: 180, smokeMax: 60, sparkMax: 40, skidMax: 250 },
  haute: { maxPixelRatio: 2, shadows: true, fogFar: 350, smokeMax: 150, sparkMax: 120, skidMax: 600 },
};

/** Qualité « auto » : Haute sur PC, Basse au tactile ; passe en Basse si < 50 i/s pendant 3 s. */
export class QualityManager {
  level: QualityLevel;
  private window = 0;
  private frames = 0;
  private lowTime = 0;

  constructor(private readonly mode: Qualite, touch: boolean) {
    this.level = mode === 'auto' ? (touch ? 'basse' : 'haute') : mode;
  }

  /** À appeler à chaque image pendant la course ; renvoie true si le niveau vient de changer. */
  sample(dt: number): boolean {
    if (this.mode !== 'auto' || this.level === 'basse') return false;
    this.window += dt;
    this.frames++;
    if (this.window < 0.5) return false;
    const fps = this.frames / this.window;
    this.lowTime = fps < 50 ? this.lowTime + this.window : 0;
    this.window = 0;
    this.frames = 0;
    if (this.lowTime >= 3 - 1e-9) {
      this.level = 'basse';
      return true;
    }
    return false;
  }
}
