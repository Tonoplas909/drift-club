import * as THREE from 'three';
import { loadAssets, type Assets } from './render/assets';
import { QualityManager } from './render/quality';
import { Showroom } from './render/showroom';
import { FondMenu } from './render/fondMenu';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { GamepadInput } from './input/gamepad';
import { ModePhoto, orbiteDepuis, camOrbite } from './game/photo';
import { Store, safeStorage, cleNiveauPerso, type Reglages, type MonNiveau } from './storage/store';
import { Hud } from './game/hud';
import { GameSession, type DebugHook } from './game/session';
import { ZenSession, nouvelleGraine } from './game/zenSession';
import { prepareLevel, type PreparedLevel } from './game/prepare';
import { forcerDecor } from './game/decorUrl';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { Screens, levelSummary, type NiveauCarte } from './ui/screens';
import { formatDistance, formatScore, libelleAmbiance, titreNiveau } from './ui/format';
import { depuisBase64, versBase64 } from './core/replay/replay';
import { skinChoisie, choisirSkin, ajouterLivreesAtelier, skinDef } from './core/skins';
import { fumeeDef } from './core/fumees';
import { defAtelier, lireLivreeOfficielle, versLigneOfficielle, type LivreeOfficielle } from './core/atelier';
import { estFumee } from './core/caisses';
import type { CarId } from './core/physics/types';
import { ECONOMIE, fumeeAutorisee, gagnerCourse, ouvrirCaisse, skinsAutorises, type GainCourse, type Progression } from './core/economie';
import { appliquerOuvertureServeur, choisirProgression, gainServeur, type EtatProgressionCompte, type ProgressionActive } from './core/progressionCompte';
import type { Objet } from './core/caisses';
import type { Rng } from './core/math/rng';
import type { RaceResult } from './core/race/race';
import type { Level } from './core/level/types';
import { empreinteNiveau } from './core/level/fingerprint';
import { analyseLevel } from './core/editor/analyse';
import { Editeur } from './editor/editor';
import { afficherHub } from './editor/hub';
import { dateCourte, longueurRoute } from './editor/format';
import { clientParDefaut } from './online/client';
import { CompteService, type EtatCompte } from './online/compte';
import { ClassementService, cleEnLigne, type RangEnLigne, type Resultat } from './online/classement';
import { ProgressionEnLigne, type EchecProgression } from './online/progression';
import { MSG_INDISPONIBLE } from './online/erreurs';
import { NiveauxEnLigneService } from './online/niveaux';
import { AtelierEnLigne } from './online/atelier';
import { decoderNiveau } from './core/level/encode';
import { lireFragment } from './share/lien';
import { ouvrirPartage, ouvrirImport, carteNiveauPartage } from './ui/partage';
import { panneauEnLigne } from './ui/enligne';
import { ecranCompte } from './ui/compte';
import { ecranClassement, zoneEnLigne, textePlace } from './ui/classement';
import { ecranCaisses, type ResultatOuverture } from './ui/caisses';
import { ecranAtelier } from './ui/atelier';
import { MiseAJour, lireVersionPubliee } from './online/miseAJour';
import { BUILD_ID } from './version';
import { SEUILS_MEDAILLES, medaille, type Medaille } from './core/medailles';
import { MODE_IDS, MODE_NOMS } from './core/physics/assists';
import { CARS } from './core/physics/cars';
import { dessinerCarte, nomCarte } from './ui/carteScore';
import { enregistrerImage } from './ui/partageImage';
import { SITE_URL } from './online/config';
import { zoneGains, type ZoneGains } from './ui/gains';
import { ecranTouches, aideTouches } from './ui/touches';
import { CompteurPilote, estVide, fusionnerStatistiques, lireStatistiques, statistiquesVides, type Statistiques } from './game/statistiques';
import { StatistiquesEnLigne } from './online/statistiques';
import { ecranStatistiques } from './ui/statistiques';
import { ecranRevoir } from './ui/revoir';
import { ecranDefi } from './ui/defi';
import { DefiService } from './online/defi';
import { defiDuJour, cleDefi, jourEnClair } from './core/defi';
import { jourParis } from './jour';

/** D'où vient la course : `index` ≥ 0 pour un niveau officiel, `retour` ramène à l'écran d'origine. */
interface Contexte { index: number; retour: () => void; menuLabel: string; /** voiture imposée (défi du jour) */ voiture?: CarId }

/** Message quand le compte est connecté mais injoignable : la progression du compte reste en lecture seule. */
export const MSG_CONNEXION_CAISSE = 'Connexion requise pour ouvrir une caisse avec ton compte';

const $ = (id: string) => document.getElementById(id) as HTMLElement;

