import { describe, it, expect } from 'vitest';
import { VUES_CAMERA, angleVolant, estEmbarquee, lireVue, pointsVue, vueSuivante } from '../../src/render/vuesEmbarquees';
import { CAR_SHAPES } from '../../src/render/jdmCars';
import { CAR_IDS } from '../../src/core/physics/cars';

describe('caméras embarquées', () => {
  it('la touche C fait le tour des vues', () => {
    let v = VUES_CAMERA[0];
    const vues = new Set([v]);
    for (let i = 0; i < VUES_CAMERA.length; i++) { v = vueSuivante(v); vues.add(v); }
    expect(v).toBe('proche');
    expect(vues.size).toBe(VUES_CAMERA.length);
    expect(estEmbarquee('loin')).toBe(false);
    expect(estEmbarquee('capot')).toBe(true);
  });
  it('relecture des réglages : vue connue, sinon ancien choix « éloignée »', () => {
    expect(lireVue('toit')).toBe('toit');
    expect(lireVue('drone', true)).toBe('loin');
    expect(lireVue(undefined)).toBe('proche');
  });
  it('chaque vue regarde vers l\'avant (sauf la roue, de biais) depuis un point plausible de chaque voiture', () => {
    for (const id of CAR_IDS) {
      const s = CAR_SHAPES[id];
      for (const v of ['capot', 'calandre', 'conducteur', 'toit'] as const) {
        const { oeil, vise } = pointsVue(v, s);
        expect(vise[2], `${id} ${v}`).toBeGreaterThan(oeil[2] + 10);
        expect(oeil[1]).toBeGreaterThan(0.2);
        expect(Math.abs(oeil[2])).toBeLessThan(s.length / 2 + 0.2);
      }
      // conducteur : volant à droite, sous le toit, au-dessus du capot
      const c = pointsVue('conducteur', s).oeil;
      expect(c[0]).toBeLessThan(0);
      expect(c[1]).toBeLessThan(s.roofY);
      expect(c[1]).toBeGreaterThan(s.cowlY);
      const r = pointsVue('roue', s);
      expect(r.oeil[0]).toBeGreaterThan(s.width / 2);
    }
  });
  it('le volant tourne plus que les roues, sans dépasser un tour et demi', () => {
    expect(angleVolant(0.1)).toBeCloseTo(0.6);
    expect(angleVolant(5)).toBe(2.6);
    expect(angleVolant(-5)).toBe(-2.6);
  });
});
