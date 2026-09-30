import type { TrackSample } from '../track/buildTrack';
import type { Environnement } from '../level/types';
import { clamp, wrapAngle } from '../math/vec';
import type { Regions } from './regions';

/**
 * « Dessinateur » de la route infinie du mode Zen : enchaîne des morceaux (lignes droites, grandes courbes, virages,
 * S, épingles, lacets, angles de rue) décrits par leur courbure, intégrée au mètre près. Position, cap, courbure
 * (rampes linéaires : clothoïdes), hauteur (pente lissée) et largeur sont donc continues partout. Chaque morceau est
 * vérifié avant d'être gardé : la route ne se croise pas et ne revient jamais près d'elle-même (sinon on en tire un
 * autre). Tout dépend de la graine : même graine ⇒ même route au bit près.
 */

/** Écart minimal (m) entre deux portions de route non voisines, en plus des deux demi-largeurs. */
export const DEGAGEMENT = 12;
/** En dessous de cet écart d'abscisse (m), deux échantillons sont « voisins » (pas de contrôle de croisement). */
export const VOISINAGE = 70;
/** Au-delà de `ARC_LIBRE` m d'abscisse, la distance exigée croît avec l'écart d'abscisse, jusqu'à `ECART_LOIN` m. */
export const ARC_LIBRE = 400;
export const ECART_LOIN = 640;
/** Au-delà de `ARC_LIBRE`, la distance exigée croît de `PROGRES` m par mètre d’abscisse. */
export const PROGRES = 0.6;
/** Mémoire (m) de la route passée prise en compte pour les contrôles (la route plus ancienne a disparu de la scène). */
export const MEMOIRE = 3000;

/** Distance minimale exigée entre deux échantillons d'abscisses `si` > `sj` et de demi-largeurs `wi`, `wj`. */
export function ecartExige(si: number, sj: number, wi: number, wj: number): number {
  const ds = si - sj;
  if (ds <= VOISINAGE) return 0;
  return Math.max(wi + wj + DEGAGEMENT, Math.min(ECART_LOIN, PROGRES * (ds - ARC_LIBRE)));
}

/** Générateur à graine dont l'état se lit (mulberry32). */
class Alea {
  constructor(private a: number) {}
  next(): number {
    this.a = (this.a + 0x6d2b79f5) >>> 0;
    let t = this.a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  entre(a: number, b: number): number { return a + (b - a) * this.next(); }
}

interface Etat {
  x: number; z: number; psi: number; k: number;
  y: number; g: number; gCible: number; gRestant: number;
  w: number; wCible: number;
}

/** Tronçon de courbure linéaire : de `k0` à `k1` (1/m, + = à gauche) sur `len` m. */
interface Seg { len: number; k0: number; k1: number }

type TypeMorceau = 'droite' | 'courbe' | 'virage' | 'S' | 'epingle' | 'lacet' | 'angle';

const POIDS: Record<Environnement, Record<TypeMorceau, number>> = {
  montagne: { droite: 2, courbe: 3, virage: 3, S: 2.5, epingle: 1, lacet: 0.6, angle: 0 },
  neige: { droite: 2, courbe: 3.5, virage: 3, S: 2, epingle: 0.9, lacet: 0.5, angle: 0 },
  desert: { droite: 3, courbe: 4, virage: 2, S: 1.5, epingle: 0.3, lacet: 0, angle: 0 },
  automne: { droite: 1.5, courbe: 3, virage: 3, S: 3.5, epingle: 0.6, lacet: 0.3, angle: 0 },
  ville: { droite: 4, courbe: 1, virage: 1, S: 1, epingle: 0, lacet: 0, angle: 3 },
};
/** Pente maximale de la route selon le décor (la ville reste presque plate). */
const PENTE_MAX: Record<Environnement, number> = { montagne: 0.075, neige: 0.065, desert: 0.05, automne: 0.06, ville: 0.022 };
/** Demi-largeur de la route selon le décor : [min, amplitude]. */
const LARGEUR: Record<Environnement, [number, number]> = { montagne: [4, 1.5], neige: [4.2, 1.4], desert: [4.5, 1.8], automne: [4, 1.4], ville: [5, 1.6] };

const CASE_FINE = 16;
const CASE_LOIN = 128;
const cle = (ix: number, iz: number): number => (ix + 32768) * 65536 + (iz + 32768);

/** Points mémorisés pour les contrôles, rangés par case, dans l'ordre des abscisses. */
class Memoire {
  private readonly cases = new Map<number, { s: number; x: number; z: number; w: number }[]>();
  private readonly ordre: { s: number; k: number }[] = [];
  private tete = 0;
  constructor(readonly cell: number) {}

