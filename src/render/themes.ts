import * as THREE from 'three';
import type { Ambiance, Environnement } from '../core/level/types';
import { smoothstep } from '../core/math/vec';
import { decorKey, type Assets } from './assets';
import {
  arbreSecGeometry, buissonGeometry, cactusGeometry, mesaGeometry, piquetGeometry, soucheGeometry, tasNeigeGeometry,
} from './proceduralDecor';
import { decorVille } from './villeModeles';

type Decor = Record<string, THREE.BufferGeometry>;

/** Retouche des couleurs d'un modèle Kenney (les sommets portent la couleur du matériau : vert = feuillage/herbe, brun = bois/terre). */
export interface Retouche {
  /** remplace les sommets « verts » (feuillage, mousse) */
  vert?: number;
  /** remplace les sommets « bruns » (écorce, roche) */
  brun?: number;
  /** blanchit les faces tournées vers le haut : `seuil` = composante y de la normale à partir de laquelle la neige tient */
  neige?: { couleur: number; seuil: number; surBrun?: boolean };
}

/** Copie de `src` recolorée. Le modèle d'origine n'est pas touché (partagé entre tous les niveaux). */
export function retoucher(src: THREE.BufferGeometry, r: Retouche): THREE.BufferGeometry {
  const geo = src.clone();
  const col = geo.getAttribute('color') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const vert = r.vert !== undefined ? new THREE.Color(r.vert) : null;
  const brun = r.brun !== undefined ? new THREE.Color(r.brun) : null;
  const neige = r.neige ? new THREE.Color(r.neige.couleur) : null;
  const c = new THREE.Color();
  for (let i = 0; i < col.count; i++) {
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i));
    const estVert = c.g > c.r;
    if (estVert && vert) c.copy(vert);
    else if (!estVert && brun) c.copy(brun);
    if (neige && r.neige && nor && (estVert || r.neige.surBrun)) {
      c.lerp(neige, smoothstep(r.neige.seuil, r.neige.seuil + 0.2, nor.getY(i)));
    }
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  return geo;
}

/** Particules de météo (léger, une seule draw call, désactivées en qualité Basse). */
export interface Meteo { type: 'neige'; nombre: number }

export interface ThemeVisuel {
  /** modèles propres au thème, par clé `kind + variante` ; le reste vient des modèles de base */
  decor: (base: Decor, ambiance: Ambiance) => Decor;
  meteo?: Meteo;
}

const par3 = (kind: string, f: (i: number) => THREE.BufferGeometry, n = 3): Decor =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${kind}${i}`, f(i)]));

const NEIGE_ARBRE = { couleur: 0xf6f9ff, seuil: 0.15 };
const NEIGE_ROCHE = { couleur: 0xf3f7fc, seuil: 0.3, surBrun: true };

/** Décor de chaque thème. « montagne » = les modèles Kenney tels quels. */
export const THEMES_VISUELS: Record<Environnement, ThemeVisuel> = {
  montagne: { decor: () => ({}) },
  neige: {
    meteo: { type: 'neige', nombre: 900 },
    decor: (b) => ({
      ...par3('sapin', (i) => retoucher(b[decorKey('sapin', i)], { vert: 0x2f6a5e, brun: 0x6f5b52, neige: NEIGE_ARBRE })),
      ...par3('feuillu', (i) => retoucher(b[decorKey('feuillu', i)], { vert: 0xc9dbe8, brun: 0x6f5b52, neige: { couleur: 0xf6f9ff, seuil: 0 } })),
      ...par3('rocher', (i) => retoucher(b[decorKey('rocher', i)], { vert: 0xf3f7fc, brun: 0x858e9e, neige: NEIGE_ROCHE }), 2),
      rocherHaut0: retoucher(b.rocherHaut0, { vert: 0xf3f7fc, brun: 0x858e9e, neige: NEIGE_ROCHE }),
      piquet0: piquetGeometry(),
      ...par3('tasNeige', (i) => tasNeigeGeometry(i), 2),
    }),
  },
  desert: {
    decor: (b) => ({
      ...par3('rocher', (i) => retoucher(b[decorKey('rocher', i)], { vert: 0xd9b070, brun: 0xb4583c }), 2),
      ...par3('cactus', (i) => cactusGeometry(i)),
      ...par3('buisson', (i) => buissonGeometry(i), 2),
      ...par3('arbreSec', (i) => arbreSecGeometry(i), 2),
      ...par3('mesa', (i) => mesaGeometry(i), 2),
    }),
  },
  automne: {
    decor: (b) => ({
      feuillu0: retoucher(b.feuillu0, { vert: 0xdf5a1c }),
      feuillu1: retoucher(b.feuillu1, { vert: 0xeab02a }),
      feuillu2: retoucher(b.feuillu2, { vert: 0xb63a26 }),
      sapin0: retoucher(b.sapin0, { vert: 0xd6a02a }),
      sapin1: retoucher(b.sapin1, { vert: 0x2f6b3a }),
      sapin2: retoucher(b.sapin2, { vert: 0xc4622a }),
      ...par3('rocher', (i) => retoucher(b[decorKey('rocher', i)], { vert: 0x9a8a3c }), 2),
      souche0: soucheGeometry(),
    }),
  },
  ville: {
    decor: (b, ambiance) => ({
      // arbres des parcs : feuillus d'un vert franc ; le reste est procédural (immeubles, mobilier…)
      ...par3('feuillu', (i) => retoucher(b[decorKey('feuillu', i)], { vert: [0x62b04e, 0x55a247, 0x6dbb55][i] })),
      ...decorVille(ambiance),
    }),
  },
};

const cache = new WeakMap<Decor, Map<string, Decor>>();

/**
 * Modèles de décor à utiliser pour un thème : les modèles de base, avec les variantes du thème par-dessus.
 * Construits une fois par thème puis partagés entre les niveaux (ne pas les libérer).
 */
export function decorDuTheme(assets: Assets, env: Environnement, ambiance: Ambiance = 'jour'): Decor {
  if (env === 'montagne') return assets.decor;
  let m = cache.get(assets.decor);
  if (!m) { m = new Map(); cache.set(assets.decor, m); }
  // l'ambiance compte pour les fenêtres et lampadaires allumés (ville) ; les autres thèmes s'en moquent
  const cle = env === 'ville' ? `${env}:${ambiance}` : env;
  let d = m.get(cle);
  if (!d) {
    d = { ...assets.decor, ...THEMES_VISUELS[env].decor(assets.decor, ambiance) };
    for (const g of Object.values(d)) if (!g.boundingSphere) g.computeBoundingSphere();
    m.set(cle, d);
  }
  return d;
}
