import * as THREE from 'three';
import { loadAssets, type Assets } from './render/assets';
import { QualityManager } from './render/quality';
import { Showroom } from './render/showroom';
import { AudioEngine } from './audio/audio';
import { KeyboardInput } from './input/keyboard';
import { TouchControls } from './input/touch';
import { InputManager } from './input/manager';
import { Store, safeStorage, cleNiveauPerso, type Reglages, type MonNiveau } from './storage/store';
import { Hud } from './game/hud';
import { GameSession, type DebugHook } from './game/session';
import { prepareLevel, type PreparedLevel } from './game/prepare';
import { forcerDecor } from './game/decorUrl';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from './levels';
import { Screens, levelSummary, type NiveauCarte } from './ui/screens';
import { formatDistance } from './ui/format';
import { skinChoisie, choisirSkin } from './core/skins';
import { ECONOMIE, gagnerCourse, ouvrirCaisse, skinsAutorises, type GainCourse, type Progression } from './core/economie';
import { appliquerOuvertureServeur, choisirProgression, doitImporter, gainServeur, type EtatProgressionCompte, type ProgressionActive } from './core/progressionCompte';
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
import { decoderNiveau } from './core/level/encode';
import { lireFragment } from './share/lien';
import { ouvrirPartage, ouvrirImport, carteNiveauPartage } from './ui/partage';
import { panneauEnLigne } from './ui/enligne';
import { ecranCompte } from './ui/compte';
import { ecranClassement, zoneEnLigne, textePlace } from './ui/classement';
import { ecranCaisses, type ResultatOuverture } from './ui/caisses';
import { zoneGains, type ZoneGains } from './ui/gains';

