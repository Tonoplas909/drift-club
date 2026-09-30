import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildSkinGeometry } from '../../src/render/skins';
import { buildJdmCar, CAR_SHAPES } from '../../src/render/jdmCars';
import { SKINS } from '../../src/core/skins';
import { COULEURS } from '../../src/ui/couleurs';
import { CAR_IDS } from '../../src/core/physics/cars';
import { CarView } from '../../src/render/carView';

const MARGE = 0.05;

describe('géométrie des livrées', () => {
  for (const car of CAR_IDS) {
    const shape = CAR_SHAPES[car];
    const carBox = (() => { const b = buildJdmCar(shape).body; b.computeBoundingBox(); return b.boundingBox!.clone().expandByScalar(MARGE); })();
    for (const skin of SKINS[car]) {
      it(`${car} / ${skin.id} : finie, non vide et dans la boîte de la voiture (± ${MARGE} m)`, () => {
        for (const c of [COULEURS[0].hex, COULEURS[7].hex]) {
          const g = buildSkinGeometry(shape, skin, c);
          if (skin.elements.length === 0) { expect(g).toBeNull(); continue; }
          expect(g).not.toBeNull();
          const pos = g!.getAttribute('position');
          expect(pos.count).toBeGreaterThan(0);
          expect(Array.from(pos.array as Float32Array).every(Number.isFinite)).toBe(true);
          expect(g!.getAttribute('color').count).toBe(pos.count);
          g!.computeBoundingBox();
          expect(carBox.containsBox(g!.boundingBox!)).toBe(true);
        }
      });
    }
  }
  it('les couleurs dérivées suivent la couleur principale', () => {
    const skin = SKINS.equilibree.find((s) => s.id === 'rayures')!;
    const a = buildSkinGeometry(CAR_SHAPES.equilibree, skin, '#3a6ff0')!.getAttribute('color');
    const b = buildSkinGeometry(CAR_SHAPES.equilibree, skin, '#f2f2ee')!.getAttribute('color');
    expect(a.getX(0)).toBeGreaterThan(b.getX(0)); // bandes claires sur bleu, sombres sur blanc
  });
  it('CarView : changer de livrée/couleur ajoute puis retire le maillage de décors', () => {
    const model = buildJdmCar(CAR_SHAPES.turbo);
    const v = new CarView(model, '#e63b2e', false, null);
    const nb = () => { let n = 0; v.root.traverse((o) => { if ((o as THREE.Mesh).isMesh) n++; }); return n; };
    const base = nb();
    v.setSkin(SKINS.turbo[1]);
    expect(nb()).toBe(base + 1);
    v.setColor('#3a6ff0');
    expect(nb()).toBe(base + 1);
    v.setSkin(SKINS.turbo[0]);
    expect(nb()).toBe(base);
    v.dispose();
  });
});
