import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ENVIRONNEMENTS } from '../../src/core/level/types';
import { THEMES, typesDuTheme } from '../../src/core/env/themes';
import { VARIANTS } from '../../src/core/env/types';
import { PALETTES_THEMES, PALETTES, paletteDe, epauleDe } from '../../src/render/palettes';
import { THEMES_VISUELS, decorDuTheme, retoucher } from '../../src/render/themes';
import { batimentGeometry } from '../../src/render/villeModeles';
import { IMMEUBLES } from '../../src/core/env/ville';
import { decorKey, DECOR_FILES, type Assets } from '../../src/render/assets';
import { coloredBox, colorize } from '../../src/render/procedural';
import { positionFlocon, NEIGE_LARGEUR, NEIGE_HAUTEUR } from '../../src/render/weather';
import { decorDepuisUrl, forcerDecor } from '../../src/game/decorUrl';
import { buildDecor } from '../../src/render/decor';
import { buildMountains } from '../../src/render/terrainMesh';
import { buildTrack } from '../../src/core/track/buildTrack';
import { straightLevel } from '../fixtures/levels';

/** Modèles de base factices : vert (feuillage) + brun (tronc), comme les modèles Kenney. */
const baseDecor = (): Record<string, THREE.BufferGeometry> => {
  const arbre = () => colorize(new THREE.ConeGeometry(1, 3, 6).translate(0, 1.5, 0), 0x2aa88f);
  const d: Record<string, THREE.BufferGeometry> = { panneau0: coloredBox(1, 1, 1, 0, 0.5, 0, 0xaa7744), pneus0: coloredBox(1, 1, 1, 0, 0.5, 0, 0x222222), chevron0: coloredBox(1, 1, 1, 0, 0.5, 0, 0xee3333), borne0: coloredBox(1, 1, 1, 0, 0.5, 0, 0xeeeeee), barriere: coloredBox(1, 1, 1, 0, 0.5, 0, 0xcccccc) };
  for (let i = 0; i < 3; i++) { d[`sapin${i}`] = arbre(); d[`feuillu${i}`] = arbre(); }
  for (let i = 0; i < 2; i++) d[`rocher${i}`] = colorize(new THREE.IcosahedronGeometry(1, 0), 0xcc8855);
  d.rocherHaut0 = colorize(new THREE.IcosahedronGeometry(1, 0), 0xcc8855);
  return d;
};
const fakeAssets = (): Assets => ({ cars: {} as Assets['cars'], decor: baseDecor() });

describe('palettes des thèmes', () => {
  it('chaque environnement a les deux ambiances, mêmes champs que la montagne', () => {
    expect(Object.keys(PALETTES_THEMES).sort()).toEqual([...ENVIRONNEMENTS].sort());
    const cles = Object.keys(PALETTES.jour).sort();
    for (const env of ENVIRONNEMENTS) {
      for (const amb of ['jour', 'coucher'] as const) {
        const p = paletteDe(env, amb);
        const facultatifs = ['epaule', 'trottoir', 'eau', 'plage', 'fondEau', 'vibreurs', 'ciel', 'terrasses', 'plafond'];
        expect(Object.keys(p).filter((k) => !facultatifs.includes(k)).sort()).toEqual(cles.filter((k) => !facultatifs.includes(k)));
        expect(p.brume).toBeGreaterThan(0.3);
        expect(p.brume).toBeLessThanOrEqual(1);
        expect(p.reliefs.ligne).toBeGreaterThan(0);
        expect(['cones', 'mesas', 'ville', 'iles', 'murs', 'lune', 'fuji']).toContain(p.reliefs.forme);
        expect(epauleDe(p)).toBeInstanceOf(THREE.Color);
      }
    }
  });
  it('la palette de la montagne reste celle d’origine', () => {
    expect(PALETTES.jour.grassA).toBe(0x7cc152);
    expect(PALETTES.coucher.skyBottom).toBe(0xffb37a);
    expect(PALETTES.jour.epaule).toBeUndefined();
    expect(epauleDe(PALETTES.jour).getHex()).toBe(new THREE.Color(0x4a4d57).multiplyScalar(0.7).getHex());
  });
  it('les reliefs sont construits pour chaque palette (cônes ou mesas)', () => {
    const track = buildTrack(straightLevel(200));
    for (const env of ENVIRONNEMENTS) {
      const m = buildMountains(track, paletteDe(env, 'jour'), 3);
      expect(m.geometry.getAttribute('position').count).toBeGreaterThan(100);
    }
  });
});

