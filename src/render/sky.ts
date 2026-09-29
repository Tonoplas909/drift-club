import * as THREE from 'three';
import type { Palette } from './palettes';

/** Dôme de ciel en dégradé ; à recentrer sur la caméra à chaque image. */
export function createSky(p: Palette): THREE.Mesh {
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
  return mesh;
}
