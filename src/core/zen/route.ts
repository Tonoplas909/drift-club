import type { Environnement, Level } from '../level/types';
import { finirPiste, type TrackData, type TrackSample } from '../track/buildTrack';
import { Terrain, appliquerTalus, terrainEnEtapes, RAYON_TALUS, type Ground } from '../track/terrain';
import { decorEnEtapes, type SolDecor } from '../env/generate';
import { THEMES } from '../env/themes';
import type { Environment } from '../env/types';
import { buildCollisionWorld, type CollisionWorld } from '../physics/collision';
import { hash2 } from '../math/rng';
import { lerp, smoothstep } from '../math/vec';
import { Dessinateur } from './designer';
import { Regions, ambianceA } from './regions';

/**
 * Route infinie du mode Zen, découpée en tronçons de 320 m. Chaque tronçon porte sa piste (avec 120 m de marge de
 * chaque côté, pour que terrain et décor se raccordent sans couture), son terrain (grilles de hauteur), puis son
 * décor et ses obstacles. Le sol vu par la physique est un « sol composé » qui mélange les terrains des tronçons
 * proches et impose partout la hauteur exacte de la route.
 *
 * Tout est déterministe (graine + géométrie de la route) : le moment où un tronçon est construit ne change rien.
 * Pour cela, le décor d'un tronçon n'est construit que quand les terrains des 5 tronçons de part et d'autre existent
 * (le dessinateur garantit qu'une portion plus lointaine est trop loin pour compter).
 */

export const LONGUEUR_TRONCON = 320;
export const MARGE = 60;
/** Tronçons de part et d'autre dont le terrain doit exister avant de poser le décor, et dont la route sert au partage de l'espace. */
export const VOISINS_TERRAIN = 5;
export const VOISINS_ROUTE = 6;
/** Décor et obstacles gardés de `ARRIERE` m derrière la voiture à `AVANT` m devant. */
export const ARRIERE = 600;
export const AVANT = 800;
/** Recul maximal (m) de la voiture derrière sa progression maximale (au-delà, elle est replacée). */
export const RECUL_MAX = 400;
/** Distance maximale (m) du décor à la route. */
export const DISTANCE_DECOR = 220;
/** Pas (m) des points de l'axe qui servent à partager l'espace entre tronçons. */
const PAS_AXE = 8;
/** Taille (m) des taches du fondu entre deux décors (un objet garde le décor de sa tache). */
const TACHE = 22;
const DENSITE = 0.6;

export type EtatTroncon = 'route' | 'terrain' | 'fini';

export interface PartieDecor { theme: Environnement; env: Environment }

export interface Troncon {
  n: number;
  /** abscisses [debut, fin[ du tronçon (m) */
  debut: number;
  fin: number;
  /** abscisse du premier échantillon de `track` (avec la marge) */
  debutPiste: number;
  /** piste du tronçon, abscisses locales depuis 0 */
  track: TrackData;
  /** points de l'axe du tronçon (sans marge), tous les 8 m, et leur emprise */
  axe: { x: number; z: number; s: number }[];
  boite: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** thèmes présents (un seul hors transition) et ambiance du décor */
  themes: Environnement[];
  ambiance: 'jour' | 'coucher';
  terrain: Terrain | null;
  parties: PartieDecor[] | null;
  /** parties de décor déjà générées (en attendant les autres) */
  enCours: PartieDecor[];
  mondes: CollisionWorld[];
  etat: EtatTroncon;
}

export type EvenementRoute = { type: 'fini'; troncon: Troncon } | { type: 'retire'; troncon: Troncon };

const graineMelangee = (seed: number, n: number, k: number): number =>
  (Math.imul(seed | 0, 2654435761) ^ Math.imul(n + 1, 40503) ^ Math.imul(k + 7, 7919)) >>> 0;

const candSol: TrackSample[] = [];
const sCandSol: number[] = [];
const dScratch: number[] = [];
const grilleScratch: number[] = [];

/** Sol composé : physique, caméra, placement du décor et maillage du terrain lisent tous ce sol. */
export class SolZen implements Ground, SolDecor {
  /** pas de mer en mode Zen (le décor pirate y reste sur la terre ferme) */
  readonly mer = null;

  constructor(private readonly route: RouteZen) {}

