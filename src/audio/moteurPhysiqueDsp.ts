/**
 * Synthèse physique d'un moteur à pistons, d'après le générateur d'Antonio-R1
 * (https://github.com/Antonio-R1/engine-sound-generator, licence MIT, © 2021-2022 Antonio-R1),
 * lui-même tiré de Baldan, Lachambre, Delle Monache et Boussard, « Physically informed car engine sound synthesis
 * for virtual and augmented environments » (2015).
 *
 * Chaque cylindre est un guide d'onde (tube acoustique) relié à une admission, un échappement et un collecteur ;
 * les soupapes ouvrent et ferment ces tubes au fil du cycle à quatre temps, l'allumage injecte une impulsion.
 * Les collecteurs se rejoignent dans une ligne droite, un silencieux et une sortie. On entend le mélange de
 * l'admission, des vibrations du bloc et de la sortie d'échappement.
 *
 * Adaptations pour le jeu : guides d'onde à tampon circulaire unique (plus rapides, même délai), longueurs
 * données à 44,1 kHz et converties à la fréquence du contexte, accélérateur qui dose l'allumage et le souffle
 * d'admission (en décélération le moteur est plus sourd), mélange des trois sorties dans une seule voie,
 * coupe-continu, garde-fou contre la divergence. Le bruit du vilebrequin est centré sur zéro (l'original, de
 * moyenne 0,125, décalait chaque cylindre : allumages irréguliers) ; l'irrégularité est un réglage du profil.
 *
 * La classe ne dépend de RIEN d'extérieur (ni import, ni variable du module) : `sourceWorkletMoteur` recopie son
 * code source dans l'AudioWorklet, où elle tourne sur le fil audio.
 */

/** Réglages d'un moteur (longueurs en échantillons à 44,1 kHz). */
export interface ProfilMoteur {
  cylindres: number;
  admission: number;
  echappement: number;
  collecteur: number;
  ligne: number;
  silencieux: number[];
  /** couplage des chambres du silencieux (0..1) */
  action: number;
  sortie: number;
  /** durée de la combustion, en fraction du cycle */
  allumage: number;
  /** mélange des trois sorties */
  mix: { admission: number; bloc: number; sortie: number };
  /** correction de niveau (1 par défaut) pour que tous les moteurs sonnent à peu près aussi fort */
  niveau?: number;
  /** écart d'allumage d'un cylindre au suivant, en fraction du cycle (0 : allumages réguliers ; V8 « borborygme » : ~0,03) */
  irregularite?: number;
}

interface Guide { haut: Float32Array; bas: Float32Array; i: number; n: number; refG: number; refD: number; sortieG: number; sortieD: number }

export class MoteurPhysiqueDSP {
  private readonly cyl: { bloc: Guide; adm: Guide; ech: Guide; col: Guide }[] = [];
  private readonly ligne: Guide;
  private readonly sil: Guide[];
  private readonly sortie: Guide;
  private readonly invN: number;
  private readonly dt: number;
  private readonly allumage: number;
  private readonly irregularite: number;
  private readonly mix: { admission: number; bloc: number; sortie: number };
  /** le niveau grandit avec le nombre de cylindres : ramené à peu près au même pour tous les moteurs */
  private readonly norme: number;
  private tour = 0;
  private filtreAdm = 0;
  private filtreVil = 0;
  private filtreBloc = 0;
  private silG = 0;
  private silD = 0;
  /** filtres anti-composante continue (le modèle dérive vers une valeur moyenne non nulle) : entrée et sortie précédentes */
  private readonly dc = new Float64Array(6);
  private readonly rDc: number;
  private readonly aAdm: number;
  private readonly aVil: number;
  private readonly aBloc: number;

  constructor(p: ProfilMoteur, frequence: number) {
    const echelle = frequence / 44100;
    const guide = (longueur: number, refG: number, refD: number): Guide => {
      const n = Math.max(1, Math.round(longueur * echelle));
      return { haut: new Float32Array(n), bas: new Float32Array(n), i: 0, n, refG, refD, sortieG: 0, sortieD: 0 };
    };
    for (let c = 0; c < p.cylindres; c++) {
      this.cyl.push({
        bloc: guide(10, 0.75, 0.75),
        adm: guide(p.admission, 0.01, 0.01),
        ech: guide(p.echappement, 0.95, 0.01),
        col: guide(p.collecteur, 0.01, 0.01),
      });
    }
    this.ligne = guide(p.ligne, 0.01, 0.01);
    this.sil = p.silencieux.map((l) => guide(l, 0, p.action));
    this.sortie = guide(p.sortie, 0.01, 0.01);
    this.invN = 1 / p.cylindres;
    this.dt = 1 / frequence;
    this.allumage = p.allumage;
    this.irregularite = p.irregularite ?? 0;
    this.mix = p.mix;
    this.norme = (p.niveau ?? 1) / (0.25 * Math.pow(p.cylindres, 1.25));
    // passe-bas du premier ordre (coefficient pour la fréquence du contexte)
    const alpha = (f: number): number => { const k = 2 * Math.PI * f / frequence; return k / (k + 1); };
    this.aAdm = alpha(11000);
    this.aVil = alpha(75);
    this.aBloc = alpha(125);
    this.rDc = 1 - 2 * Math.PI * 20 / frequence;
  }

