import type { Environnement, Level, TypeObjet } from '../core/level/types';
import { LIMITES, ENVIRONNEMENTS } from '../core/level/types';
import { THEMES } from '../core/env/themes';
import { validateLevel } from '../core/level/validate';
import { EditorDoc } from '../core/editor/history';
import { analyseLevel, type AnalyseNiveau } from '../core/editor/analyse';
import {
  addPoint, insertPoint, movePoint, setPoint, deletePoint, toggleBarrier, toggleClipping, addObjet, moveObjet, rotateObjet, deleteObjet,
  nearestPoint, nearestObjet, addLac, deleteLac, setNiveauLac, erreurContourLac, type CoteEdit,
} from '../core/editor/ops';
import type { TrackData } from '../core/track/buildTrack';
import type { Store } from '../storage/store';
import { h } from '../ui/screens';
import { icone } from './icones';
import {
  mondeVersEcran, ecranVersMonde, zoomAutour, deplacer, cadrer, bornesNiveau, choisirRoute, limiterDistance, type Vue2D,
} from './geom';
import { dessiner, rayonObjet, OBJETS } from './view2d';
import { dessinerProfil, plageHauteur, pointsProfil, choisirPointProfil, pxVersY, type ProfilVue } from './profil';
import { resumeValidation, type ResumeValidation } from './format';
import type { Outil, Selection } from './types';

export interface OptionsEditeur {
  store: Store;
  persistent: boolean;
  id: string;
  level: Level;
  touch: boolean;
  /** appelé après démontage de l'éditeur, avec le niveau à tester */
  onTester(level: Level): void;
  /** fenêtre « Partager » par-dessus l'éditeur (le niveau est valide) */
  onPartager(level: Level): void;
  onQuitter(): void;
}

const OUTILS: { id: Outil; nom: string; aide: string }[] = [
  { id: 'route', nom: 'Route', aide: 'Route' },
  { id: 'barrieres', nom: 'Barrières', aide: 'Barrières' },
  { id: 'clipping', nom: 'Clipping', aide: 'Zones de clipping' },
  { id: 'objets', nom: 'Objets', aide: 'Objets' },
  { id: 'lac', nom: 'Lac', aide: 'Lac' },
  { id: 'decor', nom: 'Décor', aide: 'Décor' },
  { id: 'infos', nom: 'Infos', aide: 'Infos' },
];

const TYPES_OBJETS: { id: TypeObjet; nom: string }[] = [
  { id: 'arbre', nom: 'Arbre' }, { id: 'sapin', nom: 'Sapin' }, { id: 'rocher', nom: 'Rocher' },
  { id: 'pneus', nom: 'Pneus' }, { id: 'barriere', nom: 'Barrière' }, { id: 'panneau', nom: 'Panneau' },
];
/** Nom d'un type d'objet dans le décor courant (« Sapin » devient « Cactus » dans le canyon…). */
const nomObjet = (env: Environnement, type: TypeObjet): string =>
  THEMES[env].nomsObjets[type] ?? TYPES_OBJETS.find((t) => t.id === type)!.nom;

const COTES: { id: CoteEdit; nom: string }[] = [{ id: 'gauche', nom: 'Gauche' }, { id: 'droite', nom: 'Droite' }, { id: 'ext', nom: 'Extérieur' }];

type Geste =
  | { t: 'pan' }
  | { t: 'attente'; x: number; y: number }
  | { t: 'pinch'; dist: number; cx: number; cy: number }
  | { t: 'point' | 'objet'; i: number; dx: number; dz: number; x: number; y: number; bouge: boolean }
  | { t: 'profil'; i: number; vue: ProfilVue };

const DELAI_SAUVEGARDE = 500;
const estSaisie = (t: EventTarget | null): boolean => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  return el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type);
};

/** Éditeur de niveaux : l'état (document, vue, sélection) survit à un démontage / remontage (test). */
export class Editeur {
  readonly doc: EditorDoc;
  private analyse: AnalyseNiveau;
  private fantome: TrackData | null = null;
  private vue: Vue2D | null = null;
  private selection: Selection = null;
  private outil: Outil = 'route';
  private typeObjet: TypeObjet = 'arbre';
  private cote: CoteEdit = 'ext';
  /** contour du lac en cours de tracé (outil « Lac ») */
  private lacBrouillon: { x: number; z: number }[] = [];
  private profilOuvert: boolean;
  private resume!: ResumeValidation;

  // DOM (recréé à chaque montage)
  private el: HTMLElement | null = null;
  private stage!: HTMLElement;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private profilCanvas!: HTMLCanvasElement;
  private profilCtx!: CanvasRenderingContext2D;
  private panneau!: HTMLElement;
  private barre!: HTMLElement;
  private btnAnnuler!: HTMLButtonElement;
  private btnRetablir!: HTMLButtonElement;
  private btnTester!: HTMLButtonElement;
  private btnPartager!: HTMLButtonElement;
  private etatSauvegarde!: HTMLElement;
  private outilsBtn = new Map<Outil, HTMLElement>();
  private majPanneau: (() => void)[] = [];
  private clePanneau = '';
  private observer: ResizeObserver | null = null;
  private w = 0;
  private h = 0;
  private wp = 0;
  private hp = 0;

