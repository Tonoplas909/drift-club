import * as THREE from 'three';
import type { Environnement } from '../core/level/types';
import type { TrackSample } from '../core/track/buildTrack';
import { finirPiste } from '../core/track/buildTrack';
import { forestMask, forestThreshold } from '../core/env/generate';
import { THEMES } from '../core/env/themes';
import { fbm } from '../core/math/noise';
import { smoothstep } from '../core/math/vec';
import { ambianceA } from '../core/zen/regions';
import type { RouteZen, Troncon, EvenementRoute } from '../core/zen/route';
import type { Assets } from './assets';
import { decorDuTheme } from './themes';
import { buildDecor, materiauxDecor, type MateriauxDecor } from './decor';
import { buildRoad, type RoadTextures } from './road';
import { chunkStep, geometrieMorceau, materiauTerrain } from './terrainMesh';
import { PALETTES_THEMES, epauleDe, melangerPalettes, type Palette } from './palettes';
import type { QualityLevel } from './quality';

/** Morceaux de terrain de 64 m, construits jusqu’à 250 m de l'axe (centre) du tronçon propriétaire. */
export const TUILE = 64;
export const RAYON_TUILES = 250;

/** Palette du mode Zen à l'abscisse `s` : mélange des deux décors de la transition et du jour / coucher. */
export function paletteZen(route: RouteZen, s: number): Palette {
  const m = route.regions.melange(s);
  const amb = ambianceA(s);
  const de = (th: Environnement): Palette => melangerPalettes(PALETTES_THEMES[th].jour, PALETTES_THEMES[th].coucher, amb);
  return melangerPalettes(de(m.a), de(m.b), m.t);
}

interface Tuile { cle: number; ix: number; iz: number; n: number; d: number; mesh: THREE.Mesh | null }

interface Visuel { groupe: THREE.Group; tuiles: Set<number> }

const cleTuile = (ix: number, iz: number): number => (ix + 32768) * 65536 + (iz + 32768);

/** Couleurs de sol d'une palette, prêtes à mélanger (espace linéaire de three.js). */
interface Sol { a: THREE.Color; b: THREE.Color; foret: THREE.Color; roche: THREE.Color; epaule: THREE.Color; trottoir: THREE.Color | null; seuil: number }

/**
 * Tout ce que le rendu construit pour les tronçons du mode Zen : route, décor (un groupe par tronçon) et terrain en
 * morceaux de 64 m, construits petit à petit (quelques-uns par image) du plus proche au plus lointain.
 */
export class TronconsZen {
  readonly racine = new THREE.Group();
  private readonly visuels = new Map<number, Visuel>();
  private readonly tuiles = new Map<number, Tuile>();
  private readonly attente: Tuile[] = [];
  private readonly matTerrain = materiauTerrain();
  private readonly matDecor: MateriauxDecor = materiauxDecor();
  private readonly sols = new Map<string, Sol>();
  /** temps de construction (ms) des derniers morceaux de terrain et groupes de tronçon (mesures) */
  readonly mesures = { tuiles: [] as number[], troncons: [] as number[] };

  constructor(
    private readonly route: RouteZen,
    private readonly assets: Assets,
    private readonly tex: RoadTextures,
    private quality: QualityLevel,
    private readonly ombres: () => boolean,
  ) {
    this.racine.name = 'zen';
  }

  get nbTuiles(): number { return this.tuiles.size; }
  get enAttente(): number { return this.attente.length; }

  setQuality(q: QualityLevel): void { this.quality = q; }

  /** Applique les événements de la route (tronçon fini : route + décor + morceaux de terrain à construire ; retiré : libéré). */
  appliquer(evs: EvenementRoute[]): void {
    for (const e of evs) {
      if (e.type === 'fini') this.ajouter(e.troncon);
      else this.retirer(e.troncon);
    }
  }