  /** Remet tous les tubes et filtres au repos. */
  private vider(): void {
    const tous = [this.ligne, this.sortie, ...this.sil];
    for (const c of this.cyl) tous.push(c.bloc, c.adm, c.ech, c.col);
    for (const g of tous) { g.haut.fill(0); g.bas.fill(0); g.sortieG = 0; g.sortieD = 0; }
    this.dc.fill(0);
    this.filtreAdm = this.filtreVil = this.filtreBloc = this.silG = this.silD = 0;
  }

  /** Coupe-continu du premier ordre (≈ 20 Hz) sur la voie `v` (0 : admission, 1 : bloc, 2 : sortie). */
  private sansContinu(v: number, x: number): number {
    const d = this.dc, y = x - d[2 * v] + this.rDc * d[2 * v + 1];
    d[2 * v] = x; d[2 * v + 1] = y;
    return y;
  }

  /** Un pas du guide d'onde : entrées à gauche et à droite, réflexions aux extrémités, délai de `n` échantillons. */
  private pas(g: Guide, gauche: number, droite: number): void {
    const b = g.bas[g.i], h = g.haut[g.i];
    g.sortieG = b * (1 - g.refG);
    g.sortieD = h * (1 - g.refD);
    g.haut[g.i] = gauche + b * g.refG;
    g.bas[g.i] = droite + h * g.refD;
    g.i = g.i + 1 === g.n ? 0 : g.i + 1;
  }

  /** Remplit `sortie` ; `rpm` et `gaz` (0..1) : une valeur par échantillon, ou une seule pour tout le bloc. */
  rendre(sortie: Float32Array, rpm: ArrayLike<number>, gaz: ArrayLike<number>): void {
    const PI4 = 4 * Math.PI;
    const n = this.cyl.length, invSil = 1 / this.sil.length;
    for (let k = 0; k < sortie.length; k++) {
      const r = rpm.length > 1 ? rpm[k] : rpm[0];
      const g = Math.min(1, Math.max(0, gaz.length > 1 ? gaz[k] : gaz[0]));
      // souffle d'admission (bruit filtré) et légère irrégularité du vilebrequin
      this.filtreAdm += this.aAdm * (2 * Math.random() - 1 - this.filtreAdm);
      const souffle = r < 25 ? 0 : this.filtreAdm * (0.5 + 0.5 * g);
      this.filtreVil += this.aVil * (0.25 * (Math.random() - 0.5) - this.filtreVil);
      const charge = 0.35 + 0.65 * g;
      let bloc = 0, adm = 0, versLigne = 0;
      const ligneG = this.ligne.sortieG;
      for (let c = 0; c < n; c++) {
        const cy = this.cyl[c];
        let x = (this.tour + c * (this.invN + this.irregularite + this.filtreVil)) % 1;
        if (x < 0) x += 1;
        const soupEch = x > 0.75 ? -Math.sin(PI4 * x) : 0;
        const soupAdm = x < 0.25 ? Math.sin(PI4 * x) : 0;
        const piston = Math.cos(PI4 * x);
        const feu = x < 0.5 * this.allumage ? Math.sin(2 * Math.PI * (x / this.allumage)) : 0;
        // les soupapes ouvrent (réflexion 0,01) ou ferment (0,95) les tubes
        const refAdm = 0.01 * soupAdm + 0.95 * (1 - soupAdm);
        const refEch = 0.01 * soupEch + 0.95 * (1 - soupEch);
        cy.adm.refD = refAdm; cy.bloc.refG = refAdm;
        cy.ech.refG = refEch; cy.bloc.refD = refEch;
        const amplitude = piston * 1.5 + feu * 5 * charge;
        const colG = cy.col.sortieG, blocG = cy.bloc.sortieG, blocD = cy.bloc.sortieD, admD = cy.adm.sortieD;
        this.pas(cy.col, cy.ech.sortieD, ligneG);
        this.pas(cy.ech, blocD, colG);
        this.pas(cy.bloc, amplitude + admD * (1 - cy.adm.refD), colG * (1 - cy.ech.refG));
        this.pas(cy.adm, souffle * soupAdm, blocG * (1 - cy.adm.refD));
        bloc += cy.bloc.sortieG;
        adm += cy.adm.sortieG;
        versLigne += cy.col.sortieD;
      }
      this.tour += this.dt * r / 120;
      if (this.tour > 1) this.tour -= 1;
      // ligne droite → silencieux (chambres en parallèle) → sortie
      this.pas(this.ligne, versLigne, this.silG);
      this.pas(this.sortie, this.silD, 0);
      const entree = this.ligne.sortieD * invSil, retour = this.sortie.sortieG * invSil;
      let sg = 0, sd = 0;
      for (const ch of this.sil) { sg += ch.sortieG; sd += ch.sortieD; this.pas(ch, entree, retour); }
      this.silG = sg; this.silD = sd;
      this.filtreBloc += this.aBloc * (bloc - this.filtreBloc);
      const y = this.norme * (this.mix.admission * this.sansContinu(0, adm) + this.mix.bloc * this.sansContinu(1, this.filtreBloc)
        + this.mix.sortie * this.sansContinu(2, this.sortie.sortieD));
      // garde-fou : si le modèle diverge malgré tout, on repart du silence plutôt que de saturer
      if (!(Math.abs(y) < 8)) { this.vider(); sortie[k] = 0; } else sortie[k] = y;
    }
  }
}
