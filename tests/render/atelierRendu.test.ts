import { describe, it, expect } from 'vitest';
import { buildSkinGeometry } from '../../src/render/skins';
import { buildJdmCar, CAR_SHAPES } from '../../src/render/jdmCars';
import { MOTIFS, type Reglage } from '../../src/core/atelier';
import { CAR_IDS } from '../../src/core/physics/cars';
import type { SkinDef, SkinElement } from '../../src/core/skins';

/** Variante d'un motif avec tous ses réglages numériques au minimum ou au maximum. */
function extreme(m: (typeof MOTIFS)[number], cote: 'min' | 'max'): SkinElement {
  const e: Record<string, unknown> = { ...(m.defaut as object) };
  for (const [cle, r] of Object.entries(m.reglages) as [string, Reglage][]) {
    if (r.sorte === 'nombre') e[cle] = r[cote];
    if (r.sorte === 'teintes') e[cle] = Array.from({ length: r[cote] }, (_, i) => (i % 2 ? 'clair' : 'sombre'));
    if (r.sorte === 'positions') e[cle] = Array.from({ length: r[cote] }, (_, i) => 0.1 + 0.8 * (i / Math.max(1, r[cote] - 1)));
    if (r.sorte === 'chiffres') e[cle] = '8'.repeat(cote === 'min' ? 1 : r.max);
    if (r.sorte === 'intervalle') e[cle] = cote === 'min' ? [0, 0.05] : [0, 1];
  }
  return e as unknown as SkinElement;
}

describe('Atelier : chaque motif, à ses réglages extrêmes, se dessine sur chaque voiture sans sortir de la carrosserie', () => {
  for (const m of MOTIFS) {
    it(m.type, () => {
      for (const car of CAR_IDS) {
        const shape = CAR_SHAPES[car];
        const b = buildJdmCar(shape).body; b.computeBoundingBox();
        const boite = b.boundingBox!.clone().expandByScalar(0.06);
        for (const cote of ['min', 'max'] as const) {
          const def: SkinDef = { id: 'atelier-test', nom: 't', rarete: 'commune', description: 't', elements: [extreme(m, cote)] };
          const g = buildSkinGeometry(shape, def, '#e63b2e');
          if (!g) continue; // motif sans effet sur cette voiture à ce réglage : rien à dessiner
          const pos = g.getAttribute('position');
          expect(Array.from(pos.array as Float32Array).every(Number.isFinite), `${car} ${cote}`).toBe(true);
          g.computeBoundingBox();
          expect(boite.containsBox(g.boundingBox!), `${car} ${cote}`).toBe(true);
        }
      }
    });
  }
});