describe('ville : palettes et modèles', () => {
  it('sol de béton, parcs verts, trottoir et silhouette d’immeubles au fond', () => {
    for (const amb of ['jour', 'coucher'] as const) {
      const p = paletteDe('ville', amb);
      expect(p.reliefs.forme).toBe('ville');
      expect(p.trottoir).toBeDefined();
      expect(p.epaule).toBeDefined();
      const v = new THREE.Color(p.forestFloor), g = new THREE.Color(p.grassA);
      expect(v.g).toBeGreaterThan(v.r); // parc = vert
      expect(Math.abs(g.r - g.b)).toBeLessThan(0.08); // béton = gris
    }
    expect(PALETTES_THEMES.montagne.jour.trottoir).toBeUndefined();
  });
  it('les silhouettes du fond sont des blocs (plus de sommets que les cônes ne suffisent, tous finis)', () => {
    const track = buildTrack(straightLevel(200));
    const m = buildMountains(track, paletteDe('ville', 'jour'), 3);
    const pos = m.geometry.getAttribute('position');
    expect(pos.count).toBe(96 * 36); // 96 blocs de 12 triangles
    for (const x of pos.array as Float32Array) expect(Number.isFinite(x)).toBe(true);
  });
  it('un bâtiment a un contour sur le corps seul, des couleurs valides et des fenêtres', () => {
    const b = IMMEUBLES[6];
    const jour = batimentGeometry(b, 1, 'jour'), soir = batimentGeometry(b, 1, 'coucher');
    const contour = jour.userData.contour as THREE.BufferGeometry;
    expect(contour.getAttribute('position').count).toBeLessThan(jour.getAttribute('position').count / 2);
    for (const g of [jour, soir]) {
      for (const a of ['position', 'normal', 'color']) expect(g.getAttribute(a)).toBeDefined();
      for (const x of g.getAttribute('color').array as Float32Array) expect(Number.isFinite(x)).toBe(true);
    }
    // au coucher, des fenêtres « allumées » dépassent 1 (elles brillent) ; le jour, aucune
    const max = (g: THREE.BufferGeometry) => Math.max(...(g.getAttribute('color').array as Float32Array));
    expect(max(soir)).toBeGreaterThan(1);
    expect(max(jour)).toBeLessThanOrEqual(1);
    // hauteur = étages × hauteur d'étage (+ toiture)
    jour.computeBoundingBox();
    expect(jour.boundingBox!.max.y).toBeGreaterThan(b.etages * 3);
    expect(jour.boundingBox!.min.y).toBeLessThan(-1); // fondations enterrées
  });
  it('les modèles dépendent de l’ambiance (fenêtres allumées) et sont mis en cache par ambiance', () => {
    const a = fakeAssets();
    const j = decorDuTheme(a, 'ville', 'jour'), c = decorDuTheme(a, 'ville', 'coucher');
    expect(j).not.toBe(c);
    expect(decorDuTheme(a, 'ville', 'coucher')).toBe(c);
    expect(decorDuTheme(a, 'ville')).toBe(j);
    expect(j.immeuble0).not.toBe(c.immeuble0);
    expect(j.panneau0).toBe(a.decor.panneau0);
  });
  it('le contour d’un bâtiment est utilisé par le rendu du décor', () => {
    const a = fakeAssets();
    const decor = decorDuTheme(a, 'ville');
    const env = { items: [{ kind: 'immeuble' as const, variant: 0, x: 0, y: 0, z: 0, rot: 0, scale: 1, solid: true, manual: false }], circles: [], segments: [], barriers: [] };
    const g = buildDecor(env, a, 'haute', false, decor);
    const meshes = g.children as THREE.InstancedMesh[];
    expect(meshes.length).toBe(2);
    expect(meshes[1].geometry.getAttribute('position').count).toBe((decor.immeuble0.userData.contour as THREE.BufferGeometry).getAttribute('position').count);
  });
});

