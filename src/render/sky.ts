import * as THREE from 'three';
import { fbm } from '../core/math/noise';
import { mulberry32 } from '../core/math/rng';
import { smoothstep } from '../core/math/vec';
import type { Palette } from './palettes';
import type { QualityLevel } from './quality';

/** Dôme de ciel en dégradé ; à recentrer sur la caméra à chaque image. Palette avec `ciel` : étoiles et astres en enfants du dôme. */
export function createSky(p: Palette, quality: QualityLevel = 'haute'): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      top: { value: new THREE.Color(p.skyTop) },
      bottom: { value: new THREE.Color(p.skyBottom) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top;
      uniform vec3 bottom;
      varying vec3 vDir;
      void main() {
        float h = smoothstep(-0.05, 0.5, vDir.y);
        gl_FragColor = vec4(mix(bottom, top, h), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  if (p.ciel) ajouterCiel(mesh, p, quality);
  return mesh;
}

/** Couleur (par sommet) d'une sphère « planète » : éclairée d'un côté par le soleil de la palette, nuit de l'autre. */
function planete(rayon: number, dir: THREE.Vector3, soleil: THREE.Vector3, couleur: (n: THREE.Vector3) => THREE.Color): THREE.Group {
  const g = new THREE.IcosahedronGeometry(1, 5);
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    n.set(pos.getX(i), pos.getY(i), pos.getZ(i)).normalize();
    const c = couleur(n);
    c.multiplyScalar(0.22 + 0.78 * smoothstep(-0.2, 0.4, n.dot(soleil)));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const groupe = new THREE.Group();
  const corps = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  // contour noir : coque inversée légèrement plus grande
  const contour = new THREE.Mesh(new THREE.IcosahedronGeometry(1.035, 2), new THREE.MeshBasicMaterial({ color: 0x0a0912, side: THREE.BackSide, fog: false }));
  groupe.add(contour, corps);
  groupe.scale.setScalar(rayon);
  groupe.position.copy(dir).multiplyScalar(1250);
  for (const m of [corps, contour]) { m.frustumCulled = false; }
  return groupe;
}

/** Terre : océans, continents et nuages. */
const terre = (n: THREE.Vector3): THREE.Color => {
  const v = fbm(n.x * 2.6 + n.y * 1.7 + 7, n.z * 2.6 - n.y * 1.3, 11);
  const nuage = fbm(n.x * 4.1 - n.z * 2.0, n.y * 4.6 + n.z * 1.8, 29);
  if (nuage > 0.66) return new THREE.Color(0xf4f7fb);
  if (v > 0.54) return new THREE.Color(Math.abs(n.y) > 0.78 ? 0xf0f4f8 : v > 0.62 ? 0x8c7b4a : 0x4fae5a);
  return new THREE.Color(0x2f6fd0);
};

/** Géante gazeuse : bandes horizontales aux teintes chaudes. */
const geante = (n: THREE.Vector3): THREE.Color => {
  const bande = Math.floor((n.y + 1) * 6 + fbm(n.x * 3, n.z * 3, 5) * 2.2);
  return new THREE.Color([0xe0b07a, 0xc98a52, 0xefd2a4, 0xb56f40, 0xd9a468, 0xf0dcb8][((bande % 6) + 6) % 6]);
};

/** Planète orange : bandes rouille et taches. */
const orange = (n: THREE.Vector3): THREE.Color => {
  const v = fbm(n.x * 3.2 + 4, n.z * 3.2 + n.y * 2, 41);
  return new THREE.Color(v > 0.56 ? 0xe2673a : v > 0.46 ? 0xf08a4a : 0xb4452c);
};

function ajouterCiel(sky: THREE.Mesh, p: Palette, quality: QualityLevel): void {
  const ciel = p.ciel!;
  const rng = mulberry32(2024);
  // étoiles : un seul Points
  const n = quality === 'haute' ? ciel.etoiles : Math.round(ciel.etoiles * 0.5);
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const teintes = [new THREE.Color(0xffffff), new THREE.Color(0xbfd4ff), new THREE.Color(0xfff0c8)];
  for (let i = 0; i < n; i++) {
    const y = -0.08 + rng() * 1.08, a = rng() * Math.PI * 2, r = Math.sqrt(Math.max(0, 1 - y * y));
    pos[i * 3] = Math.cos(a) * r * 1450; pos[i * 3 + 1] = y * 1450; pos[i * 3 + 2] = Math.sin(a) * r * 1450;
    const t = teintes[Math.floor(rng() * 3)], k = 0.55 + rng() * 0.45;
    col[i * 3] = t.r * k; col[i * 3 + 1] = t.g * k; col[i * 3 + 2] = t.b * k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const etoiles = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false }));
  etoiles.frustumCulled = false;
  etoiles.name = 'etoiles';
  sky.add(etoiles);

  const soleil = new THREE.Vector3(...p.sunDir).normalize();
  // deux astres, de part et d'autre : une grande planète pleine et une géante
  const places: [THREE.Vector3, number][] = [[new THREE.Vector3(0.55, 0.3, -0.7).normalize(), 150], [new THREE.Vector3(-0.75, 0.22, 0.55).normalize(), 95]];
  ciel.astres.forEach((a, i) => {
    const [dir, r] = places[i] ?? places[0];
    const astre = planete(r, dir, soleil, a === 'terre' ? terre : a === 'geante' ? geante : orange);
    astre.name = `astre-${a}`;
    if (a === 'geante') {
      // anneaux inclinés, en deux bandes
      const anneau = new THREE.RingGeometry(1.35, 2.3, 48);
      const c = anneau.getAttribute('position');
      const cc = new Float32Array(c.count * 3);
      for (let k = 0; k < c.count; k++) {
        const d = Math.hypot(c.getX(k), c.getY(k));
        const bande = d > 1.8 && d < 1.9 ? 0x2a2230 : d < 1.8 ? 0xd9b98a : 0xb89868;
        const col2 = new THREE.Color(bande);
        cc[k * 3] = col2.r; cc[k * 3 + 1] = col2.g; cc[k * 3 + 2] = col2.b;
      }
      anneau.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      anneau.rotateX(-1.25).rotateZ(0.35);
      const m = new THREE.Mesh(anneau, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
      m.frustumCulled = false;
      astre.add(m);
    }
    sky.add(astre);
  });
}
