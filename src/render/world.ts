import * as THREE from 'three';
import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Terrain } from '../core/track/terrain';
import type { Environment } from '../core/env/types';
import type { CarId, CarState } from '../core/physics/types';
import type { Assets } from './assets';
import { paletteDe, type Palette } from './palettes';
import { decorDuTheme, THEMES_VISUELS } from './themes';
import { Snowfall } from './weather';
import { Scintillement } from './scintillement';
import { QUALITY, type QualityLevel } from './quality';
import { createSky } from './sky';
import { Eau } from './eau';
import { buildRoad, createRoadTextures } from './road';
import { buildTerrain, buildMountains } from './terrainMesh';
import { buildDecor } from './decor';
import { CarView, type CarPose } from './carView';
import { SmokeSystem, SkidMarks } from './effects';
import { ChaseCamera, type ChaseConfig, type CameraTarget } from './camera';
import { SpeedGauge, gaugeRatio } from './speedGauge';
import { CARS } from '../core/physics/cars';
import { skinDef, type SkinId } from '../core/skins';
import { vitessePratique } from '../core/physics/vitessePratique';
import type { CamLibre } from '../debug/camLibre';

export interface WorldInit {
  renderer: THREE.WebGLRenderer;
  level: Level;
  track: TrackData;
  terrain: Terrain;
  env: Environment;
  assets: Assets;
  carId: CarId;
  color: string;
  /** livrée du modèle (défaut : unie) */
  skin?: SkinId;
  quality: QualityLevel;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
  private readonly chase = new ChaseCamera(this.camera);
  private readonly palette: Palette;
  private readonly sun: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;
  private readonly decor: Record<string, THREE.BufferGeometry>;
  private readonly snow: Snowfall | null = null;
  private readonly scintille: Scintillement | null = null;
  private readonly terrainGroup: THREE.Group;
  private readonly carView: CarView;
  private readonly gauge = new SpeedGauge();
  /** vitesse à laquelle la jauge est pleine (m/s) */
  private readonly gaugeMax: number;
  private smoke: SmokeSystem;
  private skids: SkidMarks;
  private quality: QualityLevel;
  private readonly rear = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly target: CameraTarget = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0 };
  private readonly owned: { dispose(): void }[] = [];
  private eau: Eau | null = null;
  /** caméra libre (développement, `?debug`) : remplace la caméra de poursuite */
  camLibre: CamLibre | null = null;

  constructor(private readonly init: WorldInit) {
    const { renderer, level, track, terrain, env, assets, quality } = init;
    this.quality = quality;
    const q = QUALITY[quality];
    const p = (this.palette = paletteDe(level.environnement, level.ambiance));

    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));

    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, q.fogFar * p.brume * 0.3, q.fogFar * p.brume);

    this.scene.add(new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity));
    this.sun = new THREE.DirectionalLight(p.sun, p.sunIntensity);
    this.sun.castShadow = q.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 250;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun, this.sun.target);

    this.sky = createSky(p, quality);
    this.scene.add(this.sky);

    const tex = createRoadTextures(p, renderer.capabilities.getMaxAnisotropy());
    this.owned.push(tex.road, tex.curb, tex.checker);
    this.scene.add(buildRoad(track, p, tex));
    this.terrainGroup = buildTerrain(level, track, terrain, p, quality);
    this.scene.add(this.terrainGroup);
    this.scene.add(buildMountains(track, p, level.decor.graine, terrain.mer?.niveau));
    const plans = [...terrain.plans];
    if (terrain.mer) {
      // mer : un plan immense au niveau de la mer, caché par le terrain là où il émerge
      const cx = (terrain.minX + terrain.maxX) / 2, cz = (terrain.minZ + terrain.maxZ) / 2, h = 3200;
      plans.push({ niveau: terrain.mer.niveau, points: [{ x: cx - h, z: cz - h }, { x: cx + h, z: cz - h }, { x: cx + h, z: cz + h }, { x: cx - h, z: cz + h }] });
    }
    if (plans.length > 0) {
      this.eau = new Eau(plans, p, quality);
      this.scene.add(this.eau.group);
    }
    this.decor = decorDuTheme(assets, level.environnement, level.ambiance);
    const decorGroupe = buildDecor(env, assets, quality, q.shadows, this.decor);
    this.scene.add(decorGroupe);
    const meteo = THEMES_VISUELS[level.environnement].meteo;
    const theme = THEMES_VISUELS[level.environnement];
    if (theme.scintillement) this.scintille = new Scintillement(decorGroupe, theme.scintillement);
    if (meteo) {
      this.snow = new Snowfall(meteo.nombre, 5, meteo.type === 'petales'
        ? { couleur: 0xffb3cc, taille: 0.17, vitesse: [0.6, 1.2], derive: 1.8, petale: true, nom: 'petales' }
        : {});
      this.snow.points.visible = quality === 'haute';
      this.scene.add(this.snow.points);
    }

    this.carView = new CarView(assets.cars[init.carId], init.color, q.shadows, skinDef(init.carId, init.skin));
    this.scene.add(this.carView.root, this.gauge.root);
    this.gaugeMax = vitessePratique(CARS[init.carId]);
    this.smoke = new SmokeSystem(q.smokeMax, p.fumee);
    this.skids = new SkidMarks(q.skidMax);
    this.scene.add(this.smoke.mesh, this.skids.mesh);
  }

  setQuality(level: QualityLevel): void {
    if (level === this.quality) return;
    this.quality = level;
    const q = QUALITY[level];
    this.init.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));
    this.sun.castShadow = q.shadows;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = q.fogFar * this.palette.brume * 0.3;
    fog.far = q.fogFar * this.palette.brume;
    if (this.snow) this.snow.points.visible = level === 'haute';
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
    this.chase.reset(this.target, { dist: 7, height: 2.8, lookAhead: 4, fovMin: 60, fovMax: 72 }, this.init.terrain);
  }

  resetEffects(): void {
    this.skids.reset();
  }

  shake(impact: number): void {
    this.chase.addShake(impact);
  }

  update(pose: CarPose, car: CarState, dt: number, cfg: ChaseConfig): void {
    this.carView.update(pose);
    this.carView.rearWheels(this.rear);
    const sliding = car.rearSlip > 0.05 && car.speed > 1;
    if (sliding) this.smoke.emit(this.rear, car.rearSlip * 35, dt, car.vx, car.vz);
    this.smoke.update(dt);
    const marking = car.rearSlip > 0.35 && car.speed > 3;
    this.skids.add(0, this.rear[0], marking);
    this.skids.add(1, this.rear[1], marking);

    this.setTarget(car, pose.x, pose.y, pose.z);
    this.chase.update(this.target, cfg, dt, this.init.terrain);
    if (this.camLibre) {
      this.camera.position.set(...this.camLibre.pos);
      this.camera.lookAt(...this.camLibre.cible);
    }
    this.sky.position.copy(this.camera.position);
    this.eau?.update(dt);
    if (this.snow?.points.visible) this.snow.update(dt, this.camera.position);
    this.scintille?.update(dt);
    const params = CARS[this.init.carId];
    this.gauge.update(pose.x, pose.y, pose.z, params.width, gaugeRatio(car.speed, car.reverse, this.gaugeMax), this.camera, dt);

    const d = this.palette.sunDir;
    this.sun.position.set(pose.x + d[0] * 80, pose.y + d[1] * 80, pose.z + d[2] * 80);
    this.sun.target.position.set(pose.x, pose.y, pose.z);

    const maxD = QUALITY[this.quality].fogFar + 150;
    const cx = this.camera.position.x, cz = this.camera.position.z;
    for (const chunk of this.terrainGroup.children) {
      const c = chunk.userData.center as THREE.Vector3;
      chunk.visible = this.camLibre !== null || (c.x - cx) * (c.x - cx) + (c.z - cz) * (c.z - cz) < maxD * maxD;
    }
  }

  render(): void {
    this.init.renderer.render(this.scene, this.camera);
  }

  /** Libère ce que ce monde a créé (les modèles partagés de `assets` ne sont pas libérés). */
  dispose(): void {
    const shared = new Set<THREE.BufferGeometry>([...Object.values(this.init.assets.decor), ...Object.values(this.decor)]);
    for (const m of Object.values(this.init.assets.cars)) {
      shared.add(m.body);
      for (const w of m.wheels) shared.add(w.geometry);
    }
    this.carView.dispose();
    this.gauge.dispose();
    this.smoke.dispose();
    this.skids.dispose();
    this.snow?.dispose();
    this.sky.traverse((o) => { if ((o as THREE.Points).isPoints) (o as THREE.Points).geometry.dispose(); });
    this.eau?.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && !shared.has(mesh.geometry)) mesh.geometry.dispose();
    });
    for (const d of this.owned) d.dispose();
  }
}
