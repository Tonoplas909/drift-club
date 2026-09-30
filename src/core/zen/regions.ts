import { ENVIRONNEMENTS, type Environnement } from '../level/types';
import { mulberry32, type Rng } from '../math/rng';
import { smoothstep } from '../math/vec';

/** Longueur d'une région (m) : tirée entre MIN et MIN + AMPLITUDE. */
export const REGION_MIN = 2600;
export const REGION_AMPLITUDE = 1200;
/** Longueur (m) de la transition entre deux régions, centrée sur la frontière. */
export const TRANSITION = 440;
/** Cycle jour → coucher → jour (m) et position des fondus dans le cycle. */
export const CYCLE_AMBIANCE = 9000;

export interface Region { theme: Environnement; debut: number; fin: number }

/** Mélange de deux thèmes à une abscisse : `t` = poids de `b` (0 → que `a`, 1 → que `b`). */
export interface Melange { a: Environnement; b: Environnement; t: number }

/**
 * Suite des régions du mode Zen : les 5 décors reviennent tour à tour dans un ordre tiré de la graine (jamais deux
 * fois le même de suite), une région dure 2,6 à 3,8 km, et on passe de l'une à l'autre en fondu sur 440 m.
 */
export class Regions {
  private readonly liste: Region[] = [];
  private readonly rng: Rng;
  private sac: Environnement[] = [];

  constructor(seed: number) {
    this.rng = mulberry32((seed ^ 0x2e6f1a3b) >>> 0);
  }

  private themeSuivant(precedent: Environnement | null): Environnement {
    if (this.sac.length === 0) {
      const s = [...ENVIRONNEMENTS];
      for (let i = s.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [s[i], s[j]] = [s[j], s[i]];
      }
      if (s[0] === precedent) [s[0], s[s.length - 1]] = [s[s.length - 1], s[0]];
      this.sac = s;
    }
    return this.sac.shift()!;
  }

  /** Région numéro `i` (générées au besoin, dans l'ordre : déterministe). */
  region(i: number): Region {
    while (this.liste.length <= i) {
      const prec = this.liste[this.liste.length - 1];
      const debut = prec ? prec.fin : 0;
      const theme = this.themeSuivant(prec ? prec.theme : null);
      this.liste.push({ theme, debut, fin: debut + REGION_MIN + this.rng() * REGION_AMPLITUDE });
    }
    return this.liste[i];
  }

  /** Indice de la région qui contient l'abscisse `s` (≥ 0). */
  indice(s: number): number {
    let i = 0;
    while (this.region(i).fin <= s) i++;
    return i;
  }

  /** Thèmes et poids de transition à l'abscisse `s`. */
  melange(s: number): Melange {
    const i = this.indice(Math.max(0, s));
    const r = this.region(i);
    const demi = TRANSITION / 2;
    if (s >= r.fin - demi) {
      return { a: r.theme, b: this.region(i + 1).theme, t: smoothstep(r.fin - demi, r.fin + demi, s) };
    }
    if (i > 0 && s <= r.debut + demi) {
      return { a: this.region(i - 1).theme, b: r.theme, t: smoothstep(r.debut - demi, r.debut + demi, s) };
    }
    return { a: r.theme, b: r.theme, t: 0 };
  }

  /** Poids de chaque thème à l'abscisse `s` (somme = 1). */
  poids(s: number): Partial<Record<Environnement, number>> {
    const m = this.melange(s);
    if (m.a === m.b) return { [m.a]: 1 };
    return { [m.a]: 1 - m.t, [m.b]: m.t };
  }

  /** Thème dominant à l'abscisse `s`. */
  dominant(s: number): Environnement {
    const m = this.melange(s);
    return m.t < 0.5 ? m.a : m.b;
  }
}

/** Ambiance le long de la route : 0 = jour, 1 = coucher (le soleil descend doucement, puis revient). */
export function ambianceA(s: number): number {
  const u = ((s % CYCLE_AMBIANCE) + CYCLE_AMBIANCE) % CYCLE_AMBIANCE;
  return smoothstep(5200, 6200, u) - smoothstep(8000, 9000, u);
}
