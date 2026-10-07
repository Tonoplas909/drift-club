import type { CamLibre } from '../debug/camLibre';
import { h } from '../ui/screens';
import { enregistrerImage } from '../ui/partageImage';
import { FILTRES_PHOTO, appliquerFiltre, nomPhoto, type FiltrePhoto } from '../ui/photoFiltres';

/** Ce que la course en pause donne au mode photo. */
export interface ScenePhoto {
  voiture: { x: number; y: number; z: number };
  /** caméra de poursuite au moment de la pause (point de départ de la caméra photo) */
  camera: { x: number; y: number; z: number };
  /** hauteur du sol (la caméra ne passe pas dessous) */
  sol(x: number, z: number): number;
}

export interface Orbite { lacet: number; tangage: number; dist: number }

/** hauteur du point visé au-dessus de la voiture (m) */
const CIBLE_Y = 0.7;
export const DIST_MIN = 2.5;
export const DIST_MAX = 30;
const TANGAGE_MIN = -0.15;
const TANGAGE_MAX = 1.45;

const borne = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Orbite qui place la caméra là où est `cam` autour de la voiture. */
export function orbiteDepuis(s: ScenePhoto): Orbite {
  const dx = s.camera.x - s.voiture.x, dy = s.camera.y - (s.voiture.y + CIBLE_Y), dz = s.camera.z - s.voiture.z;
  const dist = borne(Math.hypot(dx, dy, dz), DIST_MIN, DIST_MAX);
  return { lacet: Math.atan2(dx, dz), tangage: borne(Math.asin(borne(dy / Math.max(1e-6, Math.hypot(dx, dy, dz)), -1, 1)), TANGAGE_MIN, TANGAGE_MAX), dist };
}

/** Position de la caméra pour une orbite (au moins 30 cm au-dessus du sol). */
export function camOrbite(s: ScenePhoto, o: Orbite): CamLibre {
  const cy = s.voiture.y + CIBLE_Y;
  const t = borne(o.tangage, TANGAGE_MIN, TANGAGE_MAX), d = borne(o.dist, DIST_MIN, DIST_MAX);
  const x = s.voiture.x + Math.sin(o.lacet) * Math.cos(t) * d;
  const z = s.voiture.z + Math.cos(o.lacet) * Math.cos(t) * d;
  const y = Math.max(cy + Math.sin(t) * d, s.sol(x, z) + 0.3);
  return { pos: [x, y, z], cible: [s.voiture.x, cy, s.voiture.z] };
}

export interface ModePhotoOptions {
  canvas: HTMLCanvasElement;
  scene: ScenePhoto;
  /** redessine la course avec cette caméra (null : caméra de poursuite) */
  rendre(cam: CamLibre | null): void;
  /** téléphone : on propose le partage plutôt que le téléchargement */
  partager: boolean;
  toast(msg: string): void;
  onQuitter(): void;
}

