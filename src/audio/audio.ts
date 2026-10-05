/**
 * Moteur audio du jeu (Web Audio, tout est synthétisé, aucun fichier). Le moteur des voitures est un modèle physique
 * qui tourne dans un AudioWorklet (`moteurPhysique.ts`), avec repli sur la voix synthétique d'origine.
 * Les fabriques de voix (`voices.ts`, `shots.ts`) et le bus (`bus.ts`) fonctionnent aussi sur un OfflineAudioContext :
 * c'est ainsi que `tools/audio-preview` rend des WAV pour vérification sans écouter dans un navigateur.
 */
import { clamp } from '../core/math/vec';
import type { CarId } from '../core/physics/types';
import type { Rarete } from '../core/raretes';
import { createBus, createEnv, peutJouer, type Bus, type Env } from './bus';
import { volumeToGain } from './params';
import * as sons from './shots';
import { AmbianceVoice, EngineVoice, TyreVoice } from './voices';
import { chargerMoteurPhysique, creerNoeudMoteur } from './moteurPhysique';

export { engineFrequency, screechGain } from './params';

/** Informations facultatives de la voiture pour le son (rapport engagé, contact avec la piste). */
export interface EngineExtra { gear?: number; onRoad?: boolean }

export interface AudioOptions {
  /** contexte imposé (rendu hors ligne) : sinon un AudioContext est créé au premier geste de l'utilisateur */
  context?: BaseAudioContext;
  /** faux : voix synthétique d'origine même si l'AudioWorklet est disponible (comparaisons dans tools/audio-preview) */
  physique?: boolean;
}

/** Vrai pour un AudioContext temps réel, faux pour un rendu hors ligne. */
function estLive(ctx: BaseAudioContext): ctx is AudioContext {
  return !('startRendering' in ctx);
}

export class AudioEngine {
  private ctx: BaseAudioContext | null = null;
  private bus: Bus | null = null;
  private env: Env | null = null;
  private moteur: EngineVoice | null = null;
  private pneus: TyreVoice | null = null;
  private ambiance: AmbianceVoice | null = null;
  private voiture: CarId = 'equilibree';
  private veutMoteur = false;
  private volume = 0.8;
  private muted = false;
  private dernierT = -1;
  private dernierChoc = -10;
  private dernierTic = -10;
  private cache = false;
  /** moteur physique (AudioWorklet) prêt pour ce contexte ; sinon voix synthétique d'origine */
  private physiqueOk = false;
  /** promesse du chargement du module (attendue par le rendu hors ligne) */
  physiquePret: Promise<boolean> = Promise.resolve(false);

  private readonly physiqueVoulu: boolean;

  constructor(opts: AudioOptions = {}) {
    this.physiqueVoulu = opts.physique ?? true;
    if (opts.context) this.creer(opts.context);
  }

