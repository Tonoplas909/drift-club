/** Filtres du mode photo, appliqués aux pixels de la capture (RGBA). Fonctions pures, testées sous node. */

export type FiltrePhoto = 'aucun' | 'nb' | 'grain' | 'vignette';

export const FILTRES_PHOTO: [FiltrePhoto, string][] = [['aucun', 'Aucun'], ['nb', 'Noir et blanc'], ['grain', 'Grain'], ['vignette', 'Vignette']];

const octet = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Applique `f` sur place ; `hasard` (0..1) sert au grain. */
export function appliquerFiltre(px: Uint8ClampedArray, l: number, h: number, f: FiltrePhoto, hasard: () => number): void {
  if (f === 'aucun') return;
  const n = l * h;
  if (f === 'nb') {
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      // luminance, avec un peu plus de contraste (gris de 128 inchangé)
      const y = 0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2];
      const c = octet(128 + (y - 128) * 1.12);
      px[o] = px[o + 1] = px[o + 2] = c;
    }
  } else if (f === 'grain') {
    for (let i = 0; i < n; i++) {
      const o = i * 4, g = (hasard() - 0.5) * 44;
      px[o] = octet(px[o] + g); px[o + 1] = octet(px[o + 1] + g); px[o + 2] = octet(px[o + 2] + g);
    }
  } else {
    const cx = l / 2, cy = h / 2, r = Math.hypot(cx, cy) || 1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < l; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
        const t = d <= 0.45 ? 0 : Math.min(1, (d - 0.45) / 0.55);
        const k = 1 - 0.6 * t * t * (3 - 2 * t);
        const o = (y * l + x) * 4;
        px[o] *= k; px[o + 1] *= k; px[o + 2] *= k;
      }
    }
  }
}

/** Nom du fichier de la photo : drift-club-AAAAMMJJ-HHMMSS.png (heure locale). */
export function nomPhoto(d: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `drift-club-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.png`;
}
