import * as THREE from 'three';
import { loadAssets, type Assets } from './render/assets';
import { QualityManager } from './render/quality';
import { Showroom } from './render/showroom';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { Store, safeStorage, type Reglages } from './storage/store';
import { Hud } from './game/hud';
import { GameSession, type DebugHook } from './game/session';
import { prepareLevel, type PreparedLevel } from './game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { Screens, levelSummary } from './ui/screens';
import { formatDistance } from './ui/format';
import type { RaceResult } from './core/race/race';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class App {
  private renderer!: THREE.WebGLRenderer;
  private store!: Store;
  private persistent = true;
  private reglages!: Reglages;
  private assets: Assets | null = null;
  private readonly screens = new Screens($('ui'));
  private readonly hud = new Hud($('hud'));
  private readonly audio = new AudioEngine();
  private readonly keyboard = new KeyboardInput();
  private readonly touchControls = new TouchControls($('touch'));
  private readonly input = new InputManager(this.keyboard, this.touchControls);
  private readonly touch = matchMedia('(pointer: coarse)').matches;
  private session: GameSession | null = null;
  private showroom: Showroom | null = null;
  private current: { index: number; prepared: PreparedLevel } | null = null;
  private onEscape: (() => void) | null = null;

  constructor(private readonly debug: DebugHook | null = null) {}

  async start(): Promise<void> {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: $('scene') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.screens.error('WebGL indisponible', "Ton navigateur ou ta carte graphique ne permet pas d'afficher la 3D. Essaie avec un navigateur recent (Chrome, Firefox, Edge ou Safari).", []);
      return;
    }
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    const s = safeStorage();
    this.store = new Store(s.kv);
    this.persistent = s.persistent;
    this.reglages = this.store.loadReglages(this.touch);
    this.audio.setVolume(this.reglages.volume);
    this.audio.setMuted(this.reglages.muet);
    this.keyboard.attach(window);

    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.onEscape) { const f = this.onEscape; this.onEscape = null; f(); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.session) this.pauseRace(); });
    $('app').append(Object.assign(document.createElement('div'), { className: 'portrait', textContent: 'Tourne ton telephone en mode paysage' }));

    await this.chargerModeles();
  }

  private async chargerModeles(): Promise<void> {
    this.screens.loading('Chargement des modeles...');
    try {
      this.assets = await loadAssets(import.meta.env.BASE_URL + 'models/', (p) => this.screens.setProgress(p));
      this.showroom = new Showroom(this.renderer, this.assets);
      this.accueil();
    } catch {
      this.screens.error('Chargement impossible', "Les modeles 3D n'ont pas pu etre charges. Verifie ta connexion.", [
        { label: 'Reessayer', onClick: () => void this.chargerModeles() },
      ]);
    }
  }

  private save(): void {
    this.store.saveReglages(this.reglages);
  }

  private accueil(): void {
    this.showroom?.stop();
    this.screens.accueil({
      persistent: this.persistent,
      onJouer: () => this.niveaux(),
      onGarage: () => this.garage(() => this.accueil()),
      onEditeur: () => this.screens.toast("L'editeur arrive bientot !"),
      onReglages: () => this.reglagesEcran(() => this.accueil()),
    });
  }

  private niveaux(): void {
    this.showroom?.stop();
    const cartes = NIVEAUX_OFFICIELS.map((n) => {
      const s = levelSummary(n.data);
      return {
        nom: s?.nom ?? n.id,
        detail: s ? `${formatDistance(s.longueur)} · ${s.ambiance === 'jour' ? 'Jour' : 'Coucher de soleil'}` : '',
        record: this.store.getRecord(cleNiveauOfficiel(n.id), this.reglages.mode),
      };
    });
    this.screens.niveaux({
      cartes, mode: this.reglages.mode, voiture: this.reglages.voiture,
      onChoisir: (i) => void this.lancer(i),
      onGarage: () => this.garage(() => this.niveaux()),
      onReglages: () => this.reglagesEcran(() => this.niveaux()),
      onRetour: () => this.accueil(),
    });
  }

  private garage(retour: () => void): void {
    if (this.showroom) {
      this.showroom.setCar(this.reglages.voiture, this.reglages.couleur);
      this.showroom.start();
    }
    this.screens.garage({
      voiture: this.reglages.voiture,
      couleur: this.reglages.couleur,
      onChange: (voiture, couleur) => {
        this.reglages.voiture = voiture;
        this.reglages.couleur = couleur;
        this.save();
        this.showroom?.setCar(voiture, couleur);
      },
      onRetour: () => { this.showroom?.stop(); retour(); },
    });
  }

  private reglagesEcran(retour: () => void): void {
    this.screens.reglages({
      reglages: this.reglages,
      touch: this.touch,
      onChange: (r) => {
        this.reglages = r;
        this.audio.setVolume(r.volume);
        this.audio.setMuted(r.muet);
        this.save();
      },
      onRetour: retour,
    });
  }

  private async lancer(index: number): Promise<void> {
    if (!this.assets) return;
    this.showroom?.stop();
    this.screens.loading('Preparation du niveau...');
    await new Promise((r) => setTimeout(r, 30));
    const n = NIVEAUX_OFFICIELS[index];
    const res = prepareLevel(cleNiveauOfficiel(n.id), n.data);
    if (!res.ok) {
      this.screens.error('Niveau invalide', res.erreurs.join('\n'), [{ label: 'Retour', onClick: () => this.niveaux() }]);
      return;
    }
    this.session?.dispose();
    this.current = { index, prepared: res.prepared };
    this.session = new GameSession(res.prepared, {
      renderer: this.renderer, assets: this.assets, hud: this.hud, audio: this.audio, input: this.input,
      quality: new QualityManager(this.reglages.qualite, this.touch), reglages: this.reglages, debug: this.debug,
    }, {
      onFinish: (r) => this.arrivee(r),
      onPause: () => this.pauseRace(),
    });
    this.screens.clear();
    this.keyboard.capture = true;
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session.start();
  }

  private reprendre(): void {
    this.screens.clear();
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session?.resume();
  }

  private pauseRace(): void {
    if (!this.session) return;
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    this.onEscape = () => this.reprendre();
    this.screens.pause({
      onReprendre: () => { this.onEscape = null; this.reprendre(); },
      onRecommencer: () => { this.onEscape = null; this.screens.clear(); this.touchControls.show(this.touch || this.input.touchActive); this.session?.restart(); },
      onMenu: () => { this.onEscape = null; this.quitterCourse(); },
    });
  }

  private arrivee(r: RaceResult): void {
    const cur = this.current;
    if (!cur || !this.session) return;
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    const record = this.store.submitRecord(cur.prepared.key, this.reglages.mode, {
      score: r.score, temps: r.time, voiture: this.reglages.voiture, meilleurDrift: r.bestDrift, date: new Date().toISOString().slice(0, 10),
    });
    const next = cur.index + 1 < NIVEAUX_OFFICIELS.length ? cur.index + 1 : -1;
    this.screens.resultats({
      result: r, record, persistent: this.persistent,
      onRecommencer: () => { this.screens.clear(); this.touchControls.show(this.touch || this.input.touchActive); this.session?.restart(); },
      onSuivant: next >= 0 ? () => void this.lancer(next) : null,
      onMenu: () => this.quitterCourse(),
    });
  }

  private quitterCourse(): void {
    this.session?.dispose();
    this.session = null;
    this.keyboard.capture = false;
    this.touchControls.show(false);
    this.niveaux();
  }
}
