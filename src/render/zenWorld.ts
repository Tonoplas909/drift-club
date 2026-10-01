import * as THREE from 'three';
import type { Environnement } from '../core/level/types';
import type { CarId, CarState } from '../core/physics/types';
import { CARS } from '../core/physics/cars';
import { vitessePratique } from '../core/physics/vitessePratique';
import { skinDef, type SkinId } from '../core/skins';
import type { RouteZen } from '../core/zen/route';
import { ambianceA } from '../core/zen/regions';
import type { Assets } from './assets';
import { PALETTES_THEMES, type Palette } from './palettes';
import { QUALITY, type QualityLevel } from './quality';
import { createSky } from './sky';
import { createRoadTextures } from './road';
import { anneauReliefs, anneauVille } from './terrainMesh';
import { CarView, type CarPose } from './carView';
import { SmokeSystem, SkidMarks } from './effects';
import { ChaseCamera, type ChaseConfig, type CameraTarget } from './camera';
import { SpeedGauge, gaugeRatio } from './speedGauge';
import { Snowfall } from './weather';
import { THEMES_VISUELS } from './themes';
import { TronconsZen, paletteZen } from './zenTroncons';
import type { CamLibre } from '../debug/camLibre';

export interface ZenWorldInit {
  renderer: THREE.WebGLRenderer;
  route: RouteZen;
  assets: Assets;
  carId: CarId;
  color: string;
  skin?: SkinId;
  quality: QualityLevel;
}

/** Rayon (m) de l'anneau de reliefs lointains, centré sur la caméra (décor de fond, jamais atteint). */
const RAYON_FOND = 820;

/**
 * Scène du mode Zen : ciel, brume et lumières suivent la palette du décor traversé (fondu pendant les transitions,
 * jour ↔ coucher au fil des kilomètres), reliefs lointains qui s'enfoncent / se lèvent d'un décor à l'autre,
 * tronçons (route, décor, terrain) construits au fil de la route.
 */