export class App {
  private renderer!: THREE.WebGLRenderer;
  private store!: Store;
  private persistent = true;
  private reglages!: Reglages;
  /** progression LOCALE (joueur non connecté) ; celle du compte est dans `compteProg` */
  private progression!: Progression;
  /** dernière progression du compte connectée connue (serveur, ou copie gardée hors ligne) */
  private compteProg: EtatProgressionCompte | null = null;
  /** vrai si les fonctions SQL de progression ne sont pas installées : on reste sur la progression locale */
  private serviceProgAbsent = false;
  private jetonSynchro = 0;
  private assets: Assets | null = null;
  private readonly screens = new Screens($('ui'));
  private readonly hud = new Hud($('hud'));
  private readonly audio = new AudioEngine();
  private readonly keyboard = new KeyboardInput();
  private readonly touchControls = new TouchControls($('touch'));
  private readonly manette = new GamepadInput();
  private readonly input = new InputManager(this.keyboard, this.touchControls, this.manette);
  private readonly touch = matchMedia('(pointer: coarse)').matches;
  private session: GameSession | ZenSession | null = null;
  private showroom: Showroom | null = null;
  /** fond animé de l'accueil (la voiture du joueur en drift sur une ligne droite) */
  private fondMenu: FondMenu | null = null;
  private current: { index: number; prepared: PreparedLevel; contexte: Contexte } | null = null;
  private editeur: Editeur | null = null;
  private onEscape: (() => void) | null = null;
  private photo: ModePhoto | null = null;
  /** statistiques du pilote, enregistrées à la pause, à l'arrivée et en quittant la course */
  private stats!: CompteurPilote;
  private readonly compte = new CompteService(clientParDefaut);
  private readonly classement = new ClassementService(clientParDefaut);
  private readonly niveauxEnLigne = new NiveauxEnLigneService(clientParDefaut);
  private readonly progressionEnLigne = new ProgressionEnLigne(clientParDefaut);
  private readonly atelier = new AtelierEnLigne(clientParDefaut);
  private readonly defis = new DefiService(clientParDefaut);
  private readonly statsEnLigne = new StatistiquesEnLigne(clientParDefaut);
  /** livrées de l'Atelier : chargement en cours ou dernier fait, et quand (rechargées au plus toutes les 5 min) */
  private livreesAtelier: Promise<void> | null = null;
  private livreesAtelierLe = 0;
  private empreinteLivrees = '';
  private readonly miseAJour = new MiseAJour({
    actuel: BUILD_ID,
    lire: () => lireVersionPubliee(import.meta.env.BASE_URL),
    peutRecharger: () => this.peutRecharger(),
    recharger: () => { this.screens.loading('Mise à jour du jeu…'); location.reload(); },
    memoire: {
      lire: () => { try { return sessionStorage.getItem('driftclub.maj'); } catch { return null; } },
      ecrire: (v) => { try { sessionStorage.setItem('driftclub.maj', v); } catch { /* stockage bloqué */ } },
    },
    maintenant: () => Date.now(),
  });

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
    // livrées de l'Atelier connues de l'appareil : avant les réglages et la progression, qui oublient les livrées inconnues
    this.installerLivreesAtelier(this.store.loadLivreesAtelier().map(lireLivreeOfficielle).filter((l): l is LivreeOfficielle => l !== null));
    this.reglages = this.store.loadReglages(this.touch);
    this.hud.options(this.reglages);
    this.manette.reglages = this.reglages.manette;
    this.appliquerTouches();
    this.stats = new CompteurPilote(lireStatistiques(this.store.loadStatistiques()), () => new Date().toISOString().slice(0, 10));
    // clés et livrées gagnées ; une livrée choisie mais verrouillée (données modifiées à la main) retombe sur « unie »
    this.progression = this.store.loadProgression(this.reglages.skins);
    // si une progression de compte est gardée sur l'appareil, le joueur est peut-être reconnecté dans un instant : on attend de savoir laquelle fait foi
    if (this.store.idProgressionCompte() === null) this.appliquerSkinsAutorises();
    this.audio.setVolume(this.reglages.volume);
    this.audio.setMuted(this.reglages.muet);
    this.audio.setFondSonore(this.reglages.ambianceDecor);
    this.keyboard.attach(window);

    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    // clic de menu discret sur les boutons (les caisses et la course ont leurs propres sons)
    document.addEventListener('click', (e) => { if ((e.target as HTMLElement | null)?.closest?.('button, .btn')) this.audio.playClick(); });
    window.addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.onEscape) { const f = this.onEscape; this.onEscape = null; f(); } });
    // Retour arrière : recommence le niveau depuis la pause ou les résultats (en course, la session s'en charge)
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (e.code !== 'Backspace' || e.repeat || !this.session?.enPause || this.photo || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
      e.preventDefault();
      this.recommencerCourse();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.session) this.pauseRace(); });
    $('app').append(Object.assign(document.createElement('div'), { className: 'portrait', textContent: 'Tourne ton téléphone en mode paysage' }));

    this.surveillerMisesAJour();

    // comptes en ligne : hors ligne le jeu reste jouable, `demarrer` ne lève jamais
    this.compte.onChange((e) => this.compteChange(e));
    void this.compte.demarrer();
    void this.chargerLivreesAtelier();

    await this.chargerModeles();
  }

  /**
   * Nouvelle version publiée : le jeu se recharge tout seul au prochain moment sans risque (voir `peutRecharger`).
   * Vérifié 30 s après le lancement, puis toutes les 5 min et au retour sur l'onglet (rien en développement).
   */
  private surveillerMisesAJour(): void {
    if (BUILD_ID === 'local') return;
    const verifier = (): void => { void this.miseAJour.verifier().then(() => this.miseAJour.appliquer()); };
    window.setTimeout(verifier, 30_000);
    window.setInterval(verifier, 5 * 60_000);
    window.setInterval(() => this.miseAJour.appliquer(), 3000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) verifier(); });
  }

  /** Recharger maintenant ne fait rien perdre : pas de course (ni résultats), pas d'éditeur, pas de caisses, pas de saisie en cours. */
  private peutRecharger(): boolean {
    const actif = document.activeElement as HTMLElement | null;
    const saisie = !!actif && (actif.tagName === 'INPUT' || actif.tagName === 'TEXTAREA' || actif.isContentEditable);
    return this.assets !== null && this.session === null && this.editeur === null && !saisie
      && !document.querySelector('.screen.caisses, [role="dialog"], dialog[open]');
  }

  private async chargerModeles(): Promise<void> {
    this.screens.loading('Chargement des modèles…');
    try {
      this.assets = await loadAssets(import.meta.env.BASE_URL + 'models/', (p) => this.screens.setProgress(p));
      this.showroom = new Showroom(this.renderer, this.assets);
      this.fondMenu = new FondMenu(this.renderer, this.assets);
      this.accueil();
      // lien de partage : à l'ouverture de la page, puis si le joueur colle un autre lien dans la barre d'adresse
      void this.ouvrirLien();
      // développement : `?debug&zen=<graine>` lance directement une balade Zen
      const zen = new URLSearchParams(location.search).get('zen');
      if (this.debug && zen !== null) void this.lancerZen(Number(zen) || undefined);
      window.addEventListener('hashchange', () => { if (!this.session) void this.ouvrirLien(); });
    } catch {
      this.screens.error('Chargement impossible', "Les modèles 3D n'ont pas pu être chargés. Vérifie ta connexion.", [
        { label: 'Réessayer', onClick: () => void this.chargerModeles() },
      ]);
    }
  }

  private save(): void {
    this.store.saveReglages(this.reglages);
    if (this.stats?.modifie) {
      this.store.saveStatistiques(this.stats.stats);
      if (this.statsCompte && this.stats.attente) this.store.saveStatsCompte('attente', this.statsCompte.id, this.stats.attente);
      this.stats.modifie = false;
      // envoi au compte, au plus toutes les 15 s (pause, arrivée, sortie de course)
      if (this.statsCompte && Date.now() - this.dernierEnvoiStats > 15_000) void this.synchroStatistiques();
    }
  }

  /** Statistiques du compte connecté : dernier total connu du serveur (null : pas encore lu, ou service absent). */
  private statsCompte: { id: string; total: Statistiques | null; absent: boolean } | null = null;
  private envoiStats = false;
  private dernierEnvoiStats = 0;

  /** Connexion ou déconnexion : les ajouts des courses sont mis de côté pour le compte connecté. */
  private brancherStatistiques(id: string | null): void {
    if (this.statsCompte?.id === id) return;
    if (!id) { this.statsCompte = null; this.stats.attente = null; return; }
    const total = this.store.loadStatsCompte('total', id);
    const attente = this.store.loadStatsCompte('attente', id);
    this.statsCompte = { id, total: total ? lireStatistiques(total) : null, absent: false };
    this.stats.attente = attente ? lireStatistiques(attente) : statistiquesVides();
    void this.synchroStatistiques();
  }

  /**
   * Envoie au compte ce qui s'est ajouté depuis le dernier envoi (le serveur additionne : plusieurs appareils
   * s'ajoutent sans s'écraser). La première fois qu'un compte n'a encore rien, l'historique de l'appareil lui est
   * versé. Ne lève jamais ; hors ligne, les ajouts attendent le prochain envoi.
   */
  private async synchroStatistiques(): Promise<void> {
    const c = this.statsCompte;
    if (!c || this.envoiStats) return;
    this.envoiStats = true;
    this.dernierEnvoiStats = Date.now();
    try {
      const lu = await this.statsEnLigne.charger();
      if (this.statsCompte !== c) return;
      if (!lu.ok) { c.absent = lu.raison === 'absent'; return; }
      c.absent = false;
      if (lu.valeur) { c.total = lu.valeur; this.store.saveStatsCompte('total', c.id, lu.valeur); }
      if (!this.stats.attente) return;
      if (lu.valeur === null && !this.store.statsImportees().includes(c.id)) {
        this.stats.attente = fusionnerStatistiques(this.stats.attente, this.stats.stats);
        this.store.marquerStatsImportees(c.id);
      }
      if (estVide(this.stats.attente)) return;
      // les courses qui finissent pendant l'envoi s'ajoutent à une nouvelle attente
      const envoi = this.stats.attente;
      this.stats.attente = statistiquesVides();
      const r = await this.statsEnLigne.ajouter(envoi);
      if (this.statsCompte !== c) return;
      if (r.ok) { c.total = r.valeur; this.store.saveStatsCompte('total', c.id, r.valeur); }
      else this.stats.attente = fusionnerStatistiques(envoi, this.stats.attente);
      this.store.saveStatsCompte('attente', c.id, this.stats.attente);
    } finally {
      this.envoiStats = false;
    }
  }

  /** Remplace les livrées de l'Atelier du jeu ; renvoie vrai si la liste a changé. */
  private installerLivreesAtelier(liste: LivreeOfficielle[]): boolean {
    const empreinte = JSON.stringify(liste.map((l) => [l.idServeur, l.rarete, l.livree]));
    if (empreinte === this.empreinteLivrees) return false;
    this.empreinteLivrees = empreinte;
    ajouterLivreesAtelier(liste.map((l) => ({ voiture: l.livree.voiture, def: defAtelier(l) })));
    return true;
  }

  /**
   * Livrées de l'Atelier validées : lues sur le serveur (sans compte), gardées sur l'appareil. Une nouvelle livrée peut
   * être dans la progression du compte : on la relit alors. Ne lève jamais ; hors ligne, on garde celles de l'appareil.
   */
  private chargerLivreesAtelier(force = false): Promise<void> {
    if (this.livreesAtelier && !force && Date.now() - this.livreesAtelierLe < 5 * 60_000) return this.livreesAtelier;
    this.livreesAtelierLe = Date.now();
    this.livreesAtelier = this.atelier.officielles().then((r) => {
      if (!r.ok) { this.livreesAtelierLe = 0; return; }
      this.store.saveLivreesAtelier(r.valeur.map(versLigneOfficielle));
      if (this.installerLivreesAtelier(r.valeur) && this.compte.etat.statut === 'connecte') void this.synchroProgression();
    }, () => { this.livreesAtelierLe = 0; });
    return this.livreesAtelier;
  }

  private libelleCompte(e: EtatCompte = this.compte.etat): string {
    return e.statut === 'connecte' && e.pseudo ? `Compte · ${e.pseudo}` : 'Compte';
  }

  /** Progression qui fait foi : celle du compte si le joueur est connecté (avec pseudo), sinon la locale. */
  private prog(): ProgressionActive {
    const e = this.compte.etat;
    return choisirProgression({
      idCompte: e.statut === 'connecte' && e.pseudo ? e.id : null, local: this.progression, compte: this.compteProg, serviceAbsent: this.serviceProgAbsent,
    });
  }

  /** Les livrées choisies doivent être débloquées dans la progression qui fait foi (sinon « unie ») ; rien n'est touché tant que le compte est inconnu. */
  private appliquerSkinsAutorises(): void {
    const e = this.compte.etat;
    if (e.statut === 'connecte' && e.pseudo && !this.serviceProgAbsent && this.compteProg?.id !== e.id) return;
    const autorisees = skinsAutorises(this.reglages.skins, this.prog().progression);
    const fumee = fumeeAutorisee(this.reglages.fumee, this.prog().progression);
    if (JSON.stringify(autorisees) !== JSON.stringify(this.reglages.skins) || fumee !== this.reglages.fumee) { this.reglages.skins = autorisees; this.reglages.fumee = fumee; this.save(); }
  }

  private memoriserCompteProg(e: EtatProgressionCompte): void {
    this.compteProg = e;
    this.store.saveProgressionCompte(e);
  }

  /**
   * Lit la progression du compte (créée avec les 3 clés offertes la première fois). La progression locale n'y est jamais
   * versée (elle est modifiable dans le navigateur). Ne lève jamais ; hors ligne on garde la dernière valeur connue, en lecture seule.
   */
  private async synchroProgression(): Promise<void> {
    const e = this.compte.etat;
    if (e.statut !== 'connecte' || !e.pseudo) return;
    const id = e.id, jeton = ++this.jetonSynchro;
    const actuel = (): boolean => jeton === this.jetonSynchro;
    const r = await this.progressionEnLigne.charger();
    if (!actuel()) return;
    if (!r.ok) { this.echecSynchro(id, r); return; }
    this.serviceProgAbsent = false;
    this.memoriserCompteProg({ id, progression: r.valeur.progression, importee: r.valeur.importee, synchro: 'ok' });
    this.appliquerSkinsAutorises();
  }

  private echecSynchro(id: string, r: EchecProgression): void {
    if (r.raison === 'absent') { this.serviceProgAbsent = true; this.appliquerSkinsAutorises(); return; } // SQL pas encore installé : progression locale
    // injoignable : dernière valeur connue de ce compte, en lecture seule
    const gardee = this.compteProg?.id === id ? this.compteProg.progression : this.store.loadProgressionCompte(id);
    if (gardee) this.compteProg = { id, progression: gardee, importee: this.compteProg?.importee ?? true, synchro: 'hors-ligne' };
    else if (this.compteProg?.id === id) this.compteProg = { ...this.compteProg, synchro: 'hors-ligne' };
    this.appliquerSkinsAutorises();
  }

  private compteChange(e: EtatCompte): void {
    this.screens.majCompte(this.libelleCompte(e));
    this.brancherStatistiques(e.statut === 'connecte' && e.pseudo ? e.id : null);
    if (e.statut === 'connecte' && e.pseudo) {
      if (this.compteProg?.id !== e.id) {
        const gardee = this.store.loadProgressionCompte(e.id);
        this.compteProg = gardee ? { id: e.id, progression: gardee, importee: true, synchro: 'hors-ligne' } : null;
      }
      if (this.compteProg?.synchro !== 'ok') void this.synchroProgression();
    } else if (this.compteProg || this.serviceProgAbsent) {
      // déconnexion : retour à la progression locale
      this.jetonSynchro++;
      this.compteProg = null;
      this.serviceProgAbsent = false;
      this.appliquerSkinsAutorises();
    }
    // connexion ou déconnexion pendant le choix du niveau : les places affichées changent
    if (this.screens.niveauxVisible() && (e.statut === 'connecte') !== this.placesConnecte) this.niveaux();
    this.placesConnecte = e.statut === 'connecte';
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
      aide: aideTouches(this.reglages.touches.clavier),
      compte: this.libelleCompte(),
      onCompte: () => this.ecranCompte(() => this.accueil()),
      onJouer: () => this.niveaux(),
      onDefi: () => this.defiEcran(() => this.accueil()),
      onZen: () => void this.lancerZen(),
      onGarage: () => this.garage(() => this.accueil()),
      onCaisses: () => this.caisses(() => this.accueil()),
      onEditeur: () => this.hubEditeur(),
      onStatistiques: () => this.statistiquesEcran(() => this.accueil()),
      onReglages: () => this.reglagesEcran(() => this.accueil()),
    });
    this.lancerFondMenu();
  }

  /** Fond de l'accueil : la voiture choisie au Garage (couleur, livrée, fumée) en drift ; s'arrête dès qu'on quitte l'accueil. */
  private lancerFondMenu(): void {
    const ecran = document.querySelector<HTMLElement>('#ui .screen.accueil');
    if (!this.fondMenu || !ecran) return;
    const r = this.reglages, voiture = r.voiture;
    try {
      this.fondMenu.demarrer({
        voiture, couleur: r.couleur, skin: skinDef(voiture, skinChoisie(r.skins, voiture)), fumee: fumeeDef(r.fumee).style,
        ecran, basse: r.qualite === 'basse' || (r.qualite === 'auto' && this.touch),
      });
      ecran.classList.add('fond3d');
    } catch {
      // WebGL perdu ou modèle manquant : l'illustration fixe reste en fond
    }
  }

  private niveaux(): void {
    this.showroom?.stop();
    const connecte = this.compte.etat.statut === 'connecte';
    const attente = textePlace(connecte ? 'chargement' : 'deconnecte');
    const cartes = NIVEAUX_OFFICIELS.map((n) => {
      const s = levelSummary(n.data);
      return {
        nom: s?.nom ?? n.id,
        detail: s ? `${formatDistance(s.longueur)} · ${s.theme} · ${libelleAmbiance({ ambiance: s.ambiance, meteo: s.pluie ? 'pluie' : undefined })}` : '',
        place: attente,
        medaille: this.meilleureMedaille(n.id),
      };
    });
    const mesNiveaux = this.store.listNiveaux();
    const perso: NiveauCarte[] = mesNiveaux.map((n) => {
      const a = analyseLevel(n.level);
      return {
        nom: n.level.nom,
        detail: `${formatDistance(longueurRoute(n.level))} · ${dateCourte(n.maj)}`,
        place: attente,
        desactive: a.ok ? undefined : `Niveau à corriger dans l'éditeur : ${a.erreurs[0] ?? a.problemes[0]?.message ?? 'invalide'}`,
      };
    });
    if (connecte) void this.chargerPlaces(cartes, perso, mesNiveaux);
    this.niveauxAffiches = mesNiveaux;
    this.panneauEnLigne = null; // liste en ligne rechargée à chaque arrivée sur l'écran
    this.afficherNiveaux(cartes, perso, mesNiveaux);
  }

  /** Meilleure médaille d'un niveau officiel, tous modes confondus (records de l'appareil). */
  private meilleureMedaille(id: string): Medaille | null {
    const seuils = SEUILS_MEDAILLES[id];
    if (!seuils) return null;
    const meilleur = Math.max(0, ...MODE_IDS.map((m) => this.store.getRecord(cleNiveauOfficiel(id), m)?.score ?? 0));
    return medaille(meilleur, seuils);
  }

  /** Place du joueur dans le classement en ligne de chaque niveau (un seul appel), puis rafraîchit l'écran. */
  private async chargerPlaces(cartes: NiveauCarte[], perso: NiveauCarte[], mesNiveaux: MonNiveau[]): Promise<void> {
    const clesOff = NIVEAUX_OFFICIELS.map((n) => cleNiveauOfficiel(n.id));
    // les niveaux perso sont classés par l'empreinte de leur contenu
    const clesPerso = await Promise.all(mesNiveaux.map((n) => empreinteNiveau(n.level).then(cleNiveauPerso, () => null)));
    const r = await this.classement.mesPlaces([...clesOff, ...clesPerso.filter((k): k is string => k !== null)]);
    const texte = (k: string | null): string => (!r.ok || k === null ? textePlace('erreur') : textePlace({ place: r.valeur.get(k) ?? null }));
    cartes.forEach((c, i) => { c.place = texte(clesOff[i]); });
    perso.forEach((c, i) => { c.place = texte(clesPerso[i]); });
    if (this.niveauxAffiches === mesNiveaux && this.screens.niveauxVisible()) this.afficherNiveaux(cartes, perso, mesNiveaux);
  }

  private panneauEnLigne: HTMLElement | null = null;

  /** Onglet « En ligne » du choix de niveau ; conservé tant qu'on reste sur l'écran (les rafraîchissements ne le rechargent pas). */
  private panneauLigne(): HTMLElement {
    return (this.panneauEnLigne ??= panneauEnLigne({
      root: $('ui'),
      lister: (tri, page) => this.niveauxEnLigne.lister(tri, page),
      moi: () => (this.compte.etat.statut === 'connecte' ? this.compte.etat.id : null),
      onJouer: async (n) => {
        const r = await this.niveauxEnLigne.charger(n.id);
        if (!r.ok) return r;
        void this.niveauxEnLigne.compterPartie(n.id);
        await this.demarrer(cleNiveauPerso(r.valeur.empreinte), r.valeur.level, { index: -1, retour: () => this.niveaux(), menuLabel: 'Menu' });
        return { ok: true, valeur: null };
      },
      onClassement: (n) => this.ecranClassement(cleNiveauPerso(n.empreinte), n.nom, () => this.niveaux()),
      onEnregistrer: async (n) => {
        const r = await this.niveauxEnLigne.charger(n.id);
        if (!r.ok) return r;
        this.ajouterNiveau(r.valeur.level);
        return { ok: true, valeur: null };
      },
      onRetirer: (n) => this.niveauxEnLigne.retirer(n.id),
    }));
  }

  private niveauxAffiches: MonNiveau[] | null = null;
  private placesConnecte = false;

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
      onImporter: () => void this.importer(() => this.niveaux()),
      enLigne: () => this.panneauLigne(),
      onEditeur: () => this.hubEditeur(),
      onGarage: () => this.garage(() => this.niveaux()),
      onReglages: () => this.reglagesEcran(() => this.niveaux()),
      onRetour: () => this.accueil(),
    });
  }

  private garage(retour: () => void): void {
    if (this.showroom) {
      this.showroom.setCar(this.reglages.voiture, this.reglages.couleur, skinChoisie(this.reglages.skins, this.reglages.voiture));
      // la voiture se tourne à la main, et montre la fumée équipée
      this.showroom.setAuto(false);
      this.showroom.setFumee(fumeeDef(this.reglages.fumee).style);
      this.showroom.start();
    }
    this.screens.garage({
      voiture: this.reglages.voiture,
      couleur: this.reglages.couleur,
      skins: this.reglages.skins,
      fumee: this.reglages.fumee,
      progression: this.prog().progression,
      onFumee: (id) => {
        this.reglages.fumee = fumeeAutorisee(id, this.prog().progression);
        this.save();
        this.showroom?.setFumee(fumeeDef(this.reglages.fumee).style);
      },
      // aperçu d'une fumée (verrouillée ou non) ; null : retour à la fumée équipée
      onApercuFumee: (id) => this.showroom?.setFumee(fumeeDef(id ?? this.reglages.fumee).style),
      onChange: (voiture, couleur, skins) => {
        this.reglages.voiture = voiture;
        this.reglages.couleur = couleur;
        this.reglages.skins = skinsAutorises(skins, this.prog().progression);
        this.save();
        this.showroom?.setCar(voiture, couleur, skinChoisie(this.reglages.skins, voiture));
      },
      // aperçu d'une livrée verrouillée : seulement le showroom, rien n'est enregistré
      onApercu: (voiture, couleur, skin) => this.showroom?.setCar(voiture, couleur, skin),
      onCaisses: () => this.caisses(() => this.garage(retour)),
      onAtelier: () => this.atelierEcran(() => this.garage(retour)),
      onRetour: () => { this.showroom?.stop(); retour(); },
    });
    this.showroom?.piloter($('ui'));
    void this.chargerLivreesAtelier();
  }

  /** Atelier : créer et proposer une livrée (aperçu dans le showroom), suivre ses propositions, modérer (administrateurs). */
  private atelierEcran(retour: () => void): void {
    this.showroom?.setAuto(false);
    this.showroom?.setFumee(null);
    this.showroom?.start();
    const connecte = (): boolean => this.compte.etat.statut === 'connecte' && !!this.compte.etat.pseudo;
    this.screens.monter(ecranAtelier({
      voiture: this.reglages.voiture,
      couleur: this.reglages.couleur,
      peutProposer: connecte,
      brouillon: { lire: () => this.store.loadBrouillonAtelier(), ecrire: (b) => this.store.saveBrouillonAtelier(b) },
      apercu: (voiture, couleur, def) => this.showroom?.apercuLivree(voiture, couleur, def),
      proposer: (l) => this.atelier.proposer(l),
      mesPropositions: () => this.atelier.mesPropositions(),
      estAdmin: () => (connecte() ? this.atelier.estAdmin() : Promise.resolve(false)),
      aModerer: () => this.atelier.aModerer(),
      enVote: () => this.atelier.enVote(),
      voter: (id, v) => this.atelier.voter(id, v),
      moderer: async (id, d) => {
        const r = await this.atelier.moderer(id, d);
        // la livrée validée entre dans les caisses : on la charge tout de suite (et la progression, si c'est la sienne)
        if (r.ok && d.valider) void this.chargerLivreesAtelier(true);
        return r;
      },
      onCompte: () => this.ecranCompte(() => this.atelierEcran(retour)),
      onRetour: retour,
    }));
    this.showroom?.piloter($('ui'));
  }

  /**
   * Ouvre une caisse selon la progression qui fait foi. Locale : tirage ici, enregistré aussitôt. Compte : le SERVEUR paie,
   * tire et débloque ; l'écran reçoit son résultat (la roulette s'arrête dessus) et rien n'est jamais mélangé avec la progression locale.
   */
  private async ouvrirCaisseActive(rng: Rng): Promise<ResultatOuverture> {
    const a = this.prog();
    if (a.source === 'local') {
      const r = ouvrirCaisse(this.progression, rng);
      if (!r) return { ok: false, message: 'Pas assez de clés.' };
      this.progression = r.progression;
      this.store.saveProgression(this.progression);
      return { ok: true, ouverture: r };
    }
    const compte = this.compteProg;
    if (a.lectureSeule || !compte) return { ok: false, message: MSG_CONNEXION_CAISSE };
    await this.chargerLivreesAtelier();
    const r = await this.progressionEnLigne.ouvrirCaisse(() => this.chargerLivreesAtelier(true));
    if (!r.ok) {
      if (r.raison === 'reseau') { this.compteProg = { ...compte, synchro: 'hors-ligne' }; return { ok: false, message: MSG_CONNEXION_CAISSE }; }
      void this.synchroProgression(); // clés ou livrées différentes de ce qu'on croyait : on relit le compte
      return { ok: false, message: r.message };
    }
    const { objet, doublon, cles } = r.valeur;
    const base = this.compteProg?.id === compte.id ? this.compteProg.progression : compte.progression;
    const progression = appliquerOuvertureServeur(base, objet, doublon, cles);
    this.memoriserCompteProg({ ...compte, progression, synchro: 'ok' });
    return { ok: true, ouverture: { progression, tirage: { objet, doublon }, remboursement: doublon ? ECONOMIE.remboursementDoublon : 0 } };
  }

  /** Écran des caisses : la progression est modifiée et enregistrée à l'ouverture (fermer l'onglet en pleine roulette ne perd rien). */
  private caisses(retour: () => void): void {
    this.showroom?.stop();
    const ecran = ecranCaisses({
      progression: () => this.prog().progression,
      ouvrir: (rng) => this.ouvrirCaisseActive(rng),
      blocage: () => (this.prog().lectureSeule ? MSG_CONNEXION_CAISSE : null),
      audio: { tick: (k) => this.audio.playTick(k), ouvrir: () => this.audio.playOuvrirCaisse(), reveal: (r) => this.audio.playReveal(r) },
      couleur: () => this.reglages.couleur,
      onApercu: (x) => this.apercuCaisse(x),
      livreeSemaine: () => this.atelier.livreeDeLaSemaine(),
      onEquiper: (x) => {
        if (estFumee(x)) this.reglages.fumee = x.skin;
        else {
          this.reglages.voiture = x.car as CarId;
          this.reglages.skins = choisirSkin(this.reglages.skins, x.car as CarId, x.skin);
        }
        this.save();
        this.garage(retour);
      },
      onRetour: retour,
    });
    this.screens.monter(ecran);
    // compte connecté mais pas à jour (hors ligne au lancement) : on retente, et l'écran se rafraîchit s'il est encore là
    if (this.prog().lectureSeule) {
      void this.synchroProgression().then(() => {
        if (ecran.isConnected && !ecran.querySelector('.cs-revele') && !ecran.classList.contains('revele') && !this.prog().lectureSeule) this.caisses(retour);
      });
    }
  }

  /** Montre l'objet gagné dans le showroom, derrière la fiche de révélation (une fumée : sur la voiture du joueur) ; `null` l'arrête. */
  private apercuCaisse(x: Objet | null): void {
    if (!this.showroom) return;
    if (!x) { this.showroom.stop(); return; }
    if (estFumee(x)) {
      this.showroom.setCar(this.reglages.voiture, this.reglages.couleur, skinChoisie(this.reglages.skins, this.reglages.voiture));
      this.showroom.setFumee(fumeeDef(x.skin).style);
    } else {
      this.showroom.setCar(x.car as CarId, this.reglages.couleur, x.skin);
      this.showroom.setFumee(null);
    }
    this.showroom.setAuto(true);
    this.showroom.start();
  }

  private reglagesEcran(retour: () => void): void {
    this.screens.reglages({
      reglages: this.reglages,
      touch: this.touch,
      onChange: (r) => {
        this.reglages = r;
        this.hud.options(r);
        this.audio.setVolume(r.volume);
        this.audio.setMuted(r.muet);
        this.audio.setFondSonore(r.ambianceDecor);
        this.manette.reglages = r.manette;
        this.appliquerTouches();
        this.save();
      },
      onTouches: () => this.touchesEcran(() => this.reglagesEcran(retour)),
      onRetour: retour,
    });
  }

  /** Défi du jour : niveau tiré de la date (heure de Paris), voiture imposée, classement, podium récompensé. */
  private defiEcran(retour: () => void): void {
    this.showroom?.stop();
    this.screens.loading('Préparation du défi du jour…');
    window.setTimeout(() => {
      const jour = jourParis(new Date());
      const defi = defiDuJour(jour);
      const cle = cleDefi(jour);
      const prep = prepareLevel(cle, defi.level);
      const records = MODE_IDS.map((m) => this.store.getRecord(cle, m)).filter((r) => r !== null);
      const record = records.length ? records.reduce((a, b) => (b!.score > a!.score ? b : a))! : null;
      const e = this.compte.etat;
      const montrer = (): void => this.defiEcran(retour);
      this.screens.monter(ecranDefi({
        defi, longueur: prep.ok ? prep.prepared.track.length : 0,
        record: record && { score: record.score, temps: record.temps },
        moi: e.statut === 'connecte' ? e.id : null,
        classement: () => this.classement.chargerClassement(cle, 10),
        passes: () => this.defis.passes(7),
        onJouer: () => void this.demarrer(cle, defi.level, { index: -1, retour: montrer, menuLabel: 'Défi du jour', voiture: defi.voiture }),
        onClassement: () => this.ecranClassement(cle, defi.level.nom, montrer),
        onRetour: retour,
      }));
      // podium des défis passés : clés créditées par le serveur, une fois par défi
      if (e.statut === 'connecte' && e.pseudo) {
        void this.defis.reclamer().then((r) => {
          if (!r.ok || r.valeur.length === 0) return;
          const total = r.valeur.reduce((n, x) => n + x.cles, 0);
          const premier = r.valeur[0];
          this.screens.toast(`+${total} clé${total > 1 ? 's' : ''} : ${premier.rang === 1 ? '1er' : `${premier.rang}e`} au défi du ${jourEnClair(premier.jour)}${r.valeur.length > 1 ? ' (et d\'autres)' : ''} !`);
          void this.synchroProgression();
        });
      }
    }, 30);
  }

  /** Statistiques du pilote, avec les médailles gagnées (records de l'appareil). */
  private statistiquesEcran(retour: () => void, relire = true): void {
    this.showroom?.stop();
    const medailles = { bronze: 0, argent: 0, or: 0 };
    for (const n of NIVEAUX_OFFICIELS) { const m = this.meilleureMedaille(n.id); if (m) medailles[m]++; }
    const c = this.statsCompte, e = this.compte.etat;
    // compte connecté (et migration 0013 passée) : le total du compte et ce qui attend d'être envoyé
    const duCompte = c !== null && !c.absent;
    const stats = duCompte ? fusionnerStatistiques(c.total ?? statistiquesVides(), this.stats.attente ?? statistiquesVides()) : this.stats.stats;
    const source = duCompte ? `ton compte${e.statut === 'connecte' && e.pseudo ? ` (${e.pseudo})` : ''}` : 'cet appareil';
    const ecran = ecranStatistiques({ stats, source, medailles, niveaux: NIVEAUX_OFFICIELS.length, onRetour: retour });
    this.screens.monter(ecran);
    // total du compte relu : l'écran se met à jour s'il est encore affiché
    if (c && relire && !this.envoiStats) void this.synchroStatistiques().then(() => { if (ecran.isConnected) this.statistiquesEcran(retour, false); });
  }

  private appliquerTouches(): void {
    this.keyboard.touches = this.reglages.touches.clavier;
    this.manette.boutons = this.reglages.touches.manette;
  }

  /** Touches du clavier et boutons de la manette. */
  private touchesEcran(retour: () => void): void {
    this.screens.monter(ecranTouches({
      touches: this.reglages.touches,
      manette: this.manette,
      onChange: (t) => { this.reglages = { ...this.reglages, touches: t }; this.appliquerTouches(); this.save(); },
      onRetour: retour,
    }));
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
    const res = prepareLevel(key, forcerDecor(raw, location.search));
    if (!res.ok) {
      this.screens.error('Niveau invalide', res.erreurs.join('\n'), [{ label: 'Retour', onClick: contexte.retour }]);
      return;
    }
    this.session?.dispose();
    this.current = { index: contexte.index, prepared: res.prepared, contexte };
    // voiture imposée (défi du jour) : la course a ses propres réglages, la voiture du Garage ne change pas
    const reglages = contexte.voiture ? { ...this.reglages, voiture: contexte.voiture } : this.reglages;
    this.reglagesCourse = reglages;
    this.session = new GameSession(res.prepared, {
      renderer: this.renderer, assets: this.assets, hud: this.hud, audio: this.audio, input: this.input,
      quality: new QualityManager(this.reglages.qualite, this.touch), reglages, debug: this.debug, stats: this.stats,
    }, {
      onFinish: (r) => this.arrivee(r),
      onPause: () => this.pauseRace(),
    });
    const fantome = this.installerFantome(this.session, key);
    this.screens.clear();
    this.keyboard.capture = true;
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session.start();
    if (fantome) this.hud.annonce(fantome);
  }

  /** Fantôme du record de ce niveau (dans le mode choisi) ; renvoie le texte à annoncer, ou null. */
  private installerFantome(session: GameSession, key: string): string | null {
    const f = this.reglages.fantome ? this.store.loadFantome(key, this.reglages.mode) : null;
    const octets = f ? depuisBase64(f.replay) : null;
    if (!f || !octets || !session.installerFantome(f.voiture, octets)) return null;
    return `Fantôme : ton record (${formatScore(f.score)})`;
  }

  /** Mode Zen : balade sans fin sur une route générée au fil de l'eau (graine tirée au hasard, ou donnée). */
  private async lancerZen(graine = nouvelleGraine()): Promise<void> {
    if (!this.assets) return;
    this.showroom?.stop();
    this.screens.loading('Préparation de la route…');
    await new Promise((r) => setTimeout(r, 30));
    this.session?.dispose();
    this.current = null;
    this.session = new ZenSession(graine, {
      renderer: this.renderer, assets: this.assets, hud: this.hud, audio: this.audio, input: this.input,
      quality: new QualityManager(this.reglages.qualite, this.touch), reglages: this.reglages, debug: this.debug, stats: this.stats,
    }, { onPause: () => this.pauseRace() });
    this.screens.clear();
    this.keyboard.capture = true;
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session.start();
  }

  /** Mode Zen : nouvelle route (nouvelle graine), derrière un écran de chargement. */
  private async nouvelleRoute(): Promise<void> {
    const s = this.session;
    if (!(s instanceof ZenSession)) return;
    this.onEscape = null;
    this.screens.loading('Nouvelle route…');
    await new Promise((r) => setTimeout(r, 30));
    s.restart();
    this.screens.clear();
    this.touchControls.show(this.touch || this.input.touchActive);
  }

  // Éditeur de niveaux

  private hubEditeur(): void {
    this.showroom?.stop();
    this.editeur = null;
    afficherHub(this.screens, {
      store: this.store, persistent: this.persistent, root: $('ui'),
      onModifier: (n) => this.ouvrirEditeur(n),
      onJouer: (n) => void this.lancerPerso(n.level, { index: -1, retour: () => this.hubEditeur(), menuLabel: 'Mes niveaux' }),
      onPartager: (level) => this.partager(level, () => undefined, () => this.hubEditeur()),
      onImporter: () => void this.importer(() => this.hubEditeur()),
      onRetour: () => this.accueil(),
    });
  }

  /** Ajoute un niveau à Mes niveaux (import, lien partagé, niveau en ligne). */
  private ajouterNiveau(level: Level): MonNiveau {
    const n: MonNiveau = { id: this.store.nouvelId(), level, maj: new Date().toISOString() };
    this.store.saveNiveau(n);
    return n;
  }

  // Partage

  /** Fenêtre « Partager » ; `quitter` détache l'écran courant et `revenir` le remonte si le joueur passe par Compte. */
  private partager(level: Level, quitter: () => void, revenir: () => void): void {
    ouvrirPartage({
      root: $('ui'), level, compte: () => this.compte.etat, service: this.niveauxEnLigne,
      onCompte: () => { quitter(); this.ecranCompte(revenir); },
    });
  }

  /** Fenêtre « Importer » ; `rafraichir` réaffiche l'écran d'où l'on vient. */
  private async importer(rafraichir: () => void): Promise<void> {
    const r = await ouvrirImport({ root: $('ui'), enregistrer: (l) => this.ajouterNiveau(l), chargerEnLigne: (id) => this.niveauxEnLigne.charger(id) });
    if (r.action === 'modifier') this.ouvrirEditeur(r.niveau);
    else if (r.action === 'jouer') void this.lancerPerso(r.niveau.level, { index: -1, retour: rafraichir, menuLabel: 'Menu' });
    else rafraichir();
  }

  /** Traite `#n=<code>` (niveau dans le lien) ou `#en-ligne=<id>` puis efface le fragment pour qu'un rechargement ne recommence pas. */
  private async ouvrirLien(): Promise<void> {
    const brut = location.hash;
    if (!/^#(n|en-ligne)=/.test(brut)) return;
    history.replaceState(null, '', location.pathname + location.search);
    if (this.editeur) { this.editeur.demonter(); this.editeur = null; }
    const retour = (): void => this.accueil();
    const echec = (titre: string, erreurs: string[]): void => this.screens.error(titre, erreurs.join('\n'), [{ label: 'Retour', onClick: retour }]);
    const p = lireFragment(brut);
    if (!p) { echec('Lien invalide', ['Ce lien de niveau est incomplet ou abîmé : il a peut-être été coupé en route.']); return; }
    this.showroom?.stop();
    this.screens.loading('Ouverture du niveau partagé…');
    if (p.type === 'code') {
      const r = await decoderNiveau(p.code);
      if (r.ok) this.carteNiveau(r.level, r.level.auteur);
      else echec('Niveau partagé refusé', r.erreurs);
    } else if (p.type === 'en-ligne') {
      const r = await this.niveauxEnLigne.charger(p.id);
      if (r.ok) this.carteNiveau(r.valeur.level, r.valeur.meta.auteurPseudo, () => void this.niveauxEnLigne.compterPartie(p.id));
      else echec('Niveau en ligne indisponible', [r.message]);
    }
  }

  /** Carte « Niveau partagé » : jouer, enregistrer ou modifier une copie ; au retour de course on retrouve la carte. */
  private carteNiveau(level: Level, par: string, apresJouer?: () => void): void {
    let sauve: MonNiveau | null = null;
    const enregistrer = (): MonNiveau => (sauve ??= this.ajouterNiveau(level));
    const montrer = (): void => {
      this.screens.monter(carteNiveauPartage({
        level, par, persistent: this.persistent, enregistre: sauve !== null,
        onJouer: () => { apresJouer?.(); void this.lancerPerso(level, { index: -1, retour: montrer, menuLabel: 'Niveau partagé' }); },
        onEnregistrer: () => { enregistrer(); },
        onModifier: () => this.ouvrirEditeur(enregistrer()),
        onRetour: () => this.accueil(),
      }));
    };
    montrer();
  }

  private ouvrirEditeur(n: MonNiveau): void {
    const ed = new Editeur({
      store: this.store, persistent: this.persistent, id: n.id, level: n.level, touch: this.touch,
      onTester: (level) => void this.tester(ed, level),
      onPartager: (level) => this.partager(level, () => ed.demonter(), () => ed.monter($('ui'))),
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

  /** Recommence le niveau depuis le début (touche Retour arrière, pause ou résultats). */
  private recommencerCourse(): void {
    if (!this.session) return;
    if (this.session instanceof ZenSession) { void this.nouvelleRoute(); return; }
    this.onEscape = null;
    this.screens.clear();
    this.touchControls.show(this.touch || this.input.touchActive);
    // un record vient peut-être d'être battu : le fantôme prend la nouvelle course
    const fantome = this.current && this.fantomeAJour ? this.installerFantome(this.session, this.current.prepared.key) : null;
    this.fantomeAJour = false;
    this.session.restart();
    if (fantome) this.hud.annonce(fantome);
  }

  /** vrai quand l'arrivée vient d'enregistrer un nouveau fantôme */
  private fantomeAJour = false;

  private pauseRace(): void {
    if (!this.session) return;
    // onglet caché pendant le mode photo : on referme le mode photo, qui revient à la pause
    if (this.photo) { this.photo.quitter(); return; }
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    this.onEscape = () => this.reprendre();
    const zen = this.session;
    if (zen instanceof ZenSession) {
      this.screens.pauseZen({
        graine: zen.graine,
        onReprendre: () => { this.onEscape = null; this.reprendre(); },
        onNouvelleRoute: () => void this.nouvelleRoute(),
        onPhoto: () => this.modePhoto(),
        onMenu: () => { this.onEscape = null; this.quitterCourse(); },
      });
      this.ecouterManetteEnPause();
      return;
    }
    this.screens.pause({
      onReprendre: () => { this.onEscape = null; this.reprendre(); },
      onRecommencer: () => this.recommencerCourse(),
      onPhoto: () => this.modePhoto(),
      onMenu: () => { this.onEscape = null; this.quitterCourse(); },
      menuLabel: this.current?.contexte.menuLabel,
    });
    this.ecouterManetteEnPause();
  }

  /** Mode photo depuis la pause (ou « Revoir ») : HUD masqué, caméra libre ; Retour (ou Échap) revient à la pause, ou à `retour`. */
  private modePhoto(retour?: () => void, avant?: () => void): void {
    const session = this.session;
    if (!session?.enPause) return;
    avant?.();
    this.hud.show(false);
    const photo = new ModePhoto({
      canvas: $('scene') as HTMLCanvasElement,
      scene: session.scenePhoto(),
      rendre: (cam) => session.rendrePhoto(cam),
      partager: this.touch,
      toast: (m) => this.screens.toast(m),
      onQuitter: () => {
        this.photo = null; this.hud.show(true);
        if (this.session !== session) return;
        if (retour) retour(); else this.pauseRace();
      },
    });
    this.photo = photo;
    this.onEscape = () => photo.quitter();
    this.screens.monter(photo.el);
  }

  /** Pendant la pause, Start reprend la course et Select la recommence (la session ne lit plus la manette). */
  private ecouterManetteEnPause(): void {
    const session = this.session;
    const tour = (): void => {
      if (this.session !== session || !session?.enPause || !this.onEscape) return;
      this.manette.poll();
      const a = this.manette.consumeActions();
      if (a.pause) { const f = this.onEscape; this.onEscape = null; f(); return; }
      if (a.recommencer && !this.photo) { this.recommencerCourse(); return; }
      requestAnimationFrame(tour);
    };
    requestAnimationFrame(tour);
  }

  private arrivee(r: RaceResult): void {
    const cur = this.current;
    if (!cur || !(this.session instanceof GameSession)) return;
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    const record = this.store.submitRecord(cur.prepared.key, this.reglages.mode, {
      score: r.score, temps: r.time, voiture: this.voitureCourse(), meilleurDrift: r.bestDrift, date: new Date().toISOString().slice(0, 10),
    });
    // nouveau record : sa course devient le fantôme de ce niveau
    const replayRecord = record ? this.session.replay() : null;
    if (replayRecord) {
      this.store.saveFantome(cur.prepared.key, this.reglages.mode, { voiture: this.voitureCourse(), replay: versBase64(replayRecord), score: r.score });
      this.fantomeAJour = true;
    }
    const next = cur.index >= 0 && cur.index + 1 < NIVEAUX_OFFICIELS.length ? cur.index + 1 : -1;
    // Non connecté : clés locales, 1 par arrivée, +1 si nouveau record local (une seule fois par arrivée, pas à chaque retour d'écran).
    // Connecté : les clés du compte sont créditées par le serveur en réponse à l'envoi du score (voir envoyerScore).
    let gainLocal: GainCourse | null = null;
    let gains: ZoneGains | null = null;
    if (this.prog().source === 'local') {
      const g = gagnerCourse(this.progression, record);
      this.progression = g.progression;
      this.store.saveProgression(this.progression);
      gainLocal = g.gain;
    } else {
      gains = zoneGains();
    }
    const course = { replay: this.session.replay(), level: cur.prepared.level };
    const enLigne = this.envoyerScore(cur.prepared.key, r, course, gains, () => this.caisses(montrer));
    const montrer = (): void => {
      gains?.majTotal(this.prog().progression.cles);
      this.screens.resultats({
        result: r, record, persistent: this.persistent,
        niveau: titreNiveau(cur.index, cur.prepared.level.nom),
        seuils: cur.index >= 0 ? SEUILS_MEDAILLES[NIVEAUX_OFFICIELS[cur.index].id] : undefined,
        cles: gainLocal ? { ...gainLocal, total: this.progression.cles } : undefined,
        gainsEnLigne: gains?.el,
        onCaisses: () => this.caisses(montrer),
        onRecommencer: () => this.recommencerCourse(),
        onSuivant: next >= 0 ? () => void this.lancer(next) : null,
        onMenu: () => this.quitterCourse(),
        menuLabel: cur.contexte.menuLabel,
        onPartager: () => void this.partagerCarte(r, titreNiveau(cur.index, cur.prepared.level.nom), record, cur.index),
        onRevoir: () => this.revoir(titreNiveau(cur.index, cur.prepared.level.nom), montrer),
        enLigne,
      });
    };
    montrer();
  }

  /** « Revoir sa course » depuis les résultats : la course rejouée comme un film ; `retour` réaffiche les résultats. */
  private revoir(titre: string, retour: () => void): void {
    const s = this.session;
    if (!(s instanceof GameSession)) return;
    this.screens.loading('Préparation du film de ta course…');
    window.setTimeout(() => {
      if (this.session !== s) return;
      if (!s.lancerFilm()) { retour(); this.screens.toast('Cette course ne peut pas être rejouée.'); return; }
      const quitter = (): void => { this.onEscape = null; s.arreterFilm(); this.hud.show(false); retour(); };
      const afficher = (): void => {
        this.onEscape = quitter;
        this.screens.monter(ecranRevoir({
          titre, lecteur: s,
          onPhoto: () => this.modePhoto(() => { s.reglerFilm({ photo: false }); afficher(); }, () => s.reglerFilm({ photo: true })),
          onQuitter: quitter,
        }));
      };
      afficher();
    }, 30);
  }

  /** Carte de score : capture de la course (vue de trois quarts), niveau, score, médaille, voiture ; partagée ou téléchargée. */
  private partageEnCours = false;
  private async partagerCarte(r: RaceResult, niveau: string, record: boolean, index: number): Promise<void> {
    const s = this.session;
    if (!(s instanceof GameSession) || this.partageEnCours) return;
    this.partageEnCours = true;
    try {
      await document.fonts?.load("800 40px 'Baloo 2'").catch(() => undefined);
      const scene = s.scenePhoto();
      const o = orbiteDepuis(scene);
      // rendu et copie dans la même tâche : le tampon WebGL n'est lisible que juste après le rendu
      s.rendrePhoto(camOrbite(scene, { lacet: o.lacet + 0.75, tangage: 0.2, dist: 7.5 }));
      const src = $('scene') as HTMLCanvasElement;
      const capture = document.createElement('canvas');
      capture.width = src.width; capture.height = src.height;
      capture.getContext('2d')?.drawImage(src, 0, 0);
      s.rendrePhoto(null);
      const voiture = this.voitureCourse();
      const seuils = index >= 0 ? SEUILS_MEDAILLES[NIVEAUX_OFFICIELS[index].id] : undefined;
      const carte = dessinerCarte(capture, {
        niveau, score: r.score, meilleurDrift: r.bestDrift, temps: r.time,
        voiture: CARS[voiture].nom, livree: skinDef(voiture, skinChoisie(this.reglages.skins, voiture)).nom, mode: MODE_NOMS[this.reglages.mode],
        medaille: seuils ? medaille(r.score, seuils) : null, record, lien: SITE_URL,
      });
      const blob = await new Promise<Blob | null>((ok) => carte.toBlob(ok, 'image/png'));
      if (!blob) throw new Error('carte vide');
      const msg = await enregistrerImage(blob, nomCarte(niveau), this.touch);
      if (msg) this.screens.toast('Carte de score enregistrée');
    } catch {
      this.screens.toast('La carte de score n\'a pas pu être créée');
    } finally {
      this.partageEnCours = false;
    }
  }

  /** Bloc « classement en ligne » des résultats : envoi en tâche de fond, l'écran n'attend jamais le réseau. */
  private envoyerScore(cle: string, r: RaceResult, course: { replay: Uint8Array | null; level: Level }, gains: ZoneGains | null, onCaisses: () => void): HTMLElement | null {
    if (!cleEnLigne(cle)) { gains?.note('Pas de clé pour ce niveau : il n\'a pas de classement en ligne.'); return null; }
    const zone = zoneEnLigne();
    const e = this.compte.etat;
    if (e.statut !== 'connecte') {
      zone.invite('Connecte-toi pour apparaître au classement.', () => this.ecranCompte(this.terminerCourse()));
    } else if (!e.pseudo) {
      zone.invite('Choisis un pseudo pour apparaître au classement.', () => this.ecranCompte(this.terminerCourse()));
    } else {
      zone.envoi();
      gains?.envoi();
      void this.classement.soumettreScore({
        niveau: cle, mode: this.reglages.mode, score: r.score, temps: r.time, voiture: this.voitureCourse(), meilleurDrift: r.bestDrift,
        // replay : le serveur rejoue la course pour vérifier le score
        ...(course.replay ? { course: { replay: course.replay, level: course.level } } : {}),
      }).then((res) => {
        zone.resultat(res);
        // échec (par exemple jeu et serveur de versions différentes) : une mise à jour est peut-être publiée
        if (!res.ok) void this.miseAJour.verifier();
        if (gains) this.clesApresEnvoi(res, e.id, gains, onCaisses);
      });
    }
    return zone.el;
  }

  /** Clés du compte après l'envoi d'un score : le serveur les a créditées (ou non : hors ligne, limite de débit) ; on affiche et on met à jour l'état. */
  private clesApresEnvoi(res: Resultat<RangEnLigne>, id: string, gains: ZoneGains, onCaisses: () => void): void {
    if (!res.ok) { gains.note(res.message === MSG_INDISPONIBLE ? 'Hors ligne : les clés de cette arrivée ne sont pas créditées.' : `Clés non créditées : ${res.message}`); return; }
    const { clesGagnees, clesRecord, cles } = res.valeur;
    if (clesGagnees === undefined || cles === undefined) { gains.note('Clés du compte indisponibles pour le moment.'); return; }
    if (this.compteProg?.id === id) {
      this.compteProg = { ...this.compteProg, progression: { ...this.compteProg.progression, cles } };
      this.store.saveProgressionCompte(this.compteProg);
    }
    gains.gain(gainServeur(clesGagnees, clesRecord ?? 0, cles), onCaisses);
    // état du compte pas encore lu (ou copie hors ligne) : on le relit pour connaître aussi les livrées
    if (this.compteProg?.id !== id || this.compteProg.synchro !== 'ok') void this.synchroProgression();
  }

  /** Ferme la course et renvoie l'écran où retourner. */
  /** Voiture de la course en cours : celle du Garage, ou celle imposée par le défi du jour. */
  private voitureCourse(): CarId {
    return this.current?.contexte.voiture ?? this.reglages.voiture;
  }

  /** réglages de la course en cours (une copie quand la voiture est imposée) */
  private reglagesCourse: Reglages | null = null;

  private terminerCourse(): () => void {
    // caméra et son changés en course (touches C, M) : gardés aussi quand la course avait sa copie des réglages
    const rc = this.reglagesCourse;
    if (rc && rc !== this.reglages) { this.reglages.camera = rc.camera; this.reglages.muet = rc.muet; }
    this.reglagesCourse = null;
    this.save();
    this.keyboard.capture = false;
    this.touchControls.show(false);
    const zen = this.session instanceof ZenSession;
    this.session?.dispose();
    this.session = null;
    const retour = this.current?.contexte.retour ?? (zen ? () => this.accueil() : () => this.niveaux());
    this.current = null;
    return retour;
  }

  private quitterCourse(): void {
    this.terminerCourse()();
  }
}