  ajouter(s: number, x: number, z: number, w: number): void {
    const k = cle(Math.floor(x / this.cell), Math.floor(z / this.cell));
    let l = this.cases.get(k);
    if (!l) { l = []; this.cases.set(k, l); }
    l.push({ s, x, z, w });
    this.ordre.push({ s, k });
  }

  /** Retire les points d'abscisse ≥ `s` (annulation d'un morceau refusé). */
  annulerDepuis(s: number): void {
    while (this.ordre.length > this.tete && this.ordre[this.ordre.length - 1].s >= s) {
      const e = this.ordre.pop()!;
      const l = this.cases.get(e.k)!;
      l.pop();
      if (l.length === 0) this.cases.delete(e.k);
    }
  }

  /** Oublie les points d'abscisse < `s`. */
  oublierAvant(s: number): void {
    while (this.tete < this.ordre.length && this.ordre[this.tete].s < s) {
      const e = this.ordre[this.tete++];
      const l = this.cases.get(e.k)!;
      l.shift();
      if (l.length === 0) this.cases.delete(e.k);
    }
    if (this.tete > 4096) { this.ordre.splice(0, this.tete); this.tete = 0; }
  }

  /** Le point (x, z) d'abscisse `s` respecte-t-il les écarts avec tous les points mémorisés dans `rayon` m ? */
  libre(s: number, x: number, z: number, w: number, rayon: number): boolean {
    const c = this.cell;
    const x0 = Math.floor((x - rayon) / c), x1 = Math.floor((x + rayon) / c);
    const z0 = Math.floor((z - rayon) / c), z1 = Math.floor((z + rayon) / c);
    for (let iz = z0; iz <= z1; iz++) {
      for (let ix = x0; ix <= x1; ix++) {
        const l = this.cases.get(cle(ix, iz));
        if (!l) continue;
        for (const p of l) {
          const e = ecartExige(s, p.s, w, p.w);
          if (e > 0 && (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < e * e) return false;
        }
      }
    }
    return true;
  }

  /** Nombre de points mémorisés (tests : la mémoire reste bornée). */
  get taille(): number { return this.ordre.length - this.tete; }
}

export class Dessinateur {
  private readonly alea: Alea;
  private readonly ech: TrackSample[] = [];
  /** abscisse (= indice global) du premier échantillon gardé */
  private base = 0;
  private etat: Etat;
  private readonly fine = new Memoire(CASE_FINE);
  private readonly loin = new Memoire(CASE_LOIN);
  /** points tous les 10 m, pour la direction générale (on s'éloigne de la route déjà faite) */
  private readonly trace: { s: number; x: number; z: number }[] = [];
  private dernierSigne = 1;
  /** morceaux refusés puis remplacés (statistique) et morceaux gardés sans contrôle complet (secours) */
  refus = 0;
  echecsFins = 0;
  echecsLoin = 0;
  secours = 0;

  constructor(seed: number, private readonly regions: Regions) {
    this.alea = new Alea((seed ^ 0x51f15e) >>> 0);
    const [w0] = LARGEUR[regions.melange(0).a];
    this.etat = { x: 0, z: 0, psi: 0, k: 0, y: 0, g: 0, gCible: 0, gRestant: 120, w: w0 + 0.8, wCible: w0 + 0.8 };
    this.pousser(this.etat, 0);
    this.poser([{ len: 90, k0: 0, k1: 0 }], 'force');
  }