  /** A appeler lors d'un geste de l'utilisateur (exigence des navigateurs). */
  unlock(): void {
    if (this.ctx) {
      if (estLive(this.ctx) && this.ctx.state === 'suspended' && !this.cache) void this.ctx.resume();
      return;
    }
    if (typeof window === 'undefined') return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      this.creer(new AC());
      document.addEventListener('visibilitychange', this.onVisibilite);
    } catch {
      this.ctx = null; this.bus = null; this.env = null;
    }
  }

  private creer(ctx: BaseAudioContext): void {
    this.ctx = ctx;
    this.bus = createBus(ctx);
    this.env = createEnv(ctx);
    this.bus.volume.gain.value = this.muted ? 0 : volumeToGain(this.volume);
    this.physiquePret = (this.physiqueVoulu ? chargerMoteurPhysique(ctx) : Promise.resolve(false)).catch(() => false).then((ok) => {
      if (this.ctx !== ctx) return ok;
      this.physiqueOk = ok;
      // une course a déjà démarré avec la voix synthétique : on passe au moteur physique
      if (ok && this.moteur && this.veutMoteur && this.env) {
        this.moteur.stop(ctx.currentTime);
        this.moteur = this.creerVoixMoteur(this.env, this.bus!.drive, this.voiture);
      }
      return ok;
    });
    if (this.veutMoteur) this.startEngine(this.voiture);
  }

  private creerVoixMoteur(env: Env, out: AudioNode, car: CarId): EngineVoice {
    const noeud = this.physiqueOk ? creerNoeudMoteur(env.ctx, car) : null;
    return new EngineVoice(env, out, car, noeud);
  }

  /** Onglet caché : fondu puis suspension du contexte ; retour : reprise. */
  private readonly onVisibilite = (): void => {
    const ctx = this.ctx, bus = this.bus;
    if (!ctx || !bus || !estLive(ctx)) return;
    this.cache = document.hidden;
    if (document.hidden) {
      bus.pause.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      window.setTimeout(() => { if (this.cache && ctx.state === 'running') void ctx.suspend(); }, 150);
    } else {
      void ctx.resume();
      bus.pause.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    }
  };

  private appliquerVolume(): void {
    if (this.bus && this.ctx) this.bus.volume.gain.setTargetAtTime(this.muted ? 0 : volumeToGain(this.volume), this.ctx.currentTime, 0.02);
  }

  setVolume(v: number): void { this.volume = clamp(v, 0, 1); this.appliquerVolume(); }
  setMuted(m: boolean): void { this.muted = m; this.appliquerVolume(); }
  toggleMute(): boolean { this.setMuted(!this.muted); return this.muted; }

  /** Lance les voix continues (moteur de la voiture, pneus, ambiance). Sans contexte prêt, démarre au premier geste. */
  startEngine(car: CarId = this.voiture): void {
    this.voiture = car;
    this.veutMoteur = true;
    const bus = this.bus, env = this.env;
    if (!bus || !env) return;
    if (this.moteur) return;
    this.moteur = this.creerVoixMoteur(env, bus.drive, car);
    this.pneus ??= new TyreVoice(env, bus.drive);
    this.ambiance ??= new AmbianceVoice(env, bus.drive);
    this.dernierT = -1;
  }

  /** Fondu de sortie et libération de toutes les voix continues (pause, fin de course). */
  stopEngine(): void {
    this.veutMoteur = false;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.moteur?.stop(t); this.pneus?.stop(t); this.ambiance?.stop(t);
    this.moteur = this.pneus = null; this.ambiance = null;
  }

  updateEngine(rpm: number, throttle: number, slip: number, speed: number, extra: EngineExtra = {}): void {
    const ctx = this.ctx;
    if (!ctx || !this.moteur || !this.pneus || !this.ambiance) return;
    const t = ctx.currentTime;
    const dt = this.dernierT < 0 ? 1 / 60 : clamp(t - this.dernierT, 0, 0.1);
    this.dernierT = t;
    this.moteur.update(t, dt, rpm, throttle, extra.gear ?? 1);
    this.pneus.update(t, dt, slip, speed);
    this.ambiance.update(t, dt, extra.onRoad ?? true, speed);
  }

  /** Planifie un son ponctuel (plafonné : les surplus sont ignorés, sauf priorité). */
  private jouer(fn: (env: Env, out: AudioNode, t: number) => void, bus: 'sfx' | 'ui', priorite = false): void {
    const ctx = this.ctx, b = this.bus, env = this.env;
    if (!ctx || !b || !env || !peutJouer(env, priorite)) return;
    fn(env, b[bus], ctx.currentTime + 0.005);
  }

  playBank(multiplier: number): void { this.jouer((e, o, t) => sons.ding(e, o, t, multiplier), 'sfx', true); }
  playLose(): void { this.jouer((e, o, t) => sons.perdu(e, o, t), 'sfx', true); }

  playCrash(impact: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // un contact prolongé émet un choc à chaque pas : on espace les sons
    if (ctx.currentTime - this.dernierChoc < 0.12) return;
    this.dernierChoc = ctx.currentTime;
    this.jouer((e, o, t) => sons.choc(e, o, t, impact), 'sfx', true);
  }

  playScrape(intensite = 0.5): void { this.jouer((e, o, t) => sons.frottement(e, o, t, clamp(intensite, 0, 1)), 'sfx'); }
  playCountdown(n: number): void { this.jouer((e, o, t) => sons.decompte(e, o, t, n), 'sfx', true); }
  playFinish(): void { this.jouer((e, o, t) => sons.arrivee(e, o, t), 'sfx', true); }
  playClick(): void { this.jouer((e, o, t) => sons.clic(e, o, t), 'ui'); }

  /** Tic de la roulette quand une carte passe sous le repère ; `k` ∈ [0, 1] fait varier légèrement la hauteur. */
  playTick(k = 0.5): void {
    const ctx = this.ctx;
    if (!ctx || ctx.currentTime - this.dernierTic < 0.02) return;
    this.dernierTic = ctx.currentTime;
    this.jouer((e, o, t) => sons.tic(e, o, t, k), 'ui');
  }

  /** Coup sourd de l'ouverture de la caisse. */
  playOuvrirCaisse(): void { this.jouer((e, o, t) => sons.ouverture(e, o, t), 'ui', true); }

  /** Révélation : plus la rareté est haute, plus la fanfare est longue et scintillante. */
  playReveal(r: Rarete): void { this.jouer((e, o, t) => sons.revelation(e, o, t, r), 'ui', true); }
}