  private ajouter(t: Troncon): void {
    if (this.visuels.has(t.n)) this.retirer(t);
    const t0 = performance.now();
    const groupe = new THREE.Group();
    groupe.name = `troncon-${t.n}`;
    // route : échantillons du tronçon (plus le premier du suivant, pour raccorder), textures continues d'un tronçon à l'autre
    const S: TrackSample[] = [];
    for (let i = t.debut; i <= t.fin; i++) S.push({ ...this.route.echantillon(i), s: i - t.debut });
    const piste = finirPiste(S);
    const pal = paletteZen(this.route, (t.debut + t.fin) / 2);
    const cEp = new THREE.Color();
    groupe.add(buildRoad(piste, pal, this.tex, {
      lignes: false, sDebut: t.debut,
      epaule: (sp) => cEp.copy(epauleDe(paletteZen(this.route, sp.s + t.debut))),
    }));
    for (const p of t.parties ?? []) {
      const decor = decorDuTheme(this.assets, p.theme, t.ambiance);
      groupe.add(buildDecor(p.env, this.assets, this.quality, this.ombres(), decor, this.matDecor));
    }
    this.racine.add(groupe);
    const v: Visuel = { groupe, tuiles: new Set() };
    this.visuels.set(t.n, v);
    // morceaux de terrain dont ce tronçon est le propriétaire (axe le plus proche) et pas encore construits
    const b = t.boite;
    for (let iz = Math.floor((b.minZ - RAYON_TUILES) / TUILE); iz <= Math.floor((b.maxZ + RAYON_TUILES) / TUILE); iz++) {
      for (let ix = Math.floor((b.minX - RAYON_TUILES) / TUILE); ix <= Math.floor((b.maxX + RAYON_TUILES) / TUILE); ix++) {
        const cle = cleTuile(ix, iz);
        if (this.tuiles.has(cle)) continue;
        const p = this.route.proprietaire(t.n, (ix + 0.5) * TUILE, (iz + 0.5) * TUILE);
        if (p.n !== t.n || p.d > RAYON_TUILES) continue;
        const tu: Tuile = { cle, ix, iz, n: t.n, d: p.d, mesh: null };
        this.tuiles.set(cle, tu);
        v.tuiles.add(cle);
        this.attente.push(tu);
      }
    }
    this.mesures.troncons.push(performance.now() - t0);
  }