export class ZenWorld {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
  readonly troncons: TronconsZen;
  private readonly chase = new ChaseCamera(this.camera);
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;
  private readonly fog: THREE.Fog;
  private readonly carView: CarView;
  private readonly gauge = new SpeedGauge();
  private readonly gaugeMax: number;
  private readonly smoke: SmokeSystem;
  private readonly skids: SkidMarks;
  private readonly snow: Snowfall;
  private readonly fonds = new Map<string, THREE.Mesh>();
  private readonly textures: { dispose(): void }[];
  private quality: QualityLevel;
  private palette: Palette;
  private yFond = 0;
  private readonly rear = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly target: CameraTarget = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0 };
  camLibre: CamLibre | null = null;

  constructor(private readonly init: ZenWorldInit) {
    const { renderer, route, assets, quality } = init;
    this.quality = quality;
    const q = QUALITY[quality];
    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));

    const p = (this.palette = paletteZen(route, 0));
    this.scene.background = new THREE.Color(p.fog);
    this.fog = new THREE.Fog(p.fog, 1, 2);
    this.scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(p.sun, p.sunIntensity);
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 250;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);
    this.sky = createSky(p);
    this.scene.add(this.sky);

    // route : une seule texture (asphalte de la montagne), les accotements prennent la couleur du décor
    const tex = createRoadTextures(PALETTES_THEMES.montagne.jour, renderer.capabilities.getMaxAnisotropy());
    this.textures = [tex.road, tex.curb, tex.checker];
    this.troncons = new TronconsZen(route, assets, tex, quality, () => QUALITY[this.quality].shadows);
    this.scene.add(this.troncons.racine);

    this.snow = new Snowfall(THEMES_VISUELS.neige.meteo?.nombre ?? 900);
    this.snow.points.visible = false;
    this.scene.add(this.snow.points);

    this.carView = new CarView(assets.cars[init.carId], init.color, q.shadows, skinDef(init.carId, init.skin));
    this.scene.add(this.carView.root, this.gauge.root);
    this.gaugeMax = vitessePratique(CARS[init.carId]);
    this.smoke = new SmokeSystem(q.smokeMax, p.fumee);
    this.skids = new SkidMarks(q.skidMax);
    this.scene.add(this.smoke.mesh, this.skids.mesh);
    this.appliquerPalette(p);
  }

  /** Reliefs lointains d'un décor (construits une fois par décor et par ambiance). */
  private fond(th: Environnement, coucher: boolean): THREE.Mesh {
    const cle = `${th}:${coucher ? 'coucher' : 'jour'}`;
    let m = this.fonds.get(cle);
    if (!m) {
      const p = PALETTES_THEMES[th][coucher ? 'coucher' : 'jour'];
      const seed = this.init.route.seed + th.length * 17;
      m = p.reliefs.forme === 'ville' ? anneauVille(p, seed, 0, 0, RAYON_FOND - 150, 0) : anneauReliefs(p, seed, 0, 0, RAYON_FOND, 0);
      m.frustumCulled = false;
      m.visible = false;
      this.fonds.set(cle, m);
      this.scene.add(m);
    }
    return m;
  }

  private appliquerPalette(p: Palette): void {
    this.palette = p;
    (this.scene.background as THREE.Color).set(p.fog);
    const q = QUALITY[this.quality];
    this.fog.color.set(p.fog);
    this.fog.near = q.fogFar * p.brume * 0.3;
    this.fog.far = q.fogFar * p.brume;
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunIntensity;
    const u = (this.sky.material as THREE.ShaderMaterial).uniforms;
    (u.top.value as THREE.Color).set(p.skyTop);
    (u.bottom.value as THREE.Color).set(p.skyBottom);
    ((this.smoke.mesh.material as THREE.MeshToonMaterial).color).set(p.fumee);
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    const q = QUALITY[level];
    this.init.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));
    this.sun.castShadow = q.shadows;
    this.troncons.setQuality(level);
    this.appliquerPalette(this.palette);
  }

  resize(w: number, h: number): void {
    this.init.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  private setTarget(car: CarState, x = car.x, y = car.y, z = car.z): void {
    const t = this.target;
    t.x = x; t.y = y; t.z = z; t.heading = car.heading; t.vx = car.vx; t.vz = car.vz; t.speed = car.speed;
  }

  resetCamera(car: CarState): void {
    this.setTarget(car);
    this.chase.reset(this.target, { dist: 7, height: 2.8, lookAhead: 4, fovMin: 60, fovMax: 72 }, this.init.route.sol);
    this.yFond = car.y;
  }

  resetEffects(): void {
    this.skids.reset();
  }

  shake(impact: number): void {
    this.chase.addShake(impact);
  }

  /** Une image : voiture, effets, caméra, ambiance à l'abscisse `s` de la voiture. */
  update(pose: CarPose, car: CarState, dt: number, cfg: ChaseConfig, s: number): void {
    const route = this.init.route;
    this.carView.update(pose);
    this.carView.rearWheels(this.rear);
    if (car.rearSlip > 0.05 && car.speed > 1) this.smoke.emit(this.rear, car.rearSlip * 35, dt, car.vx, car.vz);
    this.smoke.update(dt);
    const marking = car.rearSlip > 0.35 && car.speed > 3;
    this.skids.add(0, this.rear[0], marking);
    this.skids.add(1, this.rear[1], marking);

    this.setTarget(car, pose.x, pose.y, pose.z);
    this.chase.update(this.target, cfg, dt, route.sol);
    if (this.camLibre) {
      this.camera.position.set(...this.camLibre.pos);
      this.camera.lookAt(...this.camLibre.cible);
    }
    const cam = this.camera.position;
    this.sky.position.copy(cam);

    // ambiance du décor traversé
    this.appliquerPalette(paletteZen(route, s));
    const m = route.regions.melange(s);
    const coucher = ambianceA(s) > 0.5;
    const poidsFond = new Map<THREE.Mesh, number>();
    poidsFond.set(this.fond(m.a, coucher), 1 - m.t);
    if (m.b !== m.a) poidsFond.set(this.fond(m.b, coucher), m.t);
    this.yFond += (pose.y - this.yFond) * (1 - Math.exp(-0.5 * dt));
    for (const f of this.fonds.values()) {
      const w = poidsFond.get(f) ?? 0;
      // un décor s'enfonce pendant que l'autre se lève (les deux sont là au milieu de la transition)
      const h = THREE.MathUtils.smoothstep(w, 0, 0.6);
      f.visible = h > 0.01 && !this.camLibre;
      f.scale.set(1, Math.max(0.01, h), 1);
      f.position.set(cam.x, this.yFond - 20, cam.z);
    }
    // caméra libre (vues aériennes de développement) : sans brume, pour voir les raccords de loin
    if (this.camLibre) { this.fog.near = 3000; this.fog.far = 6000; }
    const neige = route.poidsTheme('neige', s);
    this.snow.points.visible = this.quality === 'haute' && neige > 0.02;
    if (this.snow.points.visible) {
      this.snow.points.geometry.setDrawRange(0, Math.round(this.snow.count * neige));
      this.snow.update(dt, cam);
    }

    this.gauge.update(pose.x, pose.y, pose.z, CARS[this.init.carId].width, gaugeRatio(car.speed, car.reverse, this.gaugeMax), this.camera, dt);
    const d = this.palette.sunDir;
    this.sun.position.set(pose.x + d[0] * 80, pose.y + d[1] * 80, pose.z + d[2] * 80);
    this.sun.target.position.set(pose.x, pose.y, pose.z);
    this.troncons.visibilite(cam.x, cam.z, QUALITY[this.quality].fogFar + 150, this.camLibre !== null);
  }

  render(): void {
    this.init.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.troncons.dispose();
    this.carView.dispose();
    this.gauge.dispose();
    this.smoke.dispose();
    this.skids.dispose();
    this.snow.dispose();
    for (const f of this.fonds.values()) { f.geometry.dispose(); (f.material as THREE.Material).dispose(); }
    this.sky.geometry.dispose();
    (this.sky.material as THREE.Material).dispose();
    for (const t of this.textures) t.dispose();
  }
}