  /** Nombre d'échantillons générés depuis le départ (abscisse de fin + 1). */
  get fin(): number { return this.base + this.ech.length; }

  /** Échantillon d'abscisse `i` (doit être généré et pas encore oublié). */
  echantillon(i: number): TrackSample {
    const sp = this.ech[i - this.base];
    if (!sp) throw new Error(`échantillon ${i} indisponible (${this.base}..${this.fin - 1})`);
    return sp;
  }

  /** Premier indice encore disponible. */
  get debut(): number { return this.base; }

  /** Génère la route jusqu'à l'abscisse `i` au moins. */
  genererJusqua(i: number): void {
    while (this.fin <= i) this.morceau();
  }

  /** Libère les échantillons d'abscisse < `i` (la mémoire des contrôles garde ses propres points). */
  oublierAvant(i: number): void {
    const n = Math.min(this.ech.length - 1, i - this.base);
    if (n <= 0) return;
    this.ech.splice(0, n);
    this.base += n;
  }

  /** Taille de la mémoire des contrôles (tests). */
  get tailleMemoire(): number { return this.fine.taille + this.loin.taille + this.trace.length + this.ech.length; }

  // --- génération

  private pousser(e: Etat, s: number): TrackSample {
    const tx = Math.sin(e.psi), tz = Math.cos(e.psi);
    const sp: TrackSample = { x: e.x, y: e.y, z: e.z, tx, tz, nx: tz, nz: -tx, w: e.w, s, k: e.k, grade: e.g };
    this.ech.push(sp);
    return sp;
  }

  /** Cap vers lequel la route doit tendre : à l'opposé du centre de la route récente (elle s'en éloigne). */
  private capGeneral(): number {
    const e = this.etat;
    const s = this.fin - 1;
    let sx = 0, sz = 0, n = 0;
    for (let i = this.trace.length - 1; i >= 0 && this.trace[i].s > s - 1600; i--) { sx += this.trace[i].x; sz += this.trace[i].z; n++; }
    if (n < 25) return 0;
    const dx = e.x - sx / n, dz = e.z - sz / n;
    return Math.atan2(dx, dz);
  }

  private themeIci(): { poids: Record<TypeMorceau, number>; pente: number; largeur: [number, number] } {
    const m = this.regions.melange(this.fin);
    const pa = POIDS[m.a], pb = POIDS[m.b];
    const poids = {} as Record<TypeMorceau, number>;
    for (const k of Object.keys(pa) as TypeMorceau[]) poids[k] = pa[k] * (1 - m.t) + pb[k] * m.t;
    const la = LARGEUR[m.a], lb = LARGEUR[m.b];
    return {
      poids,
      pente: PENTE_MAX[m.a] * (1 - m.t) + PENTE_MAX[m.b] * m.t,
      largeur: [la[0] * (1 - m.t) + lb[0] * m.t, la[1] * (1 - m.t) + lb[1] * m.t],
    };
  }

  /** Virage de signe `sg`, rayon `r`, angle `a` (rad), clothoïdes d'entrée et de sortie de `lc` m. */
  private virage(sg: number, r: number, a: number, lc: number): Seg[] {
    const k = sg / r;
    lc = Math.min(lc, a * r * 0.45);
    const arc = Math.max(0, a * r - lc);
    return [{ len: lc, k0: 0, k1: k }, { len: arc, k0: k, k1: k }, { len: lc, k0: k, k1: 0 }];
  }

  private tirerType(poids: Record<TypeMorceau, number>, essai: number): TypeMorceau {
    const types = Object.keys(poids) as TypeMorceau[];
    // après plusieurs refus : morceaux simples, plus faciles à caser
    const w = types.map((t) => (essai >= 4 && (t === 'epingle' || t === 'lacet' || t === 'S') ? 0 : poids[t]));
    const tot = w.reduce((a, b) => a + b, 0);
    let r = this.alea.next() * tot;
    for (let i = 0; i < types.length; i++) { r -= w[i]; if (r < 0) return types[i]; }
    return 'droite';
  }