  private retirer(t: Troncon): void {
    const v = this.visuels.get(t.n);
    if (!v) return;
    this.visuels.delete(t.n);
    this.racine.remove(v.groupe);
    v.groupe.traverse((o) => {
      const im = o as THREE.InstancedMesh;
      if (im.isInstancedMesh) { im.dispose(); return; } // la géométrie des modèles est partagée
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose?.(); }
    });
    // morceaux de terrain : repris par un autre tronçon affiché s'il est assez proche, sinon libérés
    for (const cle of v.tuiles) {
      const tu = this.tuiles.get(cle);
      if (!tu) continue;
      const cx = (tu.ix + 0.5) * TUILE, cz = (tu.iz + 0.5) * TUILE;
      let best = RAYON_TUILES + 1, bn = -1;
      for (const [n] of this.visuels) {
        const p = this.route.proprietaire(n, cx, cz);
        if (p.n === n && p.d < best) { best = p.d; bn = n; }
      }
      if (bn >= 0) {
        tu.n = bn;
        this.visuels.get(bn)!.tuiles.add(cle);
      } else {
        this.libererTuile(tu);
      }
    }
  }

  private libererTuile(tu: Tuile): void {
    this.tuiles.delete(tu.cle);
    if (tu.mesh) {
      this.racine.remove(tu.mesh);
      tu.mesh.geometry.dispose();
      tu.mesh = null;
    }
    const i = this.attente.indexOf(tu);
    if (i >= 0) this.attente.splice(i, 1);
  }

  /** Construit le morceau de terrain en attente le plus proche de (x, z) ; false s'il n'y en a pas. */
  travailler(x: number, z: number): boolean {
    if (this.attente.length === 0) return false;
    let k = 0, best = Infinity;
    for (let i = 0; i < this.attente.length; i++) {
      const tu = this.attente[i];
      const d = ((tu.ix + 0.5) * TUILE - x) ** 2 + ((tu.iz + 0.5) * TUILE - z) ** 2;
      if (d < best) { best = d; k = i; }
    }
    const tu = this.attente.splice(k, 1)[0];
    const t0 = performance.now();
    tu.mesh = this.construireTuile(tu);
    this.racine.add(tu.mesh);
    this.mesures.tuiles.push(performance.now() - t0);
    if (this.mesures.tuiles.length > 200) this.mesures.tuiles.shift();
    return true;
  }

  /** Couleurs de sol d'un décor à une ambiance (0 = jour, 1 = coucher), gardées en cache par pas de 1/16. */
  private solDe(th: Environnement, amb: number): Sol {
    const q = Math.round(amb * 16) / 16;
    const cle = `${th}:${q}`;
    let s = this.sols.get(cle);
    if (!s) {
      const p = melangerPalettes(PALETTES_THEMES[th].jour, PALETTES_THEMES[th].coucher, q);
      s = {
        a: new THREE.Color(p.grassA), b: new THREE.Color(p.grassB), foret: new THREE.Color(p.forestFloor), roche: new THREE.Color(p.rock),
        epaule: epauleDe(p), trottoir: p.trottoir !== undefined ? new THREE.Color(p.trottoir) : null,
        seuil: forestThreshold(0.6, THEMES[th].arbres.seuilMin),
      };
      this.sols.set(cle, s);
    }
    return s;
  }

  private construireTuile(tu: Tuile): THREE.Mesh {
    const route = this.route, sol = route.sol, seed = route.seed;
    const x0 = tu.ix * TUILE, z0 = tu.iz * TUILE;
    const step = chunkStep(Math.max(0, tu.d - TUILE * 0.71), this.quality);
    const ca = new THREE.Color(), cb = new THREE.Color();
    const peindre = (s: Sol, x: number, z: number, slope: number, roadDist: number, roadW: number, c: THREE.Color): void => {
      c.copy(s.a).lerp(s.b, fbm(x / 30, z / 30, seed + 5));
      c.lerp(s.foret, smoothstep(s.seuil, s.seuil + 0.08, forestMask(x, z, seed)) * 0.85);
      c.lerp(s.roche, smoothstep(0.7, 1.15, slope));
      if (s.trottoir && roadDist < 1e8) c.lerp(s.trottoir, 1 - smoothstep(roadW + 3.6, roadW + 4.8, roadDist));
      if (roadDist < 1e8) c.lerp(s.epaule, 1 - smoothstep(roadW + 0.5, roadW + 1.5, roadDist));
    };
    const couleur = (x: number, z: number, slope: number, c: THREE.Color): void => {
      const p = route.proprietaire(tu.n, x, z);
      const m = route.regions.melange(p.s);
      const amb = ambianceA(p.s);
      const near = sol.plusProche(x, z, 14);
      const rd = near ? near.dist : 1e9, rw = near ? near.w : 0;
      peindre(this.solDe(m.a, amb), x, z, slope, rd, rw, ca);
      if (m.t > 0 && m.b !== m.a) {
        peindre(this.solDe(m.b, amb), x, z, slope, rd, rw, cb);
        ca.lerp(cb, m.t);
      }
      c.copy(ca);
    };
    const geo = geometrieMorceau(x0, z0, TUILE, step, (x, z) => sol.hauteurRendue(x, z), couleur);
    const mesh = new THREE.Mesh(geo, this.matTerrain);
    mesh.receiveShadow = true;
    mesh.name = 'tuile';
    mesh.userData.center = new THREE.Vector3(x0 + TUILE / 2, 0, z0 + TUILE / 2);
    return mesh;
  }

  /** Masque les morceaux de terrain au-delà de `dMax` m de la caméra (tout est visible en caméra libre). */
  visibilite(cx: number, cz: number, dMax: number, tout: boolean): void {
    for (const tu of this.tuiles.values()) {
      if (!tu.mesh) continue;
      const c = tu.mesh.userData.center as THREE.Vector3;
      tu.mesh.visible = tout || (c.x - cx) ** 2 + (c.z - cz) ** 2 < dMax * dMax;
    }
  }

  /** Libère tout (fin de balade). */
  dispose(): void {
    for (const n of [...this.visuels.keys()]) {
      const t = this.route.troncon(n);
      if (t) this.retirer(t);
      else this.visuels.delete(n);
    }
    for (const tu of [...this.tuiles.values()]) this.libererTuile(tu);
    this.matTerrain.dispose();
    this.matDecor.mat.dispose();
    this.matDecor.outline.dispose();
    this.matDecor.outlineGros.dispose();
  }
}