/** D'où vient la course : `index` ≥ 0 pour un niveau officiel, `retour` ramène à l'écran d'origine. */
interface Contexte { index: number; retour: () => void; menuLabel: string }

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
  private readonly input = new InputManager(this.keyboard, this.touchControls);
  private readonly touch = matchMedia('(pointer: coarse)').matches;
  private session: GameSession | null = null;
  private showroom: Showroom | null = null;
  private current: { index: number; prepared: PreparedLevel; contexte: Contexte } | null = null;
  private editeur: Editeur | null = null;
  private onEscape: (() => void) | null = null;
  private readonly compte = new CompteService(clientParDefaut);
  private readonly classement = new ClassementService(clientParDefaut);
  private readonly niveauxEnLigne = new NiveauxEnLigneService(clientParDefaut);
  private readonly progressionEnLigne = new ProgressionEnLigne(clientParDefaut);

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
    // clés et livrées gagnées ; une livrée choisie mais verrouillée (données modifiées à la main) retombe sur « unie »
    this.progression = this.store.loadProgression(this.reglages.skins);
    // si une progression de compte est gardée sur l'appareil, le joueur est peut-être reconnecté dans un instant : on attend de savoir laquelle fait foi
    if (this.store.idProgressionCompte() === null) this.appliquerSkinsAutorises();
    this.audio.setVolume(this.reglages.volume);
    this.audio.setMuted(this.reglages.muet);
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
      if (e.code !== 'Backspace' || e.repeat || !this.session?.enPause || (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) return;
      e.preventDefault();
      this.recommencerCourse();
    });
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
      // lien de partage : à l'ouverture de la page, puis si le joueur colle un autre lien dans la barre d'adresse
      void this.ouvrirLien();
      window.addEventListener('hashchange', () => { if (!this.session) void this.ouvrirLien(); });
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
    if (JSON.stringify(autorisees) !== JSON.stringify(this.reglages.skins)) { this.reglages.skins = autorisees; this.save(); }
  }

  private memoriserCompteProg(e: EtatProgressionCompte): void {
    this.compteProg = e;
    this.store.saveProgressionCompte(e);
  }

  /**
   * Lit la progression du compte (créée avec les 3 clés offertes la première fois) et, si l'appareil n'a jamais été repris,
   * y verse UNE fois la progression locale. Ne lève jamais ; hors ligne on garde la dernière valeur connue, en lecture seule.
   */
  private async synchroProgression(): Promise<void> {
    const e = this.compte.etat;
    if (e.statut !== 'connecte' || !e.pseudo) return;
    const id = e.id, jeton = ++this.jetonSynchro;
    const actuel = (): boolean => jeton === this.jetonSynchro;
    let r = await this.progressionEnLigne.charger();
    if (!actuel()) return;
    if (r.ok && doitImporter(r.valeur)) {
      const i = await this.progressionEnLigne.importerLocale(this.progression);
      if (!actuel()) return;
      if (i.ok) r = i;
    }
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
      compte: this.libelleCompte(),
      onCompte: () => this.ecranCompte(() => this.accueil()),
      onJouer: () => this.niveaux(),
      onGarage: () => this.garage(() => this.accueil()),
      onCaisses: () => this.caisses(() => this.accueil()),
      onEditeur: () => this.hubEditeur(),
      onReglages: () => this.reglagesEcran(() => this.accueil()),
    });
  }

  private niveaux(): void {
    this.showroom?.stop();
    const connecte = this.compte.etat.statut === 'connecte';
    const attente = textePlace(connecte ? 'chargement' : 'deconnecte');
    const cartes = NIVEAUX_OFFICIELS.map((n) => {
      const s = levelSummary(n.data);
      return {
        nom: s?.nom ?? n.id,
        detail: s ? `${formatDistance(s.longueur)} · ${s.theme} · ${s.ambiance === 'jour' ? 'Jour' : 'Coucher de soleil'}` : '',
        place: attente,
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
      this.showroom.start();
    }
    this.screens.garage({
      voiture: this.reglages.voiture,
      couleur: this.reglages.couleur,
      skins: this.reglages.skins,
      progression: this.prog().progression,
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
      onRetour: () => { this.showroom?.stop(); retour(); },
    });
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
    const r = await this.progressionEnLigne.ouvrirCaisse();
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
      onEquiper: (x) => {
        this.reglages.voiture = x.car;
        this.reglages.skins = choisirSkin(this.reglages.skins, x.car, x.skin);
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

  /** Montre la livrée gagnée dans le showroom, derrière la fiche de révélation ; `null` l'arrête. */
  private apercuCaisse(x: Objet | null): void {
    if (!this.showroom) return;
    if (!x) { this.showroom.stop(); return; }
    this.showroom.setCar(x.car, this.reglages.couleur, x.skin);
    this.showroom.start();
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
    const res = prepareLevel(key, forcerDecor(raw, location.search));
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
    this.onEscape = null;
    this.screens.clear();
    this.touchControls.show(this.touch || this.input.touchActive);
    this.session.restart();
  }

  private pauseRace(): void {
    if (!this.session) return;
    this.session.pause();
    this.save();
    this.touchControls.show(false);
    this.onEscape = () => this.reprendre();
    this.screens.pause({
      onReprendre: () => { this.onEscape = null; this.reprendre(); },
      onRecommencer: () => this.recommencerCourse(),
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
    const enLigne = this.envoyerScore(cur.prepared.key, r, gains, () => this.caisses(montrer));
    const montrer = (): void => {
      gains?.majTotal(this.prog().progression.cles);
      this.screens.resultats({
        result: r, record, persistent: this.persistent,
        cles: gainLocal ? { ...gainLocal, total: this.progression.cles } : undefined,
        gainsEnLigne: gains?.el,
        onCaisses: () => this.caisses(montrer),
        onRecommencer: () => this.recommencerCourse(),
        onSuivant: next >= 0 ? () => void this.lancer(next) : null,
        onMenu: () => this.quitterCourse(),
        menuLabel: cur.contexte.menuLabel,
        enLigne,
      });
    };
    montrer();
  }

  /** Bloc « classement en ligne » des résultats : envoi en tâche de fond, l'écran n'attend jamais le réseau. */
  private envoyerScore(cle: string, r: RaceResult, gains: ZoneGains | null, onCaisses: () => void): HTMLElement | null {
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
        niveau: cle, mode: this.reglages.mode, score: r.score, temps: r.time, voiture: this.reglages.voiture, meilleurDrift: r.bestDrift,
      }).then((res) => {
        zone.resultat(res);
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