  private morceauAleatoire(essai: number): { segs: Seg[]; largeur: number } {
    const a = this.alea;
    const th = this.themeIci();
    const ecart = wrapAngle(this.etat.psi - this.capGeneral());
    // signe : on revient vers le cap général quand on s'en écarte, sinon au hasard (en évitant de répéter)
    let sg = a.next() < 0.6 ? -this.dernierSigne : this.dernierSigne;
    if (Math.abs(ecart) > 0.55 && a.next() < 0.88) sg = ecart > 0 ? -1 : 1;
    if (essai >= 6) sg = ecart > 0 ? -1 : 1;
    const type = this.tirerType(th.poids, essai);
    const largeur = th.largeur[0] + th.largeur[1] * a.next();
    // angle maximal pour ne pas dépasser ±110° autour du cap général
    const marge = (ang: number): number => clamp(ang, 0.2, Math.max(0.2, 1.9 - ecart * sg));
    let segs: Seg[];
    switch (type) {
      case 'droite':
        segs = [{ len: a.entre(60, 200), k0: 0, k1: 0 }];
        break;
      case 'courbe':
        segs = this.virage(sg, a.entre(90, 230), marge(a.entre(0.5, 1.6)), a.entre(25, 45));
        break;
      case 'virage':
        segs = this.virage(sg, a.entre(40, 90), marge(a.entre(0.7, 2)), a.entre(18, 32));
        break;
      case 'angle':
        segs = [...this.virage(sg, a.entre(24, 40), marge(a.entre(1.35, 1.65)), 12), { len: a.entre(40, 120), k0: 0, k1: 0 }];
        break;
      case 'S': {
        const r1 = a.entre(38, 80), a1 = a.entre(0.6, 1.3);
        segs = [...this.virage(sg, r1, a1, 18), { len: a.entre(0, 25), k0: 0, k1: 0 }, ...this.virage(-sg, a.entre(38, 80), a1 * a.entre(0.8, 1.2), 18)];
        break;
      }
      case 'epingle': {
        // épingle puis contre-virage : la route repart de l'autre côté, sans revenir sur ses pas
        const r = a.entre(16, 24);
        segs = [
          { len: a.entre(20, 50), k0: 0, k1: 0 },
          ...this.virage(sg, r, a.entre(2.7, 3.1), 16),
          { len: a.entre(25, 60), k0: 0, k1: 0 },
          ...this.virage(-sg, a.entre(40, 70), a.entre(1.7, 2.4), 22),
        ];
        return { segs, largeur: Math.max(largeur, 5) };
      }
      case 'lacet': {
        // deux épingles de sens opposés : la route se décale et garde son cap
        const r = a.entre(18, 24);
        segs = [
          { len: a.entre(20, 40), k0: 0, k1: 0 },
          ...this.virage(sg, r, Math.PI, 16),
          { len: a.entre(45, 80), k0: 0, k1: 0 },
          ...this.virage(-sg, r, Math.PI, 16),
          { len: a.entre(30, 60), k0: 0, k1: 0 },
        ];
        return { segs, largeur: Math.max(largeur, 5) };
      }
    }
    this.dernierSigne = sg;
    return { segs, largeur };
  }

  /** Un morceau de route : plusieurs essais, puis un morceau de secours tourné vers le cap général. */
  private morceau(): void {
    for (let essai = 0; essai < 14; essai++) {
      const m = this.morceauAleatoire(essai);
      this.etat.wCible = m.largeur;
      if (this.poser(m.segs, 'complet')) return;
      this.refus++;
    }
    // secours : courbe vers le cap général (seul le croisement proche est encore interdit), puis de l'autre côté, puis ligne droite
    const ecart = wrapAngle(this.etat.psi - this.capGeneral());
    const sg = ecart > 0 ? -1 : 1;
    this.secours++;
    this.etat.wCible = this.themeIci().largeur[0];
    for (const [signe, r] of [[sg, 120], [sg, 60], [-sg, 120], [-sg, 60]]) {
      if (this.poser(this.virage(signe, r, clamp(Math.abs(ecart), 0.4, 1.5), 30), 'proche')) return;
    }
    this.poser([{ len: 40, k0: 0, k1: 0 }], 'force');
  }

