import * as THREE from 'three';
import type { Level } from '../core/level/types';
import type { TrackData } from '../core/track/buildTrack';
import type { Terrain } from '../core/track/terrain';
import type { Environment } from '../core/env/types';
import type { CarId, CarState } from '../core/physics/types';
import type { Assets } from './assets';
import { PALETTES, type Palette } from './palettes';
import { QUALITY, type QualityLevel } from './quality';
import { createSky } from './sky';
import { buildRoad, createRoadTextures } from './road';
import { buildTerrain, buildMountains } from './terrainMesh';
import { buildDecor } from './decor';
import { CarView, type CarPose } from './carView';
import { SmokeSystem, SkidMarks } from './effects';
import { ChaseCamera, type ChaseConfig, type CameraTarget } from './camera';
import { SpeedGauge, gaugeRatio } from './speedGauge';
import { CARS } from '../core/physics/cars';

export interface WorldInit {
  renderer: THREE.WebGLRenderer;
  level: Level;
  track: TrackData;
  terrain: Terrain;
  env: Environment;
  assets: Assets;
  carId: CarId;
  color: string;
  quality: QualityLevel;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
  private readonly chase = new ChaseCamera(this.camera);
  private readonly palette: Palette;
  private readonly sun: THREE.DirectionalLight;
  private readonly sky: THREE.Mesh;
  private readonly terrainGroup: THREE.Group;
  private readonly carView: CarView;
  private readonly gauge = new SpeedGauge();
  private smoke: SmokeSystem;
  private skids: SkidMarks;
  private quality: QualityLevel;
  private readonly rear = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly target: CameraTarget = { x: 0, y: 0, z: 0, heading: 0, vx: 0, vz: 0, speed: 0 };
  private readonly owned: { dispose(): void }[] = [];

  constructor(private readonly init: WorldInit) {
    const { renderer, level, track, terrain, env, assets, quality } = init;
    this.quality = quality;
    const q = QUALITY[quality];
    const p = (this.palette = PALETTES[level.ambiance]);

    renderer.shadowMap.enabled = q.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.maxPixelRatio));

    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, q.fogFar * 0.3, q.fogFar);

    this.scene.add(new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity));
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

    const tex = createRoadTextures(p, renderer.capabilities.getMaxAnisotropy());
    this.owned.push(tex.road, tex.curb, tex.checker);
    this.scene.add(buildRoad(track, p, tex));
    this.terrainGroup = buildTerrain(level, track, terrain, p, quality);
    this.scene.add(this.terrainGroup);
    this.scene.add(buildMountains(track, p, level.decor.graine));
    this.scene.add(buildDecor(env, assets, quality, q.shadows));

    this.carView = new CarView(assets.cars[init.carId], init.color, q.shadows);
    this.scene.add(this.carView.root, this.gauge.root);
    this.smoke = new SmokeSystem(q.smokeMax, 0xe9e6e1);
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
    fog.near = q.fogFar * 0.3;
    fog.far = q.fogFar;
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
    this.sky.position.copy(this.camera.position);
    const params = CARS[this.init.carId];
    this.gauge.update(pose.x, pose.y, pose.z, params.width, gaugeRatio(car.speed, car.reverse, params.maxSpeed), this.camera, dt);

    const d = this.palette.sunDir;
    this.sun.position.set(pose.x + d[0] * 80, pose.y + d[1] * 80, pose.z + d[2] * 80);
    this.sun.target.position.set(pose.x, pose.y, pose.z);

    const maxD = QUALITY[this.quality].fogFar + 150;
    const cx = this.camera.position.x, cz = this.camera.position.z;
    for (const chunk of this.terrainGroup.children) {
      const c = chunk.userData.center as THREE.Vector3;
      chunk.visible = (c.x - cx) * (c.x - cx) + (c.z - cz) * (c.z - cz) < maxD * maxD;
    }
  }

  render(): void {
    this.init.renderer.render(this.scene, this.camera);
  }

  /** Libère ce que ce monde a créé (les modèles partagés de `assets` ne sont pas libérés). */
  dispose(): void {
    const shared = new Set<THREE.BufferGeometry>(Object.values(this.init.assets.decor));
    for (const m of Object.values(this.init.assets.cars)) {
      shared.add(m.body);
      for (const w of m.wheels) shared.add(w.geometry);
    }
    this.carView.dispose();
    this.gauge.dispose();
    this.smoke.dispose();
    this.skids.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry && !shared.has(mesh.geometry)) mesh.geometry.dispose();
    });
    for (const d of this.owned) d.dispose();
  }
}
