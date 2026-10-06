import * as THREE from 'three';
import type { CarId } from '../core/physics/types';
import type { SkinDef } from '../core/skins';
import type { FumeeStyle } from '../core/fumees';
import { mulberry32 } from '../core/math/rng';
import type { Assets } from './assets';
import { CarView } from './carView';
import { SmokeSystem, SkidMarks } from './effects';
import { contourDe, materiauxDecor } from './decor';
import { toonMaterial } from './materials';
import { paletteDe } from './palettes';
import { createSky } from './sky';
import { anneauReliefs } from './terrainMesh';

/**
 * Fond animé du menu principal : la voiture du joueur (couleur, livrée, fumée) enchaîne des drifts de droite à gauche
 * sur une ligne droite sans fin, au coucher de soleil. La route, l'herbe et le décor se recyclent devant la voiture ;
 * rien n'est simulé (trajectoire sinusoïdale), la scène est légère pour tourner aussi sur téléphone.
 */

/** Vitesse d'avance (m/s), amplitude du balancement (m), durée d'un aller-retour (s), angle de dérive maximal (rad). */
const VITESSE = 19, AMPLITUDE = 3.2, PERIODE = 4.2, DERIVE = 0.62;
/** Demi-largeur de la route (m) et longueur d'un motif de texture (m) : la route se recale par multiples du motif. */
const DEMI_ROUTE = 5.5, MOTIF = 12, LONG_ROUTE = 480;
/** Objets de bord de route : un emplacement tous les `PAS_DECOR` m de chaque côté, recyclés devant la voiture. */
const PAS_DECOR = 9, N_DECOR = 44;