  /** Hauteur des grilles (mélange des terrains des tronçons, pondéré par la distance à leur route) ; `d` = distance à la route la plus proche. */
  private grille(x: number, z: number, out: { d: number }): number {
    const ts = this.route.avecTerrain;
    // minorant de la distance à chaque route (emprise de la piste), puis distances exactes seulement où elles peuvent compter
    let kMin = -1, lbMin = Infinity;
    for (let k = 0; k < ts.length; k++) {
      const b = ts[k].track.bounds;
      const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
      const lb = Math.sqrt(dx * dx + dz * dz);
      dScratch[k] = lb;
      if (lb < lbMin) { lbMin = lb; kMin = k; }
    }
    if (kMin < 0) { out.d = Infinity; return NaN; }
    let dmin = this.distance(ts[kMin].terrain!, x, z);
    const dk = dScratch[kMin];
    dScratch[kMin] = -dmin - 1; // déjà calculée (codée négative)
    for (let k = 0; k < ts.length; k++) {
      if (k === kMin || dScratch[k] - dmin >= 15 + 0.15 * dmin) { if (k !== kMin) dScratch[k] = Infinity; continue; }
      const d = this.distance(ts[k].terrain!, x, z);
      dScratch[k] = -d - 1;
      if (d < dmin) dmin = d;
    }
    void dk;
    out.d = dmin;
    if (dmin === Infinity) return NaN;
    const W = 15 + 0.15 * dmin;
    let sw = 0, sh = 0;
    for (let k = 0; k < ts.length; k++) {
      if (dScratch[k] === Infinity) continue;
      const e = -dScratch[k] - 1 - dmin;
      if (e >= W) continue;
      const w = 1 - smoothstep(0, W, e);
      sw += w;
      sh += w * ts[k].terrain!.hauteurGrille(x, z);
    }
    return sh / sw;
  }

  private distance(t: Terrain, x: number, z: number): number {
    return x < t.minX || x > t.maxX || z < t.minZ || z > t.maxZ ? Infinity : t.distanceToRoad(x, z);
  }

  /** Tronçons de route (échantillons) à moins de `rayon` m de (x, z) : remplit les tampons ; renvoie leur nombre. */
  private candidats(x: number, z: number, rayon: number): number {
    let n = 0;
    for (const t of this.route.tous) {
      const b = t.track.bounds;
      if (x < b.minX - rayon || x > b.maxX + rayon || z < b.minZ - rayon || z > b.maxZ + rayon) continue;
      t.track.grid.query(x, z, rayon, grilleScratch);
      const S = t.track.samples;
      for (const i of grilleScratch) {
        candSol[n] = S[i];
        sCandSol[n] = S[i].s + t.debutPiste;
        n++;
      }
    }
    return n;
  }

  private readonly tmp = { d: 0 };

  heightAt(x: number, z: number): number {
    let g = this.grille(x, z, this.tmp);
    const n = this.candidats(x, z, RAYON_TALUS);
    if (Number.isNaN(g)) {
      // hors de tout terrain (ne doit pas arriver près de la route) : hauteur du tronçon le plus proche
      let best = Infinity;
      g = 0;
      for (let k = 0; k < n; k++) {
        const d = (candSol[k].x - x) ** 2 + (candSol[k].z - z) ** 2;
        if (d < best) { best = d; g = candSol[k].y; }
      }
    }
    return appliquerTalus(g, x, z, candSol, sCandSol, n);
  }

  gradientAt(x: number, z: number): { gx: number; gz: number } {
    const e = 0.5;
    return {
      gx: (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e),
      gz: (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e),
    };
  }

  /** Distance approximative (±2 m) à la route la plus proche (Infinity hors des terrains). */
  distanceToRoad(x: number, z: number): number {
    this.grille(x, z, this.tmp);
    return this.tmp.d;
  }

  distanceEau(): number {
    return -Infinity;
  }

  /** Hauteur de la surface affichée : 15 cm plus bas sous la chaussée et l'accotement (comme `Terrain.hauteurRendue`). */
  hauteurRendue(x: number, z: number): number {
    const h = this.heightAt(x, z);
    const n = this.candidats(x, z, 14);
    let best = 14 * 14, w = 0, trouve = false;
    for (let k = 0; k < n; k++) {
      const d = (candSol[k].x - x) ** 2 + (candSol[k].z - z) ** 2;
      if (d < best) { best = d; w = candSol[k].w; trouve = true; }
    }
    if (!trouve) return h;
    return h - 0.15 * (1 - smoothstep(w + 0.5, w + 2, Math.sqrt(best)));
  }

  /** Échantillon de route le plus proche dans `rayon` m (abscisse globale et distance), ou null. */
  plusProche(x: number, z: number, rayon: number): { s: number; dist: number; w: number } | null {
    const n = this.candidats(x, z, rayon);
    let best = rayon * rayon, k1 = -1;
    for (let k = 0; k < n; k++) {
      const d = (candSol[k].x - x) ** 2 + (candSol[k].z - z) ** 2;
      if (d < best) { best = d; k1 = k; }
    }
    return k1 < 0 ? null : { s: sCandSol[k1], dist: Math.sqrt(best), w: candSol[k1].w };
  }
}

