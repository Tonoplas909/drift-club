import * as THREE from 'three';

let gradient: THREE.DataTexture | null = null;

/** Rampe partagée à 3 tons pour MeshToonMaterial (ombres en aplats). */
export function toonGradient(): THREE.DataTexture {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = THREE.NearestFilter;
    gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

export function toonMaterial(opts: { color?: THREE.ColorRepresentation; vertexColors?: boolean; map?: THREE.Texture | null } = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    vertexColors: opts.vertexColors ?? false,
    map: opts.map ?? null,
    gradientMap: toonGradient(),
  });
}

/** Contour noir par coque inversée : les sommets sont poussés le long de la normale de `width` mètres. */
export function outlineMaterial(width: number, color: THREE.ColorRepresentation = 0x15131c): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  const uniform = { value: width };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.outlineWidth = uniform;
    shader.vertexShader =
      'uniform float outlineWidth;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize( normal ) * outlineWidth;');
  };
  m.customProgramCacheKey = () => 'outline';
  return m;
}

/** Copie de la géométrie avec des normales moyennées par position (contour continu aux arêtes vives). */
export function outlineGeometry(src: THREE.BufferGeometry): THREE.BufferGeometry {
  const pos = src.getAttribute('position') as THREE.BufferAttribute;
  const nor = src.getAttribute('normal') as THREE.BufferAttribute;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', pos);
  if (src.index) geo.setIndex(src.index);
  const key = (i: number) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  const acc = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const k = key(i);
    const a = acc.get(k) ?? [0, 0, 0];
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
    acc.set(k, a);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(key(i))!;
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  geo.boundingSphere = src.boundingSphere;
  return geo;
}