/** Tuile de grain (aperçu à l'écran du filtre « Grain »). */
function tuileGrain(): string {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return '';
  const img = g.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

/**
 * Mode photo (depuis la pause) : caméra libre autour de la voiture (glisser pour tourner, molette ou pincement pour
 * zoomer), HUD masqué, filtres, puis capture téléchargée ou partagée.
 */
export class ModePhoto {
  readonly el: HTMLElement;
  private orbite: Orbite;
  private filtre: FiltrePhoto = 'aucun';
  private readonly pointeurs = new Map<number, { x: number; y: number }>();
  private ecartPincement = 0;
  private enCapture = false;
  private readonly apercu: HTMLElement;

  constructor(private readonly o: ModePhotoOptions) {
    this.orbite = orbiteDepuis(o.scene);
    this.apercu = h('div', { class: 'photo-apercu' });
    const filtres = h('div', { class: 'seg' });
    const majFiltres = (): void => {
      filtres.replaceChildren(...FILTRES_PHOTO.map(([f, nom]) =>
        h('button', { class: 'tab' + (f === this.filtre ? ' on' : ''), onclick: () => { this.filtre = f; majFiltres(); this.majApercu(); } }, nom)));
    };
    majFiltres();
    const zone = h('div', { class: 'photo-zone' });
    this.el = h('div', { class: 'screen dim photo' },
      this.apercu,
      zone,
      h('p', { class: 'hint photo-aide' }, 'Glisse pour tourner autour de la voiture · molette ou pincement pour zoomer'),
      h('div', { class: 'photo-barre' },
        h('button', { class: 'btn sec', onclick: () => this.quitter() }, 'Retour'),
        filtres,
        h('button', { class: 'btn', onclick: () => void this.capturer() }, o.partager ? 'Prendre et partager' : 'Prendre la photo'),
      ),
    );
    zone.addEventListener('pointerdown', this.onDown);
    zone.addEventListener('pointermove', this.onMove);
    zone.addEventListener('pointerup', this.onUp);
    zone.addEventListener('pointercancel', this.onUp);
    zone.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('resize', this.onResize);
    this.dessiner();
  }

  private dessiner(): void {
    this.o.rendre(camOrbite(this.o.scene, this.orbite));
  }

  private majApercu(): void {
    this.o.canvas.classList.toggle('photo-nb', this.filtre === 'nb');
    this.apercu.className = 'photo-apercu' + (this.filtre === 'grain' || this.filtre === 'vignette' ? ' ' + this.filtre : '');
    if (this.filtre === 'grain' && !this.apercu.style.backgroundImage) this.apercu.style.backgroundImage = `url(${tuileGrain()})`;
  }

  private readonly onDown = (e: PointerEvent): void => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.ecartPincement = this.ecart();
  };

  private readonly onMove = (e: PointerEvent): void => {
    const p = this.pointeurs.get(e.pointerId);
    if (!p) return;
    if (this.pointeurs.size >= 2) {
      p.x = e.clientX; p.y = e.clientY;
      const d = this.ecart();
      if (this.ecartPincement > 0 && d > 0) this.orbite.dist = borne(this.orbite.dist * this.ecartPincement / d, DIST_MIN, DIST_MAX);
      this.ecartPincement = d;
    } else {
      this.orbite.lacet -= (e.clientX - p.x) * 0.008;
      this.orbite.tangage = borne(this.orbite.tangage + (e.clientY - p.y) * 0.006, TANGAGE_MIN, TANGAGE_MAX);
      p.x = e.clientX; p.y = e.clientY;
    }
    this.dessiner();
  };

  private readonly onUp = (e: PointerEvent): void => {
    this.pointeurs.delete(e.pointerId);
    this.ecartPincement = this.ecart();
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.orbite.dist = borne(this.orbite.dist * Math.exp(e.deltaY * 0.001), DIST_MIN, DIST_MAX);
    this.dessiner();
  };

  /** le redimensionnement efface l'image (la course est en pause) : on la redessine */
  private readonly onResize = (): void => this.dessiner();

  private ecart(): number {
    const [a, b] = [...this.pointeurs.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  /** Redessine puis copie l'image tout de suite (le tampon WebGL n'est lisible que juste après le rendu). */
  private async capturer(): Promise<void> {
    if (this.enCapture) return;
    this.enCapture = true;
    try {
      this.dessiner();
      const src = this.o.canvas;
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      if (!g) throw new Error('canvas 2D indisponible');
      g.drawImage(src, 0, 0);
      if (this.filtre !== 'aucun') {
        const img = g.getImageData(0, 0, c.width, c.height);
        appliquerFiltre(img.data, c.width, c.height, this.filtre, Math.random);
        g.putImageData(img, 0, 0);
      }
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
      if (!blob) throw new Error('capture vide');
      await this.enregistrer(blob, nomPhoto(new Date()));
    } catch {
      this.o.toast('La photo n\'a pas pu être prise');
    } finally {
      this.enCapture = false;
    }
  }

  private async enregistrer(blob: Blob, nom: string): Promise<void> {
    const msg = await enregistrerImage(blob, nom, this.o.partager);
    if (msg) this.o.toast('Photo enregistrée');
  }

  quitter(): void {
    window.removeEventListener('resize', this.onResize);
    this.o.canvas.classList.remove('photo-nb');
    this.o.rendre(null);
    this.o.onQuitter();
  }
}