export class RouteZen {
  readonly regions: Regions;
  readonly dessinateur: Dessinateur;
  readonly sol: SolZen;
  private readonly troncons = new Map<number, Troncon>();
  /** tronçons existants, dans l'ordre (vue en lecture) */
  tous: Troncon[] = [];
  /** tronçons dont le terrain est construit */
  avecTerrain: Troncon[] = [];
  private evenements: EvenementRoute[] = [];
  /** fenêtre voulue : tronçons à finir [nMin, nMax] */
  private nMin = 0;
  private nMax = 0;
  /** plus grande abscisse visée : la voiture ne recule jamais de plus de `RECUL_MAX` m (elle est replacée avant) */
  private sMax = 0;

  constructor(readonly seed: number) {
    this.regions = new Regions(seed);
    this.dessinateur = new Dessinateur(seed, this.regions);
    this.sol = new SolZen(this);
  }

  /** Tronçon qui contient l'abscisse `s`. */
  static indice(s: number): number {
    return Math.max(0, Math.floor(s / LONGUEUR_TRONCON));
  }

  troncon(n: number): Troncon | undefined {
    return this.troncons.get(n);
  }

  /** Échantillon d'abscisse globale `i` (arrondie). */
  echantillon(i: number): TrackSample {
    return this.dessinateur.echantillon(Math.max(this.dessinateur.debut, Math.round(i)));
  }

  /** Événements (tronçons finis ou retirés) depuis le dernier appel : le rendu construit ou libère ses maillages. */
  vider(): EvenementRoute[] {
    const e = this.evenements;
    this.evenements = [];
    return e;
  }

  /** Fixe la fenêtre de travail autour de l'abscisse `s` de la voiture et retire ce qui en sort. */
  viser(s: number): void {
    this.sMax = Math.max(this.sMax, s);
    s = Math.max(s, this.sMax - RECUL_MAX);
    this.nMin = RouteZen.indice(s - ARRIERE);
    this.nMax = RouteZen.indice(s + AVANT);
    const garderDe = this.nMin - VOISINS_ROUTE, garderA = this.nMax + VOISINS_ROUTE;
    for (const t of [...this.tous]) {
      if (t.n < garderDe || t.n > garderA) this.retirer(t);
      else if (t.etat === 'fini' && (t.n < this.nMin || t.n > this.nMax)) this.defaire(t);
    }
    for (const t of [...this.avecTerrain]) {
      if (t.n < this.nMin - VOISINS_TERRAIN || t.n > this.nMax + VOISINS_TERRAIN) {
        t.terrain = null;
        t.enCours = [];
        t.etat = 'route';
        this.majListes();
      }
    }
    // échantillons encore utiles : depuis la marge du premier tronçon qui peut encore servir (voiture au plus loin en arrière)
    const premier = Math.max(0, RouteZen.indice(this.sMax - RECUL_MAX - ARRIERE) - VOISINS_ROUTE) * LONGUEUR_TRONCON - MARGE;
    if (premier > 0) this.dessinateur.oublierAvant(Math.min(premier, this.dessinateur.fin - 1));
  }

  /**
   * Une unité de travail (créer une route de tronçon, un terrain, un décor…) vers la fenêtre visée ; renvoie false
   * s'il n'y a plus rien à faire. Les tronçons proches de la voiture passent en premier.
   */
  travailler(): boolean {
    if (this.enCours) { this.etape(); return true; }
    // 1. décor des tronçons de la fenêtre, du plus proche au plus lointain (après leurs prérequis)
    for (let n = this.nMin; n <= this.nMax; n++) {
      const deja = this.troncons.get(n);
      if (deja?.etat === 'fini') continue;
      for (let m = n - VOISINS_ROUTE; m <= n + VOISINS_ROUTE; m++) {
        if (m >= 0 && !this.troncons.has(m)) { this.creer(m); return true; }
      }
      for (let m = n - VOISINS_TERRAIN; m <= n + VOISINS_TERRAIN; m++) {
        const v = this.troncons.get(m);
        if (v && !v.terrain) { this.lancer(v, this.construireTerrain(v), (ter) => { v.terrain = ter as Terrain; v.etat = 'terrain'; this.majListes(); }); return true; }
      }
      const t = this.troncons.get(n)!;
      const k = t.enCours.length;
      if (k < t.themes.length) {
        this.lancer(t, this.decorPartie(t, k), (env) => {
          // le décor n'est valable que si les terrains voisins n'ont pas bougé entre-temps
          if (this.terrainsVoisins(t) && t.enCours.length === k) t.enCours.push({ theme: t.themes[k], env: env as Environment });
          else t.enCours = [];
        });
        return true;
      }
      this.finir(t);
      return true;
    }
    return false;
  }