  // interaction
  private readonly ptrs = new Map<number, { x: number; y: number }>();
  private geste: Geste | null = null;
  private profilGele: ProfilVue | null = null;
  private geleSlider = false;

  // planification
  private raf = 0;
  private analyseSale = true;
  private timerSauvegarde = 0;
  private etat: { type: 'ok' | 'attente' | 'erreur' | 'aucun'; msg?: string } = { type: 'aucun' };
  private toastTimer = 0;
  private monte = false;

  constructor(private readonly o: OptionsEditeur) {
    this.doc = new EditorDoc(o.level);
    this.analyse = analyseLevel(this.doc.level);
    this.profilOuvert = window.innerHeight >= 560;
    this.doc.onChange = () => this.surChangement();
  }

  get level(): Level { return this.doc.level; }

  // ───────────────────────── montage ─────────────────────────

  monter(root: HTMLElement): void {
    this.construire();
    root.replaceChildren(this.el!);
    this.monte = true;
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('pagehide', this.flush);
    document.addEventListener('visibilitychange', this.flush);
    this.observer = new ResizeObserver(() => this.redimensionner());
    this.observer.observe(this.stage);
    this.observer.observe(this.profilCanvas);
    this.redimensionner();
    this.analyseSale = true;
    this.planifier();
  }

  /** Enregistre ce qui est en attente et détache les écouteurs (l'état reste en mémoire). */
  demonter(): void {
    this.flush();
    this.monte = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.clearTimeout(this.toastTimer);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('pagehide', this.flush);
    document.removeEventListener('visibilitychange', this.flush);
    this.observer?.disconnect();
    this.observer = null;
    this.ptrs.clear();
    if ((this.geste && (this.geste.t === 'point' || this.geste.t === 'objet' || this.geste.t === 'profil')) || this.geleSlider) this.doc.endGesture();
    this.geste = null;
    this.geleSlider = false;
    this.profilGele = null;
    this.el = null;
  }

  private construire(): void {
    this.majPanneau = [];
    this.clePanneau = '';
    this.outilsBtn.clear();

    this.canvas = h('canvas', { class: 'ed-canvas' });
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.panneau = h('div', { class: 'ed-panel' });
    this.stage = h('div', { class: 'ed-stage' }, this.canvas, this.panneau);

    const tools = h('div', { class: 'ed-tools' }, ...OUTILS.map((t) => {
      const b = h('button', { class: 'ed-tool', title: t.aide, onclick: () => this.choisirOutil(t.id) }, icone(t.id), h('span', {}, t.nom));
      this.outilsBtn.set(t.id, b);
      return b;
    }));

    this.btnAnnuler = h('button', { class: 'ed-btn', title: 'Annuler (Ctrl+Z)', onclick: () => this.annuler() }, icone('annuler'), h('span', {}, 'Annuler'));
    this.btnRetablir = h('button', { class: 'ed-btn', title: 'Rétablir (Ctrl+Y)', onclick: () => this.retablir() }, icone('retablir'), h('span', {}, 'Rétablir'));
    this.btnTester = h('button', { class: 'ed-btn go', onclick: () => this.tester() }, icone('jouer'), h('span', {}, 'Tester'));
    this.btnPartager = h('button', { class: 'ed-btn', onclick: () => this.partager() }, icone('partager'), h('span', {}, 'Partager'));
    this.etatSauvegarde = h('span', { class: 'ed-save' });
    const top = h('div', { class: 'ed-top' },
      h('button', { class: 'ed-btn', title: 'Retour à Mes niveaux', onclick: () => this.quitter() }, icone('retour'), h('span', {}, 'Menu')),
      h('b', { class: 'ed-titre' }),
      h('div', { class: 'ed-grow' }),
      this.btnAnnuler, this.btnRetablir,
      h('button', { class: 'ed-btn', title: 'Recentrer la vue', onclick: () => this.recentrer() }, icone('recentrer'), h('span', {}, 'Recentrer')),
      this.etatSauvegarde,
      this.btnPartager,
      this.btnTester,
    );

    this.barre = h('div', { class: 'ed-bar', onclick: () => this.barre.classList.toggle('open') });

    this.profilCanvas = h('canvas', { class: 'ed-pcanvas' });
    this.profilCtx = this.profilCanvas.getContext('2d')!;
    this.profilCanvas.addEventListener('pointerdown', this.onProfilDown);
    this.profilCanvas.addEventListener('pointermove', this.onProfilMove);
    this.profilCanvas.addEventListener('pointerup', this.onProfilUp);
    this.profilCanvas.addEventListener('pointercancel', this.onProfilUp);
    const fleche = h('i', {}, this.profilOuvert ? '▾' : '▸');
    const profil = h('div', { class: 'ed-profil' + (this.profilOuvert ? '' : ' closed') },
      h('button', {
        class: 'ed-ptoggle',
        onclick: () => {
          this.profilOuvert = !this.profilOuvert;
          profil.classList.toggle('closed', !this.profilOuvert);
          fleche.textContent = this.profilOuvert ? '▾' : '▸';
          this.redimensionner();
        },
      }, icone('profil'), 'Profil en long', fleche),
      this.profilCanvas,
    );

    this.el = h('div', { class: 'ed' }, top, h('div', { class: 'ed-main' }, tools, this.stage), this.barre, profil);
  }

