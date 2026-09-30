import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildSkinGeometry, rectsChiffre } from '../../src/render/skins';
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
  it('tous les types d\'éléments sont utilisés par au moins une livrée', () => {
    const types = new Set(CAR_IDS.flatMap((c) => SKINS[c]).flatMap((s) => s.elements.map((e) => e.type)));
    for (const t of ['damier', 'flammes', 'eclairs', 'camouflage', 'pois', 'diagonales', 'dents', 'portieres', 'degrade',
      'barres', 'bandesMulti', 'bloc', 'grosNumero', 'pixels', 'formes', 'taches', 'zebrures', 'tigre', 'gouttes', 'hachures', 'circuit', 'grille', 'scanner', 'tribal']) expect(types.has(t as never)).toBe(true);
  });
  it('chiffres : tous distincts, et le 1, le 4 et le 7 ne se confondent pas', () => {
    const sig = '0123456789'.split('').map((c) => JSON.stringify(rectsChiffre(c)));
    expect(new Set(sig).size).toBe(10);
    for (const c of '0123456789') expect(rectsChiffre(c).length).toBeGreaterThan(0);
    // le 1 a un pied (rangée du bas pleine), le 7 n\'en a pas ; le 4 a une barre transversale et pas de barre en haut
    const pleine = (c: string, v: number) => rectsChiffre(c).some(([u0, u1, v0]) => v0 === v && u1 - u0 === 3);
    expect(pleine('1', 0)).toBe(true);
    expect(pleine('7', 0)).toBe(false);
    expect(pleine('7', 4)).toBe(true);
    expect(pleine('4', 4)).toBe(false);
    expect(pleine('4', 2)).toBe(true);
  });
  it('les numéros de portière donnent des géométries différentes pour 1 et 7', () => {
    const g = (ch: string) => buildSkinGeometry(CAR_SHAPES.turbo, { id: 'x', nom: 'x', description: 'x', rarete: 'commune', elements: [{ type: 'numero', chiffres: ch, fond: '#ffffff', encre: '#000000' }] }, '#e63b2e')!.getAttribute('position').array.join(',');
    expect(g('1')).not.toBe(g('7'));
  });
  it('couleur forcée : la carrosserie de CarView prend la couleur imposée, quelle que soit la couleur choisie', () => {
    const or = SKINS.turbo.find((s) => s.id === 'or')!;
    const v = new CarView(buildJdmCar(CAR_SHAPES.turbo), '#3a6ff0', false, or);
    const carrosserie = (): THREE.Mesh => v.root.children[0].children[0].children[0] as THREE.Mesh;
    /** nombre de sommets de la carrosserie de cette couleur */
    const nb = (hex: string): number => {
      const c = new THREE.Color(hex), col = carrosserie().geometry.getAttribute('color');
      let n = 0;
      for (let i = 0; i < col.count; i++) if (Math.abs(col.getX(i) - c.r) + Math.abs(col.getY(i) - c.g) + Math.abs(col.getZ(i) - c.b) < 0.01) n++;
      return n;
    };
    expect(nb(or.couleurForcee!)).toBeGreaterThan(0);
    expect(nb('#3a6ff0')).toBe(0);
    v.setColor('#f2f2ee');
    expect(nb(or.couleurForcee!)).toBeGreaterThan(0);
    v.setSkin(SKINS.turbo[0]);
    expect(nb(or.couleurForcee!)).toBe(0);
    expect(nb('#f2f2ee')).toBeGreaterThan(0);
    v.dispose();
  });
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