  /** Travail en cours, mené par petites étapes (un générateur qui rend la main toutes les quelques ms). */
  private enCours: { t: Troncon; gen: Generator<void, unknown>; fin: (v: unknown) => void } | null = null;

  private lancer(t: Troncon, gen: Generator<void, unknown>, fin: (v: unknown) => void): void {
    this.enCours = { t, gen, fin };
    this.etape();
  }

  /** Une étape du travail en cours ; à la fin, le résultat n'est gardé que si le tronçon existe encore. */
  private etape(): void {
    const e = this.enCours!;
    const r = e.gen.next();
    if (!r.done) return;
    this.enCours = null;
    if (this.troncons.get(e.t.n) === e.t) e.fin(r.value);
  }

  private terrainsVoisins(t: Troncon): boolean {
    for (let m = Math.max(0, t.n - VOISINS_TERRAIN); m <= t.n + VOISINS_TERRAIN; m++) if (!this.troncons.get(m)?.terrain) return false;
    return true;
  }

  /** Fait tout le travail en attente (tests, départ, téléportation). */
  toutFaire(): void {
    while (this.travailler()) { /* rien */ }
  }

  /** La zone de la voiture est-elle prête (décor et obstacles des tronçons autour de `s`) ? */
  pret(s: number): boolean {
    for (let n = RouteZen.indice(s - 60); n <= RouteZen.indice(s + 400); n++) {
      if (this.troncons.get(n)?.etat !== 'fini') return false;
    }
    return true;
  }

  /** Tronçons finis dont l'emprise (élargie de `marge` m) contient (x, z). */
  finisPres(x: number, z: number, marge: number, out: Troncon[]): Troncon[] {
    out.length = 0;
    for (const t of this.tous) {
      if (t.etat !== 'fini') continue;
      const b = t.boite;
      if (x >= b.minX - marge && x <= b.maxX + marge && z >= b.minZ - marge && z <= b.maxZ + marge) out.push(t);
    }
    return out;
  }

  /**
   * Tronçon « propriétaire » de l'endroit (x, z) : celui dont l'axe est le plus proche, parmi les tronçons voisins de
   * `n` (±6, fenêtre fixe : le résultat ne dépend pas du moment du calcul). À égalité (point d'axe partagé par deux
   * tronçons qui se suivent), le plus petit numéro l'emporte, quel que soit le tronçon qui pose la question.
   * Renvoie aussi l'abscisse du point d'axe.
   */
  proprietaire(n: number, x: number, z: number): { n: number; s: number; d: number } {
    let best = Infinity, bn = -1, bs = 0;
    // le tronçon lui-même d'abord : les autres sont souvent écartés par leur seule emprise
    for (let j = 0; j <= 2 * VOISINS_ROUTE; j++) {
      const m = n + (j === 0 ? 0 : j % 2 === 1 ? (j + 1) / 2 : -j / 2);
      const t = this.troncons.get(m);
      if (!t) continue;
      const b = t.boite;
      const dx = Math.max(b.minX - x, 0, x - b.maxX), dz = Math.max(b.minZ - z, 0, z - b.maxZ);
      if (dx * dx + dz * dz > best) continue;
      for (const p of t.axe) {
        const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
        if (d < best || (d === best && m < bn)) { best = d; bn = m; bs = p.s; }
      }
    }
    return { n: bn, s: bs, d: Math.sqrt(best) };
  }

  /** Poids du thème `th` à l'abscisse `s`. */
  poidsTheme(th: Environnement, s: number): number {
    return this.regions.poids(s)[th] ?? 0;
  }

  // --- construction

  private majListes(): void {
    this.tous = [...this.troncons.values()].sort((a, b) => a.n - b.n);
    this.avecTerrain = this.tous.filter((t) => t.terrain);
  }

