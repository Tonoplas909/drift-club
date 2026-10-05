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
 * code source dans l'AudioWorklet, où elle tourne sur le fil audio. D'où des champs `declare` initialisés dans le
 * constructeur : un champ de classe ordinaire est réécrit à la compilation en appel à une fonction utilitaire du
 * paquet (`__publicField`, minifiée), absente du module (un test compile et exécute ce code comme en production).
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
  /**
   * Moteur rotatif à lumières agrandies (RX-7, RX-8 préparées) : pas de soupapes mais des lumières qui s'ouvrent
   * d'un coup et se chevauchent (`recouvrement`, fraction du cycle). Au ralenti, les gaz brûlés repassent à
   * l'admission : une combustion sur quelques-unes rate à moitié, par groupes (le « brap brap »). `brap` (0..1) :
   * intensité de ces ratés au ralenti, qui s'effacent avec le régime et l'accélérateur.
   */
  rotatif?: { recouvrement: number; brap: number };
}

interface Guide { haut: Float32Array; bas: Float32Array; i: number; n: number; refG: number; refD: number; sortieG: number; sortieD: number }

export class MoteurPhysiqueDSP {
  declare private readonly cyl: { bloc: Guide; adm: Guide; ech: Guide; col: Guide }[];
  declare private readonly ligne: Guide;
  declare private readonly sil: Guide[];
  declare private readonly sortie: Guide;
  declare private readonly invN: number;
  declare private readonly dt: number;
  declare private readonly allumage: number;
  declare private readonly irregularite: number;
  declare private readonly rotatif: { recouvrement: number; brap: number } | null;
  /** rotatif : force de la combustion en cours de chaque chambre, numéro de son dernier cycle, gaz résiduels accumulés */
  declare private readonly force: Float64Array;
  declare private readonly cyclePrec: Float64Array;
  /** cycles écoulés, sans repli (le bruit du vilebrequin ne doit pas faire compter deux fois un passage) */
  declare private cycles: number;
  declare private residus: number;
  /** rotatif : série de combustions ratées en cours (jusqu'à ce que la chambre se soit vidée de ses gaz brûlés) */
  declare private enRate: boolean;
  /** rotatif : combustions renforcées restantes après une série de ratés (le carburant imbrûlé s'enflamme : le « BRAP ») */
  declare private claques: number;
  declare private derive: number;
  declare private readonly mix: { admission: number; bloc: number; sortie: number };
  /** le niveau grandit avec le nombre de cylindres : ramené à peu près au même pour tous les moteurs */
  declare private readonly norme: number;
  declare private tour: number;
  declare private filtreAdm: number;
  declare private filtreVil: number;
  declare private filtreBloc: number;
  declare private silG: number;
  declare private silD: number;
  /** filtres anti-composante continue (le modèle dérive vers une valeur moyenne non nulle) : entrée et sortie précédentes */
  declare private readonly dc: Float64Array;
  declare private readonly rDc: number;
  declare private readonly aAdm: number;
  declare private readonly aVil: number;
  declare private readonly aBloc: number;

  constructor(p: ProfilMoteur, frequence: number) {
    // (champs déclarés avec `declare` et initialisés ici : aucun champ de classe dans le code compilé, voir l'en-tête)
    this.cyl = [];
    this.cycles = 0;
    this.residus = 0;
    this.enRate = false;
    this.claques = 0;
    this.derive = 0;
    this.tour = 0;
    this.filtreAdm = 0;
    this.filtreVil = 0;
    this.filtreBloc = 0;
    this.silG = 0;
    this.silD = 0;
    this.dc = new Float64Array(6);
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
    this.rotatif = p.rotatif ?? null;
    this.force = new Float64Array(p.cylindres).fill(1);
    this.cyclePrec = new Float64Array(p.cylindres);
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
      let r = rpm.length > 1 ? rpm[k] : rpm[0];
      const g = Math.min(1, Math.max(0, gaz.length > 1 ? gaz[k] : gaz[0]));
      // rotatif : les ratés n'existent qu'au ralenti, gaz relâchés
      const ralenti = this.rotatif ? this.rotatif.brap * Math.min(1, Math.max(0, (3200 - r) / 2000)) * (1 - 0.85 * g) : 0;
      if (ralenti > 0) {
        // le ralenti « chasse » un peu (±4 %), au rythme lent des ratés
        this.derive += 0.0004 * ((Math.random() - 0.5) - 0.002 * this.derive);
        r *= 1 + 0.04 * ralenti * Math.max(-1, Math.min(1, this.derive * 8));
      }
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
        let soupEch: number, soupAdm: number;
        if (this.rotatif) {
          // lumières : ouverture brutale, fermeture progressive ; l'admission s'ouvre avant la fin de l'échappement
          const rec = this.rotatif.recouvrement;
          soupEch = x > 0.7 ? Math.min(1, (x - 0.7) / 0.015) * (x > 0.97 ? (1 - x) / 0.03 : 1) : 0;
          soupAdm = x < 0.28 ? Math.min(1, x / 0.01) * (x > 0.22 ? (0.28 - x) / 0.06 : 1) : x > 1 - rec ? (x - (1 - rec)) / rec : 0;
          // nouvelle combustion pour cette chambre : sa force dépend des gaz résiduels laissés par les précédentes
          // les gaz brûlés s'accumulent sur une salve de bonnes combustions (≈ 6 à 10), puis quelques ratés d'affilée
          // vidangent la chambre : « BRAP… BRAP… », environ trois salves par seconde au ralenti
          const cycle = Math.floor(this.cycles + c * (this.invN + this.irregularite));
          if (cycle !== this.cyclePrec[c]) {
            this.cyclePrec[c] = cycle;
            if (ralenti <= 0) { this.enRate = false; this.residus = 0; this.claques = 0; }
            else if (!this.enRate && this.residus > 1) this.enRate = true;
            else if (this.enRate && this.residus < 0.3 + 0.2 * Math.random()) { this.enRate = false; this.claques = 2; }
            const rate = this.enRate;
            if (rate) this.force[c] = 0.04 + 0.16 * Math.random();
            else if (this.claques > 0) { this.force[c] = 1.5 + 0.4 * Math.random(); this.claques--; }
            else this.force[c] = 0.9 + 0.35 * Math.random();
            this.residus = Math.max(0, this.residus + (rate ? -0.17 : (0.08 + 0.08 * Math.random()) * ralenti));
          }
        } else {
          soupEch = x > 0.75 ? -Math.sin(PI4 * x) : 0;
          soupAdm = x < 0.25 ? Math.sin(PI4 * x) : 0;
        }
        const piston = Math.cos(PI4 * x);
        const feu = x < 0.5 * this.allumage ? Math.sin(2 * Math.PI * (x / this.allumage)) * this.force[c] : 0;
        // les soupapes ouvrent (réflexion 0,01) ou ferment (0,95) les tubes
        const refAdm = 0.01 * soupAdm + 0.95 * (1 - soupAdm);
        const refEch = 0.01 * soupEch + 0.95 * (1 - soupEch);
        cy.adm.refD = refAdm; cy.bloc.refG = refAdm;
        cy.ech.refG = refEch; cy.bloc.refD = refEch;
        // rotatif : un rotor tourne au lieu d'aller et venir (mouvement plus doux), la combustion domine même gaz relâchés
        const amplitude = this.rotatif ? piston * 0.4 + feu * 5 * Math.max(charge, 0.75) : piston * 1.5 + feu * 5 * charge;
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
      this.cycles += this.dt * r / 120;
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