describe('modèles de décor par thème', () => {
  it('chaque environnement a ses données visuelles', () => {
    expect(Object.keys(THEMES_VISUELS).sort()).toEqual([...ENVIRONNEMENTS].sort());
  });
  for (const env of ENVIRONNEMENTS) {
    it(`${env} : un modèle pour chaque type et variante que le générateur peut produire`, () => {
      const decor = decorDuTheme(fakeAssets(), env);
      for (const kind of typesDuTheme(THEMES[env])) {
        // barrière / glissière : une seule géométrie sans variante numérotée
        for (let v = 0; v < VARIANTS[kind]; v++) {
          const g = decor[decorKey(kind, v)];
          expect(g, `${env} ${kind}${v}`).toBeDefined();
          for (const a of ['position', 'normal', 'color']) expect(g.getAttribute(a), `${env} ${kind}${v} ${a}`).toBeDefined();
          expect(g.getAttribute('position').count).toBeGreaterThan(0);
          for (const x of g.getAttribute('position').array as Float32Array) expect(Number.isFinite(x)).toBe(true);
        }
      }
      expect(decor.barriere).toBeDefined();
    });
  }
  it('la base factice reprend les vraies clés de modèles (Kenney + procéduraux de assets.ts)', () => {
    expect(Object.keys(baseDecor()).sort()).toEqual([...Object.keys(DECOR_FILES), 'pneus0', 'chevron0', 'borne0', 'barriere'].sort());
  });
  it('montagne : les modèles de base tels quels ; autres thèmes : mis en cache, base intacte', () => {
    const a = fakeAssets();
    expect(decorDuTheme(a, 'montagne')).toBe(a.decor);
    const avant = Array.from(a.decor.sapin0.getAttribute('color').array);
    const n = decorDuTheme(a, 'neige');
    expect(decorDuTheme(a, 'neige')).toBe(n);
    expect(n.sapin0).not.toBe(a.decor.sapin0);
    expect(Array.from(a.decor.sapin0.getAttribute('color').array)).toEqual(avant);
    expect(n.panneau0).toBe(a.decor.panneau0);
  });
  it('les objets d’un thème s’instancient (une InstancedMesh par modèle)', () => {
    const a = fakeAssets();
    const decor = decorDuTheme(a, 'desert');
    const env = { items: [{ kind: 'cactus' as const, variant: 1, x: 0, y: 0, z: 0, rot: 0, scale: 1, solid: true, manual: false }, { kind: 'mesa' as const, variant: 0, x: 9, y: 0, z: 9, rot: 0, scale: 1.2, solid: false, manual: false }], circles: [], segments: [], barriers: [] };
    const g = buildDecor(env, a, 'haute', false, decor);
    expect(g.children.filter((c) => (c as THREE.InstancedMesh).isInstancedMesh).length).toBeGreaterThanOrEqual(2);
  });
  it('retoucher : recolore vert et brun, neige sur les faces vers le haut, sans toucher la source', () => {
    const src = colorize(new THREE.BoxGeometry(1, 1, 1), 0x2aa88f);
    const avant = Array.from(src.getAttribute('color').array);
    const r = retoucher(src, { vert: 0xff0000, neige: { couleur: 0xffffff, seuil: 0.2 } });
    expect(Array.from(src.getAttribute('color').array)).toEqual(avant);
    const nor = r.getAttribute('normal'), col = r.getAttribute('color');
    let haut = 0, cote = 0;
    for (let i = 0; i < col.count; i++) {
      if (nor.getY(i) > 0.9) { expect(col.getY(i)).toBeCloseTo(1, 5); haut++; } // blanc
      else if (Math.abs(nor.getY(i)) < 0.1) { expect(col.getX(i)).toBeGreaterThan(0.9); expect(col.getY(i)).toBeLessThan(0.1); cote++; } // rouge
    }
    expect(haut).toBeGreaterThan(0);
    expect(cote).toBeGreaterThan(0);
  });
});

