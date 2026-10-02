import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SmokeSystem, couleurDegrade } from '../../src/render/effects';
import { FUMEES } from '../../src/core/fumees';
import { QUALITY } from '../../src/render/quality';

describe('couleurDegrade', () => {
  const rgb = new Float32Array([0, 0, 0, 1, 1, 1, 1, 0, 0]);
  const out = new Float32Array(3);
  it('une couleur : constante ; sinon fondu entre voisines, bornes comprises', () => {
    couleurDegrade(new Float32Array([0.2, 0.4, 0.6]), 0.7, out, 0);
    expect([...out].map((v) => +v.toFixed(2))).toEqual([0.2, 0.4, 0.6]);
    couleurDegrade(rgb, 0, out, 0); expect([...out]).toEqual([0, 0, 0]);
    couleurDegrade(rgb, 0.25, out, 0); expect([...out]).toEqual([0.5, 0.5, 0.5]);
    couleurDegrade(rgb, 1, out, 0); expect([...out]).toEqual([1, 0, 0]);
    couleurDegrade(rgb, 7, out, 0); expect([...out]).toEqual([1, 0, 0]);
  });
});

describe('SmokeSystem avec fumées', () => {
  it('chaque fumée s\'émet et s\'anime sans erreur, sur les deux qualités, et on peut en changer en vol', () => {
    for (const q of [QUALITY.basse, QUALITY.haute]) {
      const s = new SmokeSystem(q.smokeMax, 0xe9e6e1, null, q.sparkMax);
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)];
      for (const f of FUMEES) {
        s.setStyle(f.style);
        for (let i = 0; i < 30; i++) { s.emit(pts, 30, 1 / 60, 5, 0); s.update(1 / 60); }
        const col = s.mesh.instanceColor!.array as Float32Array;
        expect(col.every((v) => Number.isFinite(v) && v >= 0)).toBe(true);
        expect(s.sparks.visible).toBe(!!f.style.paillettes);
      }
      s.dispose();
    }
  });
  it('« classique » prend la couleur du décor et la suit', () => {
    const s = new SmokeSystem(10, 0xe9e6e1);
    const mat = s.mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(new THREE.Color(0xe9e6e1).getHex());
    s.setCouleurDecor(0x112233);
    expect(mat.color.getHex()).toBe(new THREE.Color(0x112233).getHex());
    s.setStyle(FUMEES.find((f) => f.id === 'rouge')!.style);
    s.setCouleurDecor(0x445566); // ignorée : la fumée rouge garde sa couleur
    expect((s.mesh.material as THREE.MeshToonMaterial).color.getHex()).toBe(0xffffff);
  });
});
