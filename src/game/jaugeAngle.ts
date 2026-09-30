/** Indicateur d'angle de glisse (sous la voiture) : demi-cadran coloré par zone de score, aiguille et valeur. */

/** Zones du cadran (degrés de dérive, en valeur absolue) : même logique que le facteur d'angle du score. */
export const ZONES_ANGLE: { de: number; a: number; classe: string }[] = [
  { de: 0, a: 15, classe: 'z-neutre' },
  { de: 15, a: 25, classe: 'z-moyen' },
  { de: 25, a: 60, classe: 'z-ideal' },
  { de: 60, a: 90, classe: 'z-large' },
  { de: 90, a: 120, classe: 'z-trop' },
];

export const ANGLE_MAX = 120;

/** Angle de dérive (°) → angle de l'aiguille sur le cadran (°, 0 = verticale, ±ANGLE_MAX affiché à ±100°). */
export function aiguille(betaDeg: number): number {
  const b = Math.max(-ANGLE_MAX, Math.min(ANGLE_MAX, betaDeg));
  return (-b / ANGLE_MAX) * 100;
}

const CX = 100, CY = 100, R = 82;
const point = (deg: number, r: number): string => {
  const t = (deg * Math.PI) / 180;
  return `${(CX + r * Math.sin(t)).toFixed(1)} ${(CY - r * Math.cos(t)).toFixed(1)}`;
};
const arc = (a0: number, a1: number): string => `M ${point(a0, R)} A ${R} ${R} 0 0 1 ${point(a1, R)}`;

/** SVG du cadran (arcs symétriques à gauche et à droite). */
export function svgJaugeAngle(): string {
  const arcs = ZONES_ANGLE.flatMap((z) => {
    const a0 = (z.de / ANGLE_MAX) * 100, a1 = (z.a / ANGLE_MAX) * 100;
    return [`<path class="${z.classe}" d="${arc(a0, a1)}"/>`, `<path class="${z.classe}" d="${arc(-a1, -a0)}"/>`];
  }).join('');
  return `<svg viewBox="0 0 200 118" aria-hidden="true"><g class="arcs">${arcs}</g>`
    + `<g class="aiguille" data-k="aiguille"><line x1="100" y1="100" x2="100" y2="26"/><circle cx="100" cy="100" r="7"/></g></svg>`;
}
