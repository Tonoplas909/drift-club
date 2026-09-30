import * as THREE from 'three';
import type { TrackData, TrackSample } from '../core/track/buildTrack';
import { mulberry32 } from '../core/math/rng';
import { toonMaterial } from './materials';
import { coloredBox } from './procedural';
import { epauleDe, type Palette } from './palettes';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface RoadTextures { road: THREE.Texture; curb: THREE.Texture; checker: THREE.Texture }

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2D indisponible');
  draw(ctx);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Textures dessinées au chargement (DOM). */
export function createRoadTextures(p: Palette, anisotropy: number): RoadTextures {
  const road = canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = hex(p.asphalt);
    ctx.fillRect(0, 0, 128, 256);
    const rng = mulberry32(7);
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.05)';
      ctx.fillRect(Math.floor(rng() * 128), Math.floor(rng() * 256), 2, 2);
    }
    ctx.fillStyle = hex(p.line);
    ctx.fillRect(5, 0, 3, 256);
    ctx.fillRect(120, 0, 3, 256);
    ctx.fillRect(62, 0, 4, 85); // tiret central : 3 m sur 9
  });
  road.wrapS = THREE.ClampToEdgeWrapping;
  road.wrapT = THREE.RepeatWrapping;
  road.anisotropy = anisotropy;

  const curb = canvasTexture(4, 2, (ctx) => {
    ctx.fillStyle = '#e63b2e'; ctx.fillRect(0, 0, 4, 1);
    ctx.fillStyle = '#f4f1e8'; ctx.fillRect(0, 1, 4, 1);
  });
  curb.magFilter = THREE.NearestFilter;
  curb.wrapT = THREE.RepeatWrapping;

  const checker = canvasTexture(2, 2, (ctx) => {
    ctx.fillStyle = '#f4f1e8'; ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = '#1b1f2e'; ctx.fillRect(0, 0, 1, 1); ctx.fillRect(1, 1, 1, 1);
  });
  checker.magFilter = THREE.NearestFilter;
  checker.wrapS = THREE.RepeatWrapping;
  checker.wrapT = THREE.RepeatWrapping;
  return { road, curb, checker };
}

type V3 = [number, number, number];

/** Bande de triangles entre deux rangées A (gauche) et B (droite). */
function strip(a: V3[], b: V3[], uvA?: [number, number][], uvB?: [number, number][], color?: THREE.Color): THREE.BufferGeometry {
  const n = a.length;
  const pos = new Float32Array(n * 2 * 3);
  for (let i = 0; i < n; i++) { pos.set(a[i], i * 6); pos.set(b[i], i * 6 + 3); }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const A = i * 2, B = i * 2 + 1, A1 = A + 2, B1 = B + 2;
    idx.push(A, B, A1, B, B1, A1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uvA && uvB) {
    const uv = new Float32Array(n * 2 * 2);
    for (let i = 0; i < n; i++) { uv.set(uvA[i], i * 4); uv.set(uvB[i], i * 4 + 2); }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  if (color) {
    const col = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n * 2; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const off = (sp: TrackSample, lat: number, dy: number): V3 => [sp.x + sp.nx * lat, sp.y + dy, sp.z + sp.nz * lat];

export function buildRoad(track: TrackData, p: Palette, tex: RoadTextures): THREE.Group {
  const S = track.samples;
  const group = new THREE.Group();

  // Surface texturée
  const surface = new THREE.Mesh(
    strip(S.map((s) => off(s, s.w, 0.02)), S.map((s) => off(s, -s.w, 0.02)), S.map((s) => [0, s.s / 9]), S.map((s) => [1, s.s / 9])),
    toonMaterial({ map: tex.road }),
  );
  surface.name = 'surface';
  surface.receiveShadow = true;
  group.add(surface);

  // Accotements sombres qui descendent sous le terrain
  const dark = epauleDe(p);
  const shoulders = mergeGeometries([
    strip(S.map((s) => off(s, s.w + 0.7, -0.25)), S.map((s) => off(s, s.w, 0.02)), undefined, undefined, dark),
    strip(S.map((s) => off(s, -s.w, 0.02)), S.map((s) => off(s, -s.w - 0.7, -0.25)), undefined, undefined, dark),
  ]);
  if (shoulders) {
    const m = new THREE.Mesh(shoulders, toonMaterial({ vertexColors: true }));
    m.name = 'accotements';
    m.receiveShadow = true;
    group.add(m);
  }

  // Vibreurs
  const curbParts: THREE.BufferGeometry[] = [];
  for (const c of track.curbs) {
    const seg = S.slice(c.from, c.to + 1);
    if (seg.length < 2) continue;
    curbParts.push(strip(seg.map((s) => off(s, s.w + 0.9, 0.05)), seg.map((s) => off(s, s.w, 0.05)), seg.map((s) => [0, s.s / 2]), seg.map((s) => [1, s.s / 2])));
    curbParts.push(strip(seg.map((s) => off(s, -s.w, 0.05)), seg.map((s) => off(s, -s.w - 0.9, 0.05)), seg.map((s) => [0, s.s / 2]), seg.map((s) => [1, s.s / 2])));
  }
  const curbs = new THREE.Mesh(curbParts.length ? mergeGeometries(curbParts)! : new THREE.BufferGeometry(), toonMaterial({ map: tex.curb }));
  curbs.name = 'vibreurs';
  group.add(curbs);

  // Lignes de départ (s = 3 m) et d'arrivée (s = longueur − 1,5 m) en damier
  const lineAt = (s: number): THREE.Mesh => {
    const i = Math.min(S.length - 2, Math.max(0, Math.round(s)));
    const a = S[i], b = S[i + 1];
    const reps = (2 * a.w) / 1.5;
    const m = new THREE.Mesh(
      strip([off(a, a.w, 0.03), off(b, b.w, 0.03)], [off(a, -a.w, 0.03), off(b, -b.w, 0.03)], [[0, 0], [0, 1]], [[reps, 0], [reps, 1]]),
      toonMaterial({ map: tex.checker }),
    );
    return m;
  };
  group.add(lineAt(3), lineAt(track.length - 1.5));

  // Arche d'arrivée
  const f = S[Math.max(0, S.length - 2)];
  const half = f.w + 1.2;
  const arch = new THREE.Mesh(
    mergeGeometries([
      coloredBox(0.4, 5.5, 0.4, half, 2.75, 0, 0x2b2d42),
      coloredBox(0.4, 5.5, 0.4, -half, 2.75, 0, 0x2b2d42),
      coloredBox(2 * half + 0.4, 1.0, 0.3, 0, 5.0, 0, 0xe63b2e),
    ])!,
    toonMaterial({ vertexColors: true }),
  );
  arch.name = 'arche';
  arch.position.set(f.x, f.y, f.z);
  arch.rotation.y = Math.atan2(f.tx, f.tz);
  arch.castShadow = true;
  group.add(arch);
  return group;
}