describe('neige (météo)', () => {
  it('les flocons restent dans le volume autour de la caméra, en tout temps', () => {
    const o = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 200; i++) {
      const cam = [i * 37.3 - 3000, 50 + i, -i * 11.1];
      positionFlocon((i * 13.7) % NEIGE_LARGEUR, (i * 5.3) % NEIGE_HAUTEUR, (i * 7.9) % NEIGE_LARGEUR, 2, i, i * 0.37, cam[0], cam[1], cam[2], o);
      expect(Math.abs(o.x - cam[0])).toBeLessThanOrEqual(NEIGE_LARGEUR / 2 + 1e-6);
      expect(Math.abs(o.z - cam[2])).toBeLessThanOrEqual(NEIGE_LARGEUR / 2 + 1e-6);
      expect(o.y - cam[1]).toBeGreaterThanOrEqual(-NEIGE_HAUTEUR * 0.35 - 1e-6);
      expect(o.y - cam[1]).toBeLessThanOrEqual(NEIGE_HAUTEUR * 0.65 + 1e-6);
    }
  });
  it('un flocon descend', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 };
    positionFlocon(5, 20, 5, 2, 0, 0, 0, 0, 0, a);
    positionFlocon(5, 20, 5, 2, 0, 1, 0, 0, 0, b);
    expect(b.y).toBeLessThan(a.y);
  });
  it('seuls la neige et le japon (pétales) ont de la météo', () => {
    expect(THEMES_VISUELS.japon.meteo?.type).toBe('petales');
    expect(THEMES_VISUELS.pirate.meteo).toBeUndefined();
    expect(THEMES_VISUELS.ville.meteo).toBeUndefined();
    expect(THEMES_VISUELS.neige.meteo?.nombre).toBeGreaterThan(0);
    expect(THEMES_VISUELS.montagne.meteo).toBeUndefined();
    expect(THEMES_VISUELS.desert.meteo).toBeUndefined();
  });
});

describe('aperçu ?theme= et ?ambiance=', () => {
  it('lit un thème et une ambiance valides, ignore le reste', () => {
    expect(decorDepuisUrl('?theme=desert&ambiance=coucher')).toEqual({ environnement: 'desert', ambiance: 'coucher' });
    expect(decorDepuisUrl('?debug&theme=neige')).toEqual({ environnement: 'neige' });
    expect(decorDepuisUrl('?theme=ville&ambiance=coucher')).toEqual({ environnement: 'ville', ambiance: 'coucher' });
    expect(decorDepuisUrl('?theme=lune&ambiance=nuit')).toEqual({});
    expect(decorDepuisUrl('')).toEqual({});
  });
  it('remplace l’environnement d’un niveau sans le modifier', () => {
    const lv = { format: 1, environnement: 'montagne', ambiance: 'jour' };
    expect(forcerDecor(lv, '?theme=automne')).toEqual({ format: 1, environnement: 'automne', ambiance: 'jour' });
    expect(lv.environnement).toBe('montagne');
    expect(forcerDecor(lv, '?debug')).toBe(lv);
    expect(forcerDecor(null, '?theme=neige')).toBeNull();
    expect(forcerDecor([1], '?theme=neige')).toEqual([1]);
  });
});