  private redimensionner(): void {
    if (!this.el) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = this.stage.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const premier = this.w === 0;
    this.w = Math.round(r.width); this.h = Math.round(r.height);
    this.canvas.width = Math.round(this.w * dpr); this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const pr = this.profilCanvas.getBoundingClientRect();
    this.wp = Math.round(pr.width); this.hp = Math.round(pr.height);
    if (this.wp > 0 && this.hp > 0) {
      this.profilCanvas.width = Math.round(this.wp * dpr); this.profilCanvas.height = Math.round(this.hp * dpr);
      this.profilCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    if (!this.vue || premier) this.recentrer(false);
    this.planifier();
  }

  private recentrer(anim = true): void {
    void anim;
    if (this.w === 0) return;
    this.vue = cadrer(bornesNiveau(this.doc.level, this.analyse.track), this.w, this.h, this.o.touch ? 40 : 70);
    this.planifier();
  }

  // ───────────────────────── état ─────────────────────────

  private surChangement(): void {
    this.analyseSale = true;
    this.etat = { type: 'attente' };
    window.clearTimeout(this.timerSauvegarde);
    this.timerSauvegarde = window.setTimeout(() => this.sauver(), DELAI_SAUVEGARDE);
    this.planifier();
  }

  private planifier(): void {
    if (this.raf || !this.monte) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this.frame(); });
  }

  private frame(): void {
    if (!this.el) return;
    if (this.analyseSale) {
      this.analyseSale = false;
      this.analyse = analyseLevel(this.doc.level);
      if (this.analyse.track) this.fantome = this.analyse.track;
      this.resume = resumeValidation(this.doc.level, this.analyse);
      this.normaliserSelection();
      this.majInterface();
    }
    if (this.vue && this.w > 0) {
      dessiner(this.ctx, {
        vue: this.vue, w: this.w, h: this.h, level: this.doc.level, analyse: this.analyse, fantome: this.fantome,
        selection: this.selection, outil: this.outil, rayon: this.rayonPoignee, brouillonLac: this.lacBrouillon,
      });
    }
    if (this.profilOuvert && this.wp > 0 && this.hp > 0) {
      dessinerProfil(this.profilCtx, this.wp, this.hp, {
        level: this.doc.level, track: this.analyse.track, vue: this.vueProfil(), selection: this.selection, rayon: this.rayonPoignee,
      });
    }
  }

  private get rayonPoignee(): number { return this.o.touch ? 15 : 9; }
  private get rayonTouche(): number { return this.o.touch ? 28 : 15; }

  private vueProfil(): ProfilVue | null {
    if (this.profilGele) return this.profilGele;
    const t = this.analyse.track;
    if (!t) return null;
    const { ymin, ymax } = plageHauteur(this.doc.level, t);
    return { w: this.wp, h: this.hp, longueur: t.length, ymin, ymax };
  }

  private normaliserSelection(): void {
    const s = this.selection;
    if (!s) return;
    const n = s.kind === 'point' ? this.doc.level.route.length : this.doc.level.objets.length;
    if (s.i >= n) this.selection = null;
  }

  private majInterface(): void {
    const l = this.doc.level;
    (this.el!.querySelector('.ed-titre') as HTMLElement).textContent = l.nom.trim() || 'Sans nom';
    this.btnAnnuler.disabled = !this.doc.canUndo;
    this.btnRetablir.disabled = !this.doc.canRedo;
    this.btnTester.classList.toggle('off', !this.analyse.ok);
    this.btnTester.title = this.analyse.ok ? 'Tester le niveau (voiture et mode courants)' : `Impossible de tester : ${this.resume.messages[0] ?? 'niveau invalide'}`;

    this.btnPartager.classList.toggle('off', !this.analyse.ok);
    this.btnPartager.title = this.analyse.ok ? 'Partager : lien, code, fichier .json ou publication en ligne' : `Impossible de partager : ${this.resume.messages[0] ?? 'niveau invalide'}`;

    const r = this.resume;
    this.barre.classList.toggle('ko', !r.ok);
    this.barre.replaceChildren(
      h('span', { class: 'msg' }, r.texte),
      h('span', { class: 'cnt' },
        h('span', { class: r.depasse.points ? 'bad' : '' }, `points ${r.compteurs.points}`),
        h('span', { class: r.depasse.objets ? 'bad' : '' }, `objets ${r.compteurs.objets}`),
        h('span', { class: r.depasse.longueur ? 'bad' : '' }, `longueur ${r.compteurs.longueur}`),
      ),
      ...(r.messages.length > 1 ? [h('ul', { class: 'all' }, ...r.messages.map((m) => h('li', {}, m)))] : []),
    );
    this.majEtatSauvegarde();
    this.rafraichirOutils();
    this.panneauSiBesoin();
    for (const f of this.majPanneau) f();
  }

  private majEtatSauvegarde(): void {
    const e = this.etat;
    const el = this.etatSauvegarde;
    el.className = 'ed-save ' + e.type;
    if (!this.o.persistent) { el.textContent = 'Stockage indisponible'; el.className = 'ed-save erreur'; return; }
    el.textContent = e.type === 'ok' ? '✔ Enregistré' : e.type === 'attente' ? 'Enregistrement…' : e.type === 'erreur' ? `Non enregistré : ${e.msg}` : 'Enregistré';
    el.title = el.textContent;
  }

  private rafraichirOutils(): void {
    for (const [id, b] of this.outilsBtn) b.classList.toggle('on', id === this.outil);
  }

  // ───────────────────────── sauvegarde ─────────────────────────

  private sauver(): void {
    window.clearTimeout(this.timerSauvegarde);
    this.timerSauvegarde = 0;
    const v = validateLevel(this.doc.level);
    if (!v.ok) { this.etat = { type: 'erreur', msg: v.erreurs[0] }; }
    else {
      this.o.store.saveNiveau({ id: this.o.id, level: v.level, maj: new Date().toISOString() });
      this.etat = { type: 'ok' };
    }
    if (this.el) this.majEtatSauvegarde();
  }

  private readonly flush = (): void => {
    if (this.timerSauvegarde) this.sauver();
  };

  // ───────────────────────── actions ─────────────────────────

  private annuler(): void { if (!this.geste && this.doc.undo()) this.planifier(); }
  private retablir(): void { if (!this.geste && this.doc.redo()) this.planifier(); }

  private quitter(): void {
    this.demonter();
    this.o.onQuitter();
  }

  private tester(): void {
    if (!this.analyse.ok) { this.toast(`Impossible de tester : ${this.resume.messages[0] ?? 'niveau invalide'}`); return; }
    this.demonter();
    this.o.onTester(structuredClone(this.doc.level));
  }

  private partager(): void {
    if (!this.analyse.ok) { this.toast(`Impossible de partager : ${this.resume.messages[0] ?? 'niveau invalide'}`); return; }
    this.flush();
    this.o.onPartager(structuredClone(this.doc.level));
  }

  private choisirOutil(o: Outil): void {
    this.outil = o;
    if (o !== 'lac') this.lacBrouillon = [];
    if ((o === 'barrieres' || o === 'clipping' || o === 'lac' || o === 'decor' || o === 'infos') && this.selection) this.selection = null;
    if (o === 'route' && this.selection?.kind === 'objet') this.selection = null;
    if (o === 'objets' && this.selection?.kind === 'point') this.selection = null;
    this.rafraichirOutils();
    this.panneauSiBesoin();
    for (const f of this.majPanneau) f();
    this.planifier();
  }

  private toast(msg: string): void {
    if (!this.el) return;
    this.el.querySelector('.toast')?.remove();
    const t = h('div', { class: 'toast' }, msg);
    this.el.append(t);
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.remove(), 2600);
  }

  private terminerLac(): void {
    const erreur = erreurContourLac(this.doc.level, this.lacBrouillon);
    if (erreur) { this.toast(erreur); return; }
    const contour = this.lacBrouillon;
    this.doc.apply((l) => { addLac(l, contour); });
    this.lacBrouillon = [];
    for (const f of this.majPanneau) f();
    this.planifier();
  }

  private supprimerSelection(): void {
    const s = this.selection;
    if (!s) return;
    if (s.kind === 'point') {
      let ok = true;
      this.doc.apply((l) => { ok = deletePoint(l, s.i); });
      if (!ok) { this.toast('Il faut au moins 2 points.'); return; }
    } else {
      this.doc.apply((l) => deleteObjet(l, s.i));
    }
    this.selection = null;
    this.panneauSiBesoin();
    this.planifier();
  }

  private selectionner(s: Selection): void {
    this.selection = s;
    this.panneauSiBesoin();
    for (const f of this.majPanneau) f();
    this.planifier();
  }

  // ───────────────────────── clavier ─────────────────────────

  private readonly onKey = (e: KeyboardEvent): void => {
    const saisie = estSaisie(e.target);
    if (e.key === 'Escape') {
      if (saisie) { (e.target as HTMLElement).blur(); return; }
      if (this.geste && (this.geste.t === 'point' || this.geste.t === 'objet' || this.geste.t === 'profil')) { this.doc.cancelGesture(); this.geste = null; this.profilGele = null; }
      else this.selectionner(null);
      return;
    }
    if (saisie) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && e.code === 'KeyZ') { e.preventDefault(); if (e.shiftKey) this.retablir(); else this.annuler(); }
    else if (mod && !e.altKey && e.code === 'KeyY') { e.preventDefault(); this.retablir(); }
    else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); this.supprimerSelection(); }
  };

  // ───────────────────────── souris / toucher (vue de dessus) ─────────────────────────

  private pos(e: PointerEvent, el: HTMLElement = this.canvas): { x: number; y: number } {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private monde(x: number, y: number): { x: number; z: number } {
    return ecranVersMonde(this.vue!, this.w, this.h, x, y);
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (!this.vue) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const p = this.pos(e);
    this.ptrs.set(e.pointerId, p);
    (document.activeElement as HTMLElement | null)?.blur?.();

    if (this.ptrs.size >= 2) {
      // deuxième doigt : on abandonne le geste en cours et on passe au pincement
      if (this.geste && (this.geste.t === 'point' || this.geste.t === 'objet')) this.doc.cancelGesture();
      const [a, b] = [...this.ptrs.values()];
      this.geste = { t: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) { this.geste = { t: 'pan' }; this.canvas.style.cursor = 'grabbing'; return; }

    const w = this.monde(p.x, p.y);
    const l = this.doc.level;
    if (this.outil === 'route') {
      const i = nearestPoint(l, w.x, w.z, this.rayonTouche / this.vue.scale);
      if (i >= 0) {
        this.selectionner({ kind: 'point', i });
        this.doc.beginGesture();
        this.geste = { t: 'point', i, dx: l.route[i].x - w.x, dz: l.route[i].z - w.z, x: p.x, y: p.y, bouge: false };
        return;
      }
    } else if (this.outil === 'objets') {
      const i = this.objetSous(w.x, w.z);
      if (i >= 0) {
        this.selectionner({ kind: 'objet', i });
        this.doc.beginGesture();
        this.geste = { t: 'objet', i, dx: l.objets[i].x - w.x, dz: l.objets[i].z - w.z, x: p.x, y: p.y, bouge: false };
        return;
      }
    }
    this.geste = { t: 'attente', x: p.x, y: p.y };
  };

  private objetSous(x: number, z: number): number {
    const l = this.doc.level;
    let best = -1, bd = Infinity;
    l.objets.forEach((o, i) => {
      const d = Math.hypot(o.x - x, o.z - z) * this.vue!.scale;
      const r = Math.max(rayonObjet(o.type, this.vue!.scale), this.rayonTouche * 0.7);
      if (d <= r && d < bd) { bd = d; best = i; }
    });
    return best;
  }

  private readonly onMove = (e: PointerEvent): void => {
    if (!this.vue) return;
    const prev = this.ptrs.get(e.pointerId);
    const p = this.pos(e);
    if (!prev) { this.survol(p); return; }
    this.ptrs.set(e.pointerId, p);
    const g = this.geste;
    if (!g) return;
    if (g.t === 'pinch') {
      if (this.ptrs.size < 2) return;
      const [a, b] = [...this.ptrs.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      let v = deplacer(this.vue, cx - g.cx, cy - g.cy);
      v = zoomAutour(v, this.w, this.h, cx, cy, dist / g.dist);
      this.vue = v;
      g.dist = dist; g.cx = cx; g.cy = cy;
      this.planifier();
    } else if (g.t === 'pan') {
      this.vue = deplacer(this.vue, p.x - prev.x, p.y - prev.y);
      this.planifier();
    } else if (g.t === 'attente') {
      if (Math.hypot(p.x - g.x, p.y - g.y) > (this.o.touch ? 10 : 5)) {
        this.geste = { t: 'pan' };
        this.canvas.style.cursor = 'grabbing';
        this.vue = deplacer(this.vue, p.x - g.x, p.y - g.y);
        this.planifier();
      }
    } else if (g.t === 'point' || g.t === 'objet') {
      if (!g.bouge && Math.hypot(p.x - g.x, p.y - g.y) < 4) return;
      g.bouge = true;
      const w = this.monde(p.x, p.y);
      const x = w.x + g.dx, z = w.z + g.dz;
      if (g.t === 'point') this.doc.updateGesture((l) => movePoint(l, g.i, x, z));
      else this.doc.updateGesture((l) => moveObjet(l, g.i, x, z));
    }
  };

  private survol(p: { x: number; y: number }): void {
    if (this.geste) return;
    const w = this.monde(p.x, p.y);
    const l = this.doc.level;
    const sur = (this.outil === 'route' && nearestPoint(l, w.x, w.z, this.rayonTouche / this.vue!.scale) >= 0) ||
      (this.outil === 'objets' && this.objetSous(w.x, w.z) >= 0);
    this.canvas.style.cursor = sur ? 'move' : 'crosshair';
  }

  private readonly onUp = (e: PointerEvent): void => {
    const g = this.geste;
    const p = this.pos(e);
    this.ptrs.delete(e.pointerId);
    this.canvas.style.cursor = 'crosshair';
    if (!g) return;
    if (g.t === 'pinch') { if (this.ptrs.size === 0) this.geste = null; return; }
    if (this.ptrs.size > 0) return;
    this.geste = null;
    if (g.t === 'point' || g.t === 'objet') { this.doc.endGesture(); this.planifier(); return; }
    if (g.t === 'attente' && e.type === 'pointerup') this.clic(p.x, p.y);
  };

  private readonly onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    if (!this.vue) return;
    const p = this.pos(e as unknown as PointerEvent);
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    this.vue = zoomAutour(this.vue, this.w, this.h, p.x, p.y, Math.exp(-dy * 0.0016));
    this.planifier();
  };

  /** Clic (sans glisser) sur l'espace vide ou la route selon l'outil. */
  private clic(sx: number, sy: number): void {
    const v = this.vue!;
    const w = this.monde(sx, sy);
    const l = this.doc.level;
    const marge = Math.max(3, (this.o.touch ? 16 : 10) / v.scale);
    if (this.outil === 'route') {
      const sur = choisirRoute(l, this.analyse.track, w.x, w.z, marge);
      if (sur) {
        const a = l.route[sur.seg], b = l.route[sur.seg + 1];
        if (Math.hypot(sur.x - a.x, sur.z - a.z) < 6 || Math.hypot(sur.x - b.x, sur.z - b.z) < 6) { this.toast('Trop près d\'un point existant.'); return; }
        if (l.route.length >= LIMITES.pointsMax) { this.toast(`Maximum ${LIMITES.pointsMax} points.`); return; }
        this.doc.apply((d) => insertPoint(d, sur.seg, sur.x, sur.z));
        this.selectionner({ kind: 'point', i: sur.seg + 1 });
      } else {
        if (l.route.length >= LIMITES.pointsMax) { this.toast(`Maximum ${LIMITES.pointsMax} points.`); return; }
        const last = l.route[l.route.length - 1];
        const q = limiterDistance(last, w.x, w.z, LIMITES.ecartMin + 1, LIMITES.ecartMax - 5);
        this.doc.apply((d) => addPoint(d, q.x, q.z));
        this.selectionner({ kind: 'point', i: l.route.length });
      }
    } else if (this.outil === 'barrieres') {
      const sur = choisirRoute(l, this.analyse.track, w.x, w.z, marge);
      if (sur) this.doc.apply((d) => toggleBarrier(d, sur.seg, this.cote));
    } else if (this.outil === 'clipping') {
      const sur = choisirRoute(l, this.analyse.track, w.x, w.z, marge);
      if (!sur) return;
      const avant = (l.clipping ?? []).length;
      this.doc.apply((d) => toggleClipping(d, sur.seg, sur.cote));
      if ((this.doc.level.clipping ?? []).length === avant && avant >= LIMITES.clippingMax) this.toast(`Maximum ${LIMITES.clippingMax} zones de clipping.`);
    } else if (this.outil === 'objets') {
      if (l.objets.length >= LIMITES.objetsMax) { this.toast(`Maximum ${LIMITES.objetsMax} objets.`); return; }
      let idx = -1;
      this.doc.apply((d) => { idx = addObjet(d, this.typeObjet, w.x, w.z, 0); });
      if (idx >= 0) this.selectionner({ kind: 'objet', i: idx });
    } else if (this.outil === 'lac') {
      if (this.lacBrouillon.length >= LIMITES.eauPointsMax) { this.toast(`Maximum ${LIMITES.eauPointsMax} points par lac.`); return; }
      this.lacBrouillon.push({ x: Math.round(w.x * 10) / 10, z: Math.round(w.z * 10) / 10 });
      for (const f of this.majPanneau) f();
      this.planifier();
    } else {
      this.selectionner(null);
    }
  }

  // ───────────────────────── profil en long ─────────────────────────

  private readonly onProfilDown = (e: PointerEvent): void => {
    const t = this.analyse.track, v = this.vueProfil();
    if (!t || !v) return;
    e.preventDefault();
    const p = this.pos(e, this.profilCanvas);
    const i = choisirPointProfil(v, pointsProfil(this.doc.level, t), p.x, p.y, this.rayonTouche);
    if (i < 0) return;
    this.profilCanvas.setPointerCapture(e.pointerId);
    this.selectionner({ kind: 'point', i });
    this.doc.beginGesture();
    this.profilGele = { ...v };
    this.geste = { t: 'profil', i, vue: this.profilGele };
  };

  private readonly onProfilMove = (e: PointerEvent): void => {
    const g = this.geste;
    if (!g || g.t !== 'profil') {
      if (!this.geste && this.analyse.track) {
        const v = this.vueProfil(), p = this.pos(e, this.profilCanvas);
        const sur = v && choisirPointProfil(v, pointsProfil(this.doc.level, this.analyse.track), p.x, p.y, this.rayonTouche) >= 0;
        this.profilCanvas.style.cursor = sur ? 'ns-resize' : 'default';
      }
      return;
    }
    const p = this.pos(e, this.profilCanvas);
    const y = Math.round(pxVersY(g.vue, p.y) * 10) / 10;
    this.doc.updateGesture((l) => setPoint(l, g.i, { y }));
  };

  private readonly onProfilUp = (): void => {
    const g = this.geste;
    if (!g || g.t !== 'profil') return;
    this.geste = null;
    this.profilGele = null;
    this.doc.endGesture();
    this.planifier();
  };

  // ───────────────────────── panneau de propriétés ─────────────────────────

  private panneauSiBesoin(): void {
    const cle = `${this.outil}|${this.outil === 'route' ? this.selection?.kind ?? '' : this.outil === 'objets' ? this.selection?.kind ?? '' : ''}`;
    if (cle === this.clePanneau) return;
    this.clePanneau = cle;
    this.majPanneau = [];
    this.panneau.replaceChildren(...this.construirePanneau().filter((n): n is HTMLElement => !!n));
  }

  private curseur(o: { label: string; min: number; max: number; step: number; lire(): number; ecrire(l: Level, v: number): void; format(v: number): string }): HTMLElement {
    const val = h('b', {});
    const input = h('input', { type: 'range', min: String(o.min), max: String(o.max), step: String(o.step), value: '0', 'aria-label': o.label });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      if (!this.geleSlider) { this.geleSlider = true; this.doc.beginGesture(); }
      this.doc.updateGesture((l) => o.ecrire(l, v));
    });
    input.addEventListener('change', () => { if (this.geleSlider) { this.geleSlider = false; this.doc.endGesture(); } });
    this.majPanneau.push(() => {
      const v = o.lire();
      if (parseFloat(input.value) !== v) input.value = String(v);
      val.textContent = o.format(v);
    });
    return h('label', { class: 'ed-f' }, h('span', {}, o.label, ' ', val), input);
  }

  private texte(label: string, max: number, lire: () => string, ecrire: (l: Level, v: string) => void, placeholder = ''): HTMLElement {
    const input = h('input', { type: 'text', maxlength: String(max), placeholder, 'aria-label': label, spellcheck: 'false' });
    input.addEventListener('input', () => {
      if (!this.geleSlider) { this.geleSlider = true; this.doc.beginGesture(); }
      const v = input.value;
      this.doc.updateGesture((l) => ecrire(l, v));
    });
    const fin = (): void => { if (this.geleSlider) { this.geleSlider = false; this.doc.endGesture(); } };
    input.addEventListener('change', fin);
    input.addEventListener('blur', fin);
    this.majPanneau.push(() => { if (document.activeElement !== input && input.value !== lire()) input.value = lire(); });
    return h('label', { class: 'ed-f' }, h('span', {}, label), input);
  }

  private segments(items: { id: string; nom: string }[], courant: () => string, choisir: (id: string) => void): HTMLElement {
    const btns = items.map((it) => h('button', { class: 'tab', onclick: () => choisir(it.id) }, it.nom));
    this.majPanneau.push(() => btns.forEach((b, i) => b.classList.toggle('on', items[i].id === courant())));
    return h('div', { class: 'seg' }, ...btns);
  }

  private construirePanneau(): HTMLElement[] {
    const titre = (t: string) => h('h3', {}, t);
    const aide = (t: string) => h('p', { class: 'ed-aide' }, t);
    const sel = this.selection;
    switch (this.outil) {
      case 'route': {
        if (sel?.kind === 'point') {
          const num = h('b', {});
          this.majPanneau.push(() => {
            const i = this.selection?.i ?? 0, n = this.doc.level.route.length;
            num.textContent = `${i}${i === 0 ? ' (départ)' : i === n - 1 ? ' (arrivée)' : ''}`;
          });
          const idx = () => this.selection?.i ?? 0;
          return [
            h('h3', {}, 'Point ', num),
            this.curseur({
              label: 'Largeur', min: LIMITES.largeurMin, max: LIMITES.largeurMax, step: 0.5,
              lire: () => this.doc.level.route[idx()]?.l ?? 10, ecrire: (l, v) => { if (l.route[idx()]) setPoint(l, idx(), { l: v }); }, format: (v) => `${v} m`,
            }),
            this.curseur({
              label: 'Hauteur', min: LIMITES.hauteurMin, max: LIMITES.hauteurMax, step: 1,
              lire: () => Math.round(this.doc.level.route[idx()]?.y ?? 0), ecrire: (l, v) => { if (l.route[idx()]) setPoint(l, idx(), { y: v }); }, format: (v) => `${v} m`,
            }),
            h('button', { class: 'btn sec sm', onclick: () => this.supprimerSelection() }, icone('corbeille'), 'Supprimer'),
            aide('Glisse le point pour le déplacer. Suppr : supprimer.'),
          ];
        }
        return [
          titre('Route'),
          aide('Clique dans le vide pour ajouter un point à la fin. Clique sur la route pour insérer un point. Glisse un point pour le déplacer. Glisse dans le vide (ou clic droit) pour déplacer la vue, molette ou pincement pour zoomer.'),
        ];
      }
      case 'barrieres':
        return [
          titre('Barrières'),
          this.segments(COTES, () => this.cote, (id) => { this.cote = id as CoteEdit; for (const f of this.majPanneau) f(); }),
          aide('Clique sur un tronçon de route (entre deux points, repérés par les tirets) pour poser ou retirer sa barrière du côté choisi. « Extérieur » suit l\'extérieur du virage.'),
          h('button', { class: 'btn sec sm', onclick: () => { this.doc.apply((l) => { l.barrieres = []; }); } }, icone('corbeille'), 'Tout retirer'),
        ];
      case 'clipping':
        return [
          titre('Zones de clipping'),
          aide('Clique près du bord d\'un tronçon de route pour y poser ou retirer une zone de clipping, de ce côté-là. En course, frôler le bord dans la zone en glisse multiplie les points du drift (jusqu\'à × 2 au ras du bord). Idéal à l\'extérieur d\'un virage.'),
          h('button', { class: 'btn sec sm', onclick: () => { this.doc.apply((l) => { delete l.clipping; }); } }, icone('corbeille'), 'Tout retirer'),
        ];
      case 'objets': {
        const palette = h('div', { class: 'ed-palette' }, ...TYPES_OBJETS.map((t) => {
          const b = h('button', { class: 'ed-obj', onclick: () => { this.typeObjet = t.id; for (const f of this.majPanneau) f(); } },
            h('i', { style: `background:${OBJETS[t.id].fill}` }), nomObjet(this.doc.level.environnement, t.id));
          this.majPanneau.push(() => b.classList.toggle('on', this.typeObjet === t.id));
          return b;
        }));
        const out: HTMLElement[] = [titre('Objets'), palette, aide('Clique pour poser, glisse un objet pour le déplacer.')];
        if (sel?.kind === 'objet') {
          const nom = h('b', {}, '');
          const rot = h('span', {}, '');
          this.majPanneau.push(() => {
            const o = this.doc.level.objets[this.selection?.i ?? -1];
            nom.textContent = o ? nomObjet(this.doc.level.environnement, o.type) : '';
            rot.textContent = o ? `${Math.round(o.rot)}°` : '';
          });
          const tourner = (d: number) => { if (this.selection?.kind === 'objet') { const i = this.selection.i; this.doc.apply((l) => rotateObjet(l, i, d)); } };
          out.push(
            h('h3', {}, 'Sélection : ', nom),
            h('div', { class: 'row' },
              h('button', { class: 'btn sec sm', title: 'Tourner de −15°', onclick: () => tourner(-15) }, icone('gauche'), '−15°'),
              h('button', { class: 'btn sec sm', title: 'Tourner de +15°', onclick: () => tourner(15) }, icone('droite'), '+15°'),
              rot),
            h('button', { class: 'btn sec sm', onclick: () => this.supprimerSelection() }, icone('corbeille'), 'Supprimer'),
          );
        }
        return out;
      }
      case 'lac': {
        const etat = aide('');
        const fin = h('button', { class: 'btn sm', onclick: () => this.terminerLac() }, 'Terminer le lac');
        const efface = h('button', { class: 'btn sec sm', onclick: () => { this.lacBrouillon = []; for (const f of this.majPanneau) f(); this.planifier(); } }, 'Effacer le contour');
        const suppr = h('button', { class: 'btn sec sm', onclick: () => { const n = (this.doc.level.eau?.length ?? 0) - 1; if (n >= 0) this.doc.apply((l) => deleteLac(l, n)); } }, icone('corbeille'), 'Supprimer le dernier lac');
        this.majPanneau.push(() => {
          const n = this.lacBrouillon.length, lacs = this.doc.level.eau?.length ?? 0;
          etat.textContent = n > 0 ? `Contour en cours : ${n} point${n > 1 ? 's' : ''}.` : `${lacs} lac${lacs > 1 ? 's' : ''} sur ${LIMITES.eauMax}.`;
          (fin as HTMLButtonElement).disabled = n < LIMITES.eauPointsMin;
          (efface as HTMLButtonElement).disabled = n === 0;
          (suppr as HTMLButtonElement).disabled = lacs === 0 || n > 0;
        });
        return [
          titre('Lac'),
          aide('Clique pour placer les points du contour du lac (3 au moins), puis « Terminer le lac ». La route reste au sec : garde au moins 6 m entre son bord et l\'eau.'),
          etat, fin, efface,
          this.curseur({
            label: 'Hauteur de l\'eau (dernier lac)', min: LIMITES.hauteurMin, max: LIMITES.hauteurMax, step: 1,
            lire: () => { const e = this.doc.level.eau; return e && e.length > 0 ? Math.round(e[e.length - 1].niveau) : 0; },
            ecrire: (l, v) => { if (l.eau && l.eau.length > 0) setNiveauLac(l, l.eau.length - 1, v); }, format: (v) => `${v} m`,
          }),
          suppr,
        ];
      }
      case 'decor': {
        const descTheme = aide('');
        this.majPanneau.push(() => { descTheme.textContent = THEMES[this.doc.level.environnement].description; });
        return [
          titre('Décor'),
          h('div', { class: 'ed-f' }, h('span', {}, 'Ambiance'),
            this.segments([{ id: 'jour', nom: 'Jour' }, { id: 'coucher', nom: 'Coucher' }, { id: 'nuit', nom: 'Nuit' }], () => this.doc.level.ambiance,
              (id) => this.doc.apply((l) => { l.ambiance = id as Level['ambiance']; }))),
          h('div', { class: 'ed-f' }, h('span', {}, 'Météo'),
            this.segments([{ id: 'beau', nom: 'Beau temps' }, { id: 'pluie', nom: 'Pluie' }], () => this.doc.level.meteo ?? 'beau',
              (id) => this.doc.apply((l) => { if (id === 'pluie') l.meteo = 'pluie'; else delete l.meteo; }))),
          aide('Sous la pluie, la route est mouillée : les pneus accrochent 20 % de moins.'),
          this.curseur({
            label: 'Densité', min: 0, max: 1, step: 0.05, lire: () => this.doc.level.decor.densite,
            ecrire: (l, v) => { l.decor.densite = Math.round(v * 100) / 100; }, format: (v) => `${Math.round(v * 100)} %`,
          }),
          h('button', { class: 'btn sec sm', onclick: () => this.doc.apply((l) => { l.decor.graine = Math.floor(Math.random() * 2147483647); }) }, 'Autre décor'),
          h('div', { class: 'ed-f' }, h('span', {}, 'Environnement'),
            this.segments(ENVIRONNEMENTS.map((id) => ({ id, nom: THEMES[id].nom })), () => this.doc.level.environnement,
              (id) => this.doc.apply((l) => { l.environnement = id as Environnement; }))),
          descTheme,
          aide('Les arbres, rochers et bornes du bord de route sont générés à partir de la graine et de la densité. Les objets posés à la main s’adaptent au décor.'),
        ];
      }
      case 'infos':
        return [
          titre('Infos'),
          this.texte(`Nom (1–${LIMITES.nomMax})`, LIMITES.nomMax, () => this.doc.level.nom, (l, v) => { l.nom = v; }),
          this.texte(`Auteur (0–${LIMITES.auteurMax})`, LIMITES.auteurMax, () => this.doc.level.auteur, (l, v) => { l.auteur = v; }, 'facultatif'),
          aide('Le niveau est enregistré automatiquement dans « Mes niveaux ».'),
        ];
    }
  }
}