  /**
   * Intègre les tronçons au mètre ; renvoie false (et annule tout) si un point viole les écarts : tous (`complet`),
   * seulement le croisement proche (`proche`), ou aucun (`force`).
   */
  private poser(segs: Seg[], mode: 'complet' | 'proche' | 'force'): boolean {
    const avant = { ...this.etat };
    const n0 = this.ech.length;
    const s0 = this.fin;
    const e = this.etat;
    const th = this.themeIci();
    let ok = true;
    let s = s0;
    outer: for (const seg of segs) {
      const n = Math.round(seg.len);
      for (let j = 0; j < n; j++) {
        // courbure au milieu du pas (intégration du point milieu)
        const u0 = j / n, u1 = (j + 1) / n;
        const kMid = seg.k0 + (seg.k1 - seg.k0) * (u0 + u1) / 2;
        const psiMid = e.psi + kMid * 0.5;
        e.x += Math.sin(psiMid);
        e.z += Math.cos(psiMid);
        e.psi = wrapAngle(e.psi + kMid);
        e.k = seg.k0 + (seg.k1 - seg.k0) * u1;
        this.profil(e, th.pente);
        const sp = this.pousser(e, s);
        if (mode !== 'force' && s % 2 === 0) {
          if (!this.fine.libre(s, sp.x, sp.z, sp.w, 2 * 7 + DEGAGEMENT + 2)) { ok = false; this.echecsFins++; break outer; }
          if (mode === 'complet' && s % 10 === 0 && !this.loin.libre(s, sp.x, sp.z, sp.w, ECART_LOIN)) { ok = false; this.echecsLoin++; break outer; }
        }
        if (s % 2 === 0) this.fine.ajouter(s, sp.x, sp.z, sp.w);
        if (s % 10 === 0) { this.loin.ajouter(s, sp.x, sp.z, sp.w); this.trace.push({ s, x: sp.x, z: sp.z }); }
        s++;
      }
    }
    if (!ok) {
      this.ech.length = n0;
      this.fine.annulerDepuis(s0);
      this.loin.annulerDepuis(s0);
      while (this.trace.length > 0 && this.trace[this.trace.length - 1].s >= s0) this.trace.pop();
      this.etat = avant;
      return false;
    }
    const oubli = this.fin - MEMOIRE;
    this.fine.oublierAvant(oubli);
    this.loin.oublierAvant(oubli);
    while (this.trace.length > 0 && this.trace[0].s < oubli) this.trace.shift();
    return true;
  }

  /** Hauteur, pente et largeur au mètre suivant (pente lissée, cible renouvelée tous les 150 à 400 m). */
  private profil(e: Etat, penteMax: number): void {
    e.gRestant -= 1;
    if (e.gRestant <= 0) {
      e.gRestant = 150 + 250 * this.alea.next();
      let g = (this.alea.next() * 2 - 1) * penteMax;
      // la route reste entre −30 et 130 m : au-delà, elle repart dans l'autre sens
      if (e.y > 100) g = -Math.abs(g) - 0.01;
      if (e.y < -10) g = Math.abs(g) + 0.01;
      e.gCible = g;
    }
    const serre = Math.abs(e.k) > 1 / 40;
    const lim = serre ? Math.min(penteMax, 0.035) : penteMax;
    const cible = clamp(e.gCible, -lim, lim);
    e.g += clamp(cible - e.g, -0.0012, 0.0012);
    e.y += e.g;
    e.w += clamp(e.wCible - e.w, -0.02, 0.02);
  }
}