  private creer(n: number): void {
    const debut = n * LONGUEUR_TRONCON, fin = debut + LONGUEUR_TRONCON;
    const debutPiste = Math.max(0, debut - MARGE), finPiste = fin + MARGE;
    this.dessinateur.genererJusqua(finPiste);
    const samples: TrackSample[] = [];
    for (let i = debutPiste; i <= finPiste; i++) samples.push({ ...this.dessinateur.echantillon(i), s: i - debutPiste });
    const track = finirPiste(samples);
    const axe: { x: number; z: number; s: number }[] = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = debut; i <= fin; i += PAS_AXE) {
      const sp = this.dessinateur.echantillon(i);
      axe.push({ x: sp.x, z: sp.z, s: i });
      minX = Math.min(minX, sp.x); maxX = Math.max(maxX, sp.x); minZ = Math.min(minZ, sp.z); maxZ = Math.max(maxZ, sp.z);
    }
    const themes: Environnement[] = [];
    for (let s = debut; s <= fin; s += 16) {
      const m = this.regions.melange(s);
      for (const th of m.t > 0 && m.t < 1 ? [m.a, m.b] : [m.t >= 1 ? m.b : m.a]) if (!themes.includes(th)) themes.push(th);
    }
    const t: Troncon = {
      n, debut, fin, debutPiste, track, axe, boite: { minX, maxX, minZ, maxZ }, themes,
      ambiance: ambianceA(debut + LONGUEUR_TRONCON / 2) > 0.5 ? 'coucher' : 'jour',
      terrain: null, parties: null, enCours: [], mondes: [], etat: 'route',
    };
    this.troncons.set(n, t);
    this.majListes();
  }

  private construireTerrain(t: Troncon): Generator<void, Terrain> {
    const S = t.track.samples;
    const reliefDe = (th: Environnement): number => THEMES[th].relief ?? 1;
    let relief: number | ((x: number, z: number) => number);
    if (t.themes.length === 1 && this.regions.melange(t.debutPiste).t === 0 && this.regions.melange(t.debutPiste + S.length).t === 0) {
      relief = reliefDe(t.themes[0]);
    } else {
      // relief en fondu le long de la route : celui du point de piste le plus proche (tous les 8 m)
      const pts: { x: number; z: number; r: number }[] = [];
      for (let i = 0; i < S.length; i += PAS_AXE) {
        const m = this.regions.melange(S[i].s + t.debutPiste);
        pts.push({ x: S[i].x, z: S[i].z, r: lerp(reliefDe(m.a), reliefDe(m.b), m.t) });
      }
      relief = (x, z) => {
        let best = Infinity, r = 1;
        for (const p of pts) {
          const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
          if (d < best) { best = d; r = p.r; }
        }
        return r;
      };
    }
    return terrainEnEtapes(t.track, this.seed, relief, [], { rayonGrossier: 330, pasGrossier: 8, pasFin: 3 });
  }

  /** Décor (un par thème présent, en fondu par taches), obstacles, puis annonce au rendu. */
  /** Décor du thème numéro `k` du tronçon (en étapes). */
  private decorPartie(t: Troncon, k: number): Generator<void, Environment> {
    const b = t.boite;
    const theme = t.themes[k];
    {
      const level: Level = {
        format: 1, nom: 'Zen', auteur: '', environnement: theme, ambiance: t.ambiance,
        route: [], barrieres: [], decor: { graine: this.seed, densite: DENSITE }, objets: [],
      };
      const garder = (x: number, z: number): boolean => {
        const p = this.proprietaire(t.n, x, z);
        if (p.n !== t.n) return false;
        if (t.themes.length === 1) return true;
        // fondu : chaque tache de 22 m garde le décor du thème tiré selon les poids à cet endroit de la route
        const u = hash2(Math.floor(x / TACHE), Math.floor(z / TACHE), this.seed + 31);
        const wA = this.poidsTheme(t.themes[0], p.s);
        return k === 0 ? u < wA : u >= wA;
      };
      return decorEnEtapes(level, t.track, this.sol, {
        alea: graineMelangee(this.seed, t.n, k), garder, distanceMax: DISTANCE_DECOR, zone: b, altitudeBase: 0,
      });
    }
  }

  /** Décor de chaque thème prêt : obstacles, puis annonce au rendu. */
  private finir(t: Troncon): void {
    const parties = t.enCours;
    t.enCours = [];
    t.parties = parties;
    t.mondes = parties.map((p) => buildCollisionWorld(p.env));
    t.etat = 'fini';
    this.evenements.push({ type: 'fini', troncon: t });
  }

  /** Retire décor et obstacles (le tronçon garde sa route et son terrain). */
  private defaire(t: Troncon): void {
    if (t.etat !== 'fini') return;
    t.parties = null;
    t.mondes = [];
    t.etat = t.terrain ? 'terrain' : 'route';
    this.evenements.push({ type: 'retire', troncon: t });
  }

  private retirer(t: Troncon): void {
    this.defaire(t);
    this.troncons.delete(t.n);
    this.majListes();
  }
}