function textureRoute(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 256;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#4a4552';
  ctx.fillRect(0, 0, 128, 256);
  // grain de l'asphalte
  const rng = mulberry32(5);
  for (let k = 0; k < 900; k++) {
    const v = 60 + Math.floor(rng() * 40);
    ctx.fillStyle = `rgb(${v},${v - 4},${v + 8})`;
    ctx.fillRect(Math.floor(rng() * 128), Math.floor(rng() * 256), 1, 1);
  }
  // lignes de rive continues, axe en tirets (un tiret par motif)
  ctx.fillStyle = '#f6eedc';
  ctx.fillRect(5, 0, 4, 256);
  ctx.fillRect(119, 0, 4, 256);
  ctx.fillRect(62, 0, 4, 120);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function textureVibreur(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 8; cv.height = 64;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#d63a2c'; ctx.fillRect(0, 0, 8, 32);
  ctx.fillStyle = '#f4f1e8'; ctx.fillRect(0, 32, 8, 32);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Bande au sol le long de z (de 0 à `longueur`), centrée en x, texture répétée tous les `motif` m. */
function bande(largeur: number, longueur: number, motif: number, x: number, y: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.PlaneGeometry(largeur, longueur).rotateX(-Math.PI / 2).translate(x, y, longueur / 2);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (longueur / motif));
  return new THREE.Mesh(g, mat);
}

export interface OptionsFondMenu {
  voiture: CarId;
  couleur: string;
  skin: SkinDef | null;
  fumee: FumeeStyle | null;
  /** l'écran d'accueil : dès qu'il quitte la page, le fond s'arrête de lui-même (sans dessiner une image de trop) */
  ecran: HTMLElement;
  /** qualité basse : moins de pixels et de fumée */
  basse: boolean;
}

export class FondMenu {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2500);
  private readonly sol = new THREE.Group();
  private readonly ciel: THREE.Mesh;
  private readonly reliefs: THREE.Mesh;
  private readonly soleil: THREE.DirectionalLight;
  private readonly decor: THREE.Object3D[] = [];
  private readonly ombre: THREE.Mesh;
  private readonly roues = [new THREE.Vector3(), new THREE.Vector3()];
  private vue: CarView | null = null;
  private vueCle = '';
  private fumee: SmokeSystem | null = null;
  private fumeeCle = '';
  private traces: SkidMarks;
  private opts: OptionsFondMenu | null = null;
  private raf = 0;
  private dernier = 0;
  private t = 0;
  private z = 0;
  private spin = 0;
  private enMarche = false;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly assets: Assets) {
    const p = paletteDe('montagne', 'coucher');
    this.scene.background = new THREE.Color(p.fog);
    this.scene.fog = new THREE.Fog(p.fog, 60, 330);
    this.scene.add(new THREE.HemisphereLight(p.hemiSky, p.hemiGround, p.hemiIntensity));
    this.soleil = new THREE.DirectionalLight(p.sun, p.sunIntensity);
    this.scene.add(this.soleil, this.soleil.target);
    this.ciel = createSky(p);
    this.reliefs = anneauReliefs(p, 7, 0, 0, 760, -2);
    this.scene.add(this.ciel, this.reliefs);

    // sol : herbe, accotements, vibreurs, route (un seul groupe recalé par multiples du motif)
    const herbe = new THREE.Mesh(new THREE.PlaneGeometry(1400, LONG_ROUTE + 400).rotateX(-Math.PI / 2).translate(0, -0.05, LONG_ROUTE / 2), toonMaterial({ color: p.grassA }));
    const accotement = toonMaterial({ color: 0x8a7a68 });
    const vib = toonMaterial({ map: textureVibreur() });
    this.sol.add(
      herbe,
      bande(3, LONG_ROUTE, MOTIF, -(DEMI_ROUTE + 1.5), -0.03, accotement), bande(3, LONG_ROUTE, MOTIF, DEMI_ROUTE + 1.5, -0.03, accotement),
      bande(0.9, LONG_ROUTE, 2, -(DEMI_ROUTE + 0.45), 0.0, vib), bande(0.9, LONG_ROUTE, 2, DEMI_ROUTE + 0.45, 0.0, vib),
      bande(DEMI_ROUTE * 2, LONG_ROUTE, MOTIF, 0, 0.01, toonMaterial({ map: textureRoute() })),
    );
    this.scene.add(this.sol);

    // ombre ronde sous la voiture
    this.ombre = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }));
    this.scene.add(this.ombre);

    // décor : sapins, feuillus, rochers et bornes (modèles du jeu, avec leur contour)
    const { mat, outline } = materiauxDecor();
    const rng = mulberry32(11);
    const modeles = ['sapin0', 'sapin1', 'sapin2', 'feuillu0', 'feuillu1', 'feuillu2', 'sapin0', 'rocher0'].filter((k) => this.assets.decor[k]);
    for (let i = 0; i < N_DECOR * 2; i++) {
      const cle = modeles[Math.floor(rng() * modeles.length)];
      const geo = this.assets.decor[cle];
      const g = new THREE.Group();
      g.add(new THREE.Mesh(geo, mat), new THREE.Mesh(contourDe(geo), outline));
      const cote = i % 2 === 0 ? 1 : -1;
      g.userData = { cote, ecart: DEMI_ROUTE + 6 + rng() * 22, k: Math.floor(i / 2), echelle: 0.8 + rng() * 0.6, rot: rng() * Math.PI * 2 };
      this.decor.push(g);
      this.scene.add(g);
    }
    if (this.assets.decor.borne0) {
      for (let i = 0; i < 40; i++) {
        const g = new THREE.Group();
        g.add(new THREE.Mesh(this.assets.decor.borne0, mat), new THREE.Mesh(contourDe(this.assets.decor.borne0), outline));
        g.userData = { cote: i % 2 === 0 ? 1 : -1, ecart: DEMI_ROUTE + 1.7, k: Math.floor(i / 2), echelle: 1, rot: 0, pas: 25 };
        this.decor.push(g);
        this.scene.add(g);
      }
    }
    this.traces = new SkidMarks(500);
    this.scene.add(this.traces.mesh);
  }

  /** Lance le fond (ou change de voiture, couleur, livrée, fumée sans repartir de zéro). */
  demarrer(o: OptionsFondMenu): void {
    this.opts = o;
    const cle = `${o.voiture}|${o.couleur}|${o.skin ? JSON.stringify(o.skin) : ''}`;
    if (cle !== this.vueCle) {
      if (this.vue) { this.scene.remove(this.vue.root); this.vue.dispose(); }
      this.vue = new CarView(this.assets.cars[o.voiture], o.couleur, false, o.skin);
      this.scene.add(this.vue.root);
      this.vueCle = cle;
    }
    const fc = `${o.basse}|${o.fumee ? JSON.stringify(o.fumee) : ''}`;
    if (fc !== this.fumeeCle) {
      if (this.fumee) { this.scene.remove(this.fumee.mesh, this.fumee.sparks); this.fumee.dispose(); }
      this.fumee = new SmokeSystem(o.basse ? 70 : 160, 0xe9e2dc, o.fumee, o.basse ? 30 : 90);
      this.scene.add(this.fumee.mesh, this.fumee.sparks);
      this.fumeeCle = fc;
    }
    if (this.enMarche) return;
    this.enMarche = true;
    this.dernier = performance.now();
    this.raf = requestAnimationFrame(this.image);
  }

  arreter(): void {
    this.enMarche = false;
    cancelAnimationFrame(this.raf);
  }

  get actif(): boolean {
    return this.enMarche;
  }

  private readonly image = (now: number): void => {
    if (!this.enMarche) return;
    const o = this.opts;
    // l'accueil a été remplacé par un autre écran : on s'arrête sans dessiner
    if (!o || !o.ecran.isConnected) { this.arreter(); return; }
    this.raf = requestAnimationFrame(this.image);
    const dt = Math.min(0.05, (now - this.dernier) / 1000);
    this.dernier = now;
    this.avancer(dt);
    this.dessiner(o);
  };

  private avancer(dt: number): void {
    const vue = this.vue;
    if (!vue) return;
    this.t += dt;
    this.z += VITESSE * dt;
    const w = (Math.PI * 2) / PERIODE;
    const x = AMPLITUDE * Math.sin(w * this.t), vx = AMPLITUDE * w * Math.cos(w * this.t);
    // cap = direction de la vitesse + dérive : le nez part vers l'intérieur du virage (vers −x quand x > 0)
    const derive = -DERIVE * Math.sin(w * this.t);
    const cap = Math.atan2(vx, VITESSE) + derive;
    this.spin += (VITESSE * dt) / 0.33;
    vue.update({
      x, y: 0, z: this.z, heading: cap, steer: Math.max(-0.5, Math.min(0.5, -derive * 0.8)), wheelSpin: this.spin,
      groundPitch: 0, groundRoll: 0, pitch: -0.012, roll: 0.05 * Math.sin(w * this.t),
    });
    this.ombre.position.set(x, 0.03, this.z);
    this.ombre.scale.set(1.3, 1, 2.5);
    this.ombre.rotation.y = cap;
    // fumée et traces tant que la dérive est franche (relâchée au passage d'un côté à l'autre)
    vue.rearWheels(this.roues);
    const glisse = Math.abs(derive) / DERIVE;
    if (this.fumee) {
      if (glisse > 0.3) this.fumee.emit(this.roues, glisse * 32, dt, vx, VITESSE);
      this.fumee.update(dt);
    }
    this.traces.add(0, this.roues[0], glisse > 0.45);
    this.traces.add(1, this.roues[1], glisse > 0.45);
  }

  private dessiner(o: OptionsFondMenu): void {
    const r = this.renderer, wpx = window.innerWidth, hpx = window.innerHeight;
    r.setPixelRatio(Math.min(window.devicePixelRatio, o.basse ? 1 : 2));
    r.setSize(wpx, hpx, false);
    // derrière la voiture, un peu en hauteur, sans suivre le balancement : elle passe d'un côté à l'autre de la route
    const cam = this.camera;
    cam.aspect = wpx / Math.max(1, hpx);
    cam.fov = cam.aspect < 1.2 ? 66 : 55;
    cam.position.set(0, 3.1, this.z - 9.5);
    cam.lookAt(0, 1.5, this.z + 9);
    // la route est décalée vers la droite de l'écran : le menu est à gauche
    cam.setViewOffset(wpx, hpx, -wpx * (cam.aspect < 1.2 ? 0.12 : 0.19), 0, wpx, hpx);
    cam.updateProjectionMatrix();
    // route, ciel, reliefs et soleil suivent la voiture (recalage par multiples du motif : la texture ne saute pas)
    this.sol.position.z = Math.floor((this.z - 60) / MOTIF) * MOTIF;
    this.ciel.position.copy(cam.position);
    this.reliefs.position.z = this.z;
    this.soleil.position.set(-50, 30, this.z + 40);
    this.soleil.target.position.set(0, 0, this.z);
    for (const g of this.decor) {
      const u = g.userData as { cote: number; ecart: number; k: number; echelle: number; rot: number; pas?: number };
      const pas = u.pas ?? PAS_DECOR, n = u.pas ? 20 : N_DECOR;
      // emplacement k + n·j le plus proche devant la caméra
      const debut = this.z - 15;
      const j = Math.ceil((debut - u.k * pas) / (n * pas));
      g.position.set(u.cote * u.ecart, -0.2, u.k * pas + j * n * pas);
      g.rotation.y = u.rot;
      g.scale.setScalar(u.echelle);
    }
    r.render(this.scene, cam);
  }

  dispose(): void {
    this.arreter();
    this.vue?.dispose();
    this.fumee?.dispose();
    this.traces.dispose();
  }
}
