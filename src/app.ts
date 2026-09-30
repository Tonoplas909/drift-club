import * as THREE from 'three';
import { loadAssets, type Assets } from './render/assets';
import { QualityManager } from './render/quality';
import { Showroom } from './render/showroom';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { Store, safeStorage, cleNiveauPerso, type Reglages, type MonNiveau, type RecordEntry } from './storage/store';
import { Hud } from './game/hud';
import { GameSession, type DebugHook } from './game/session';
import { prepareLevel, type PreparedLevel } from './game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { Screens, levelSummary, type NiveauCarte } from './ui/screens';
import { formatDistance } from './ui/format';
import type { RaceResult } from './core/race/race';
import type { Level } from './core/level/types';
import { empreinteNiveau } from './core/level/fingerprint';
import { analyseLevel } from './core/editor/analyse';
import { Editeur } from './editor/editor';
import { afficherHub } from './editor/hub';
import { dateCourte, longueurRoute } from './editor/format';
import { clientParDefaut } from './online/client';
import { CompteService, type EtatCompte } from './online/compte';
import { ClassementService, cleEnLigne } from './online/classement';
import { ecranCompte } from './ui/compte';
import { ecranClassement, zoneEnLigne } from './ui/classement';

/** D'où vient la course : `index` ≥ 0 pour un niveau officiel, `retour` ramène à l'écran d'origine. */
interface Contexte { index: number; retour: () => void; menuLabel: string }

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
  private current: { index: number; prepared: PreparedLevel; contexte: Contexte } | null = null;
  private editeur: Editeur | null = null;
  private onEscape: (() => void) | null = null;
  private readonly compte = new CompteService(clientParDefaut);
  private readonly classement = new ClassementService(clientParDefaut);

  constructor(private readonly debug: DebugHook | null = null) {}

  async start(): Promise<void> {
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: $('scene') as HTMLCanvasElement, antialias: true, powerPreference: 'high-performance' });
    } catch {
      this.screens.error('WebGL indisponible', "Ton navigateur ou ta carte graphique ne permet pas d'afficher la 3D. Essaie avec un navigateur récent (Chrome, Firefox, Edge ou Safari).", []);
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
    $('app').append(Object.assign(document.createElement('div'), { className: 'portrait', textContent: 'Tourne ton téléphone en mode paysage' }));

    // comptes en ligne : hors ligne le jeu reste jouable, `demarrer` ne lève jamais
    this.compte.onChange((e) => this.compteChange(e));
    void this.compte.demarrer();

    await this.chargerModeles();
  }

  private async chargerModeles(): Promise<void> {
    this.screens.loading('Chargement des modèles…');
    try {
      this.assets = await loadAssets(import.meta.env.BASE_URL + 'models/', (p) => this.screens.setProgress(p));
      this.showroom = new Showroom(this.renderer, this.assets);
      this.accueil();
    } catch {
      this.screens.error('Chargement impossible', "Les modèles 3D n'ont pas pu être chargés. Vérifie ta connexion.", [
        { label: 'Réessayer', onClick: () => void this.chargerModeles() },
      ]);
    }
  }

  private save(): void {
    this.store.saveReglages(this.reglages);
  }

  private libelleCompte(e: EtatCompte = this.compte.etat): string {
    return e.statut === 'connecte' && e.pseudo ? `Compte · ${e.pseudo}` : 'Compte';
  }

  private compteChange(e: EtatCompte): void {
    this.screens.majCompte(this.libelleCompte(e));
    // lien « mot de passe oublié » : on ouvre l'écran Compte pour choisir le nouveau mot de passe
    if (e.statut === 'connecte' && e.recuperation && this.assets && !this.session) this.ecranCompte(() => this.accueil());
  }

  private ecranCompte(retour: () => void): void {
    this.showroom?.stop();
    this.screens.monter(ecranCompte(this.compte, { onRetour: retour }));
  }

  private ecranClassement(cle: string, titre: string, retour: () => void): void {
    const e = this.compte.etat;
    this.screens.monter(ecranClassement({
      titre, moi: e.statut === 'connecte' ? e.id : null,
      charger: () => this.classement.chargerClassement(cle, 20),
      onRetour: retour,
    }));
  }

  private accueil(): void {
    this.showroom?.stop();
    this.screens.accueil({
      persistent: this.persistent,
      compte: this.libelleCompte(),
      onCompte: () => this.ecranCompte(() => this.accueil()),
      onJouer: () => this.niveaux(),
      onGarage: () => this.garage(() => this.accueil()),
      onEditeur: () => this.hubEditeur(),
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
    const mesNiveaux = this.store.listNiveaux();
    const perso = mesNiveaux.map((n) => {
      const a = analyseLevel(n.level);
      return {
        nom: n.level.nom,
        detail: `${formatDistance(longueurRoute(n.level))} · ${dateCourte(n.maj)}`,
        record: null as RecordEntry | null,
        desactive: a.ok ? undefined : `Niveau à corriger dans l'éditeur : ${a.erreurs[0] ?? a.problemes[0]?.message ?? 'invalide'}`,
      };
    });
    // les records des niveaux perso sont liés à l'empreinte du contenu (asynchrone)
    void Promise.all(mesNiveaux.map((n) => empreinteNiveau(n.level))).then((empreintes) => {
      empreintes.forEach((e, i) => { perso[i].record = this.store.getRecord(cleNiveauPerso(e), this.reglages.mode); });
      if (this.niveauxAffiches === mesNiveaux && this.screens.niveauxVisible()) this.afficherNiveaux(cartes, perso, mesNiveaux);
    });
    this.niveauxAffiches = mesNiveaux;
    this.afficherNiveaux(cartes, perso, mesNiveaux);
  }

  private niveauxAffiches: MonNiveau[] | null = null;

  private afficherNiveaux(cartes: NiveauCarte[], perso: NiveauCarte[], mesNiveaux: MonNiveau[]): void {
    this.screens.niveaux({
      cartes, perso, mode: this.reglages.mode, voiture: this.reglages.voiture,
      onChoisir: (i) => void this.lancer(i),
      onChoisirPerso: (i) => void this.lancerPerso(mesNiveaux[i].level, { index: -1, retour: () => this.niveaux(), menuLabel: 'Menu' }),
      onClassement: (perso, i) => {
        if (!perso) { this.ecranClassement(cleNiveauOfficiel(NIVEAUX_OFFICIELS[i].id), cartes[i].nom, () => this.niveaux()); return; }
        const n = mesNiveaux[i];
        void empreinteNiveau(n.level)
          .then((e) => this.ecranClassement(cleNiveauPerso(e), n.level.nom, () => this.niveaux()))
          .catch(() => this.screens.toast('Classement indisponible pour ce niveau.'));
      },
      onEditeur: () => this.hubEditeur(),
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
    const n = NIVEAUX_OFFICIELS[index];
    await this.demarrer(cleNiveauOfficiel(n.id), n.data, { index, retour: () => this.niveaux(), menuLabel: 'Menu' });
  }

  /** Niveau perso (Mes niveaux, hub ou test de l'éditeur) : records liés à l'empreinte du contenu. */
  private async lancerPerso(level: Level, contexte: Contexte): Promise<void> {
    await this.demarrer(cleNiveauPerso(await empreinteNiveau(level)), level, contexte);
  }

  private async demarrer(key: string, raw: unknown, contexte: Contexte): Promise<void> {
    if (!this.assets) return;
    this.showroom?.stop();
    this.screens.loading('Préparation du niveau…');
    await new Promise((r) => setTimeout(r, 30));
    const res = prepareLevel(key, raw);
    if (!res.ok) {
      this.screens.error('Niveau invalide', res.erreurs.join('\n'), [{ label: 'Retour', onClick: contexte.retour }]);
      return;
    }
    this.session?.dispose();
    this.current = { index: contexte.index, prepared: res.prepared, contexte };
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

  // Éditeur de niveaux

  private hubEditeur(): void {
    this.showroom?.stop();
    this.editeur = null;
    afficherHub(this.screens, {
      store: this.store, persistent: this.persistent, root: $('ui'),
      onModifier: (n) => this.ouvrirEditeur(n),
      onJouer: (n) => void this.lancerPerso(n.level, { index: -1, retour: () => this.hubEditeur(), menuLabel: 'Mes niveaux' }),
      onRetour: () => this.accueil(),
    });
  }

  private ouvrirEditeur(n: MonNiveau): void {
    const ed = new Editeur({
      store: this.store, persistent: this.persistent, id: n.id, level: n.level, touch: this.touch,
      onTester: (level) => void this.tester(ed, level),
      onQuitter: () => this.hubEditeur(),
    });
    this.editeur = ed;
    ed.monter($('ui'));
  }

  /** Lance la course ; à la sortie (pause ou arrivée) on retrouve l'éditeur dans le même état. */
  private async tester(ed: Editeur, level: Level): Promise<void> {
    await this.lancerPerso(level, { index: -1, menuLabel: "Retour à l'éditeur", retour: () => ed.monter($('ui')) });
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
      menuLabel: this.current?.contexte.menuLabel,
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
    const next = cur.index >= 0 && cur.index + 1 < NIVEAUX_OFFICIELS.length ? cur.index + 1 : -1;
    this.screens.resultats({
      result: r, record, persistent: this.persistent,
      onRecommencer: () => { this.screens.clear(); this.touchControls.show(this.touch || this.input.touchActive); this.session?.restart(); },
      onSuivant: next >= 0 ? () => void this.lancer(next) : null,
      onMenu: () => this.quitterCourse(),
      menuLabel: cur.contexte.menuLabel,
      enLigne: this.envoyerScore(cur.prepared.key, r),
    });
  }

  /** Bloc « classement en ligne » des résultats : envoi en tâche de fond, l'écran n'attend jamais le réseau. */
  private envoyerScore(cle: string, r: RaceResult): HTMLElement | null {
    if (!cleEnLigne(cle)) return null;
    const zone = zoneEnLigne();
    const e = this.compte.etat;
    if (e.statut !== 'connecte') {
      zone.invite('Connecte-toi pour apparaître au classement.', () => this.ecranCompte(this.terminerCourse()));
    } else if (!e.pseudo) {
      zone.invite('Choisis un pseudo pour apparaître au classement.', () => this.ecranCompte(this.terminerCourse()));
    } else {
      zone.envoi();
      void this.classement.soumettreScore({
        niveau: cle, mode: this.reglages.mode, score: r.score, temps: r.time, voiture: this.reglages.voiture, meilleurDrift: r.bestDrift,
      }).then((res) => zone.resultat(res));
    }
    return zone.el;
  }

  /** Ferme la course et renvoie l'écran où retourner. */
  private terminerCourse(): () => void {
    this.session?.dispose();
    this.session = null;
    this.keyboard.capture = false;
    this.touchControls.show(false);
    const retour = this.current?.contexte.retour ?? (() => this.niveaux());
    this.current = null;
    return retour;
  }

  private quitterCourse(): void {
    this.terminerCourse()();
  }
}
