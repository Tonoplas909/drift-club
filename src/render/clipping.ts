import * as THREE from 'three';
import type { TrackData } from '../core/track/buildTrack';
import type { ZonePiste } from '../core/track/clipping';
import { PORTEE_CLIPPING } from '../core/track/clipping';
import { toonMaterial } from './materials';

/** Texture des zones de clipping : hachures jaunes et noires, comme une zone de juges. */
function textureZone(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffd23f'; g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#15131c';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(12, 0); g.lineTo(32, 20); g.lineTo(32, 32); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(0, 20); g.lineTo(12, 32); g.lineTo(0, 32); g.closePath(); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Zones de clipping au sol : une bande hachurée le long du bord de la route (sur la chaussée), et un liseré clair
 * plus large et translucide qui montre jusqu'où la zone rapporte (portée).
 */
export function construireZonesClipping(track: TrackData, zones: readonly ZonePiste[]): { groupe: THREE.Group; dispose(): void } {
  const groupe = new THREE.Group();
  groupe.name = 'clipping';
  if (zones.length === 0) return { groupe, dispose: () => undefined };
  const tex = textureZone();
  const matBande = toonMaterial({ map: tex });
  matBande.side = THREE.DoubleSide;
  matBande.polygonOffset = true; matBande.polygonOffsetFactor = -3; matBande.polygonOffsetUnits = -3;
  const matPortee = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
  matPortee.polygonOffset = true; matPortee.polygonOffsetFactor = -2; matPortee.polygonOffsetUnits = -2;
  const S = track.samples;
  const bande = (z: ZonePiste, de: number, a: number, h: number, uv: boolean): THREE.BufferGeometry => {
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [];
    for (let i = z.i0; i <= z.i1; i++) {
      const sp = S[i];
      for (const [d, u] of [[de, 0], [a, 1]] as const) {
        const off = z.cote * (sp.w - d);
        pos.push(sp.x + sp.nx * off, sp.y + h, sp.z + sp.nz * off);
        uvs.push(u, sp.s / 1.2);
      }
      if (i > z.i0) {
        const k = (i - z.i0) * 2;
        idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  for (const z of zones) {
    if (z.i1 <= z.i0) continue;
    // la bande sur la chaussée, au ras du bord ; la portée, plus large, translucide
    const m = new THREE.Mesh(bande(z, 0.08, 0.68, 0.045, true), matBande);
    const p = new THREE.Mesh(bande(z, 0.68, PORTEE_CLIPPING + 0.9, 0.04, false), matPortee);
    m.receiveShadow = true;
    groupe.add(m, p);
  }
  return { groupe, dispose: () => { tex.dispose(); matBande.dispose(); matPortee.dispose(); } };
}
