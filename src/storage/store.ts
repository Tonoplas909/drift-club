import type { CarId, ModeId } from '../core/physics/types';
import { CAR_IDS } from '../core/physics/cars';
import { MODE_IDS } from '../core/physics/assists';
import type { Level } from '../core/level/types';
import { validateLevel } from '../core/level/validate';
import { validerSkins, type SkinsChoisies } from '../core/skins';
import { FUMEE_DEFAUT, validerFumee, type FumeeId } from '../core/fumees';
import { offrirCaisse, progressionInitiale, validerProgression, type Progression } from '../core/economie';
import type { EtatProgressionCompte } from '../core/progressionCompte';
import { MANETTE_DEFAUT, type ReglagesManette } from '../input/gamepad';
import { lireVue, type VueCamera } from '../render/vuesEmbarquees';
import { lireTouches, touchesParDefaut, type Touches } from '../input/touches';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Qualite = 'auto' | 'basse' | 'haute';

export interface Reglages {
  mode: ModeId;
  voiture: CarId;
  couleur: string;
  /** livrée mémorisée par voiture (absente = « unie ») */
  skins: SkinsChoisies;
  /** fumée des pneus choisie, pour toutes les voitures (« classique » = celle du décor) */
  fumee: FumeeId;
  volume: number;
  muet: boolean;
  /** fond sonore du décor (vent, oiseaux, vagues…) */
  ambianceDecor: boolean;
  qualite: Qualite;
  accelAuto: boolean;
  /** caméra choisie (touche C) : poursuite, éloignée ou embarquée */
  camera: VueCamera;
  /** HUD : détail des points du drift (base × vitesse × durée × angle) */
  detailPoints: boolean;
  /** HUD : indicateur d'angle de glisse sous la voiture */
  indicateurAngle: boolean;
  /** manette : zone morte du stick et sensibilité de la direction */
  manette: ReglagesManette;
  /** touches du clavier et boutons de la manette choisis par le joueur */
  touches: Touches;
  /** fantôme de son record pendant la course */
  fantome: boolean;
}

export interface RecordEntry {
  score: number;
  temps: number;
  voiture: CarId;
  meilleurDrift: number;
  date: string;
}

/** Replay d'un record (base64), rejoué en voiture translucide pendant la course. */
export interface Fantome {
  voiture: CarId;
  replay: string;
  score: number;
}

export interface MonNiveau {
  id: string;
  level: Level;
  maj: string;
}

const K_REGLAGES = 'driftclub.v1.reglages';
const K_RECORDS = 'driftclub.v1.records';
const K_NIVEAUX = 'driftclub.v1.niveaux';
const K_PROGRESSION = 'driftclub.v1.progression';
const K_STATISTIQUES = 'driftclub.v1.statistiques';
/** statistiques du compte : dernier total connu et ajouts pas encore envoyés ({ id, stats }) ; comptes ayant reçu l'historique de l'appareil */
const K_STATS_COMPTE = 'driftclub.v1.statistiques.compte';
const K_STATS_ATTENTE = 'driftclub.v1.statistiques.attente';
const K_STATS_IMPORTEES = 'driftclub.v1.statistiques.importees';
/** replay du record de chaque niveau et mode (fantôme), le plus récent en dernier */
const K_FANTOMES = 'driftclub.v1.fantomes';
/** fantômes gardés au plus (quelques ko chacun) */
export const FANTOMES_MAX = 30;
/** dernière progression connue du compte en ligne (lecture seule hors ligne) ; la progression locale ci-dessus n'est jamais modifiée par le compte */
const K_PROGRESSION_COMPTE = 'driftclub.v1.progression-compte';
const K_LIVREES_ATELIER = 'driftclub.v1.livrees-atelier';
const K_BROUILLON_ATELIER = 'driftclub.v1.brouillon-atelier';
const QUALITES: Qualite[] = ['auto', 'basse', 'haute'];

export function memoryKV(): KV {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

/** Renvoie un stockage utilisable ; `persistent = false` si rien ne sera conservé. */
export function safeStorage(candidate?: KV | null): { kv: KV; persistent: boolean } {
  try {
    const kv = candidate === undefined ? (typeof localStorage !== 'undefined' ? localStorage : null) : candidate;
    if (!kv) return { kv: memoryKV(), persistent: false };
    kv.setItem('driftclub.test', '1');
    if (kv.getItem('driftclub.test') !== '1') throw new Error('stockage illisible');
    return { kv, persistent: true };
  } catch {
    return { kv: memoryKV(), persistent: false };
  }
}

/** Version du format des réglages enregistrés (2 : accélération automatique désactivée par défaut). */
const VERSION_REGLAGES = 2;

export function defaultReglages(touch: boolean): Reglages {
  return {
    mode: touch ? 'arcade' : 'semi',
    voiture: 'equilibree',
    couleur: '#e63b2e',
    skins: {},
    fumee: FUMEE_DEFAUT,
    volume: 0.8,
    muet: false,
    ambianceDecor: true,
    qualite: 'auto',
    // désactivée par défaut : sur téléphone la voiture avançait seule dès le premier toucher
    accelAuto: false,
    camera: 'proche',
    detailPoints: true,
    indicateurAngle: true,
    manette: { ...MANETTE_DEFAUT },
    touches: touchesParDefaut(),
    fantome: true,
  };
}

const entre = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && v >= lo && v <= hi;

function lireManette(v: unknown): ReglagesManette {
  const o = typeof v === 'object' && v !== null ? v as Record<string, unknown> : {};
  return {
    zoneMorte: entre(o.zoneMorte, 0, 0.4) ? o.zoneMorte : MANETTE_DEFAUT.zoneMorte,
    sensibilite: entre(o.sensibilite, 0, 1) ? o.sensibilite : MANETTE_DEFAUT.sensibilite,
    vibrations: typeof o.vibrations === 'boolean' ? o.vibrations : MANETTE_DEFAUT.vibrations,
  };
}

type RecordsMap = Record<string, Partial<Record<ModeId, RecordEntry>>>;

export class Store {
  constructor(private readonly kv: KV) {}

  private read(key: string): unknown {
    try {
      const s = this.kv.getItem(key);
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      this.kv.setItem(key, JSON.stringify(value));
    } catch {
      // stockage plein ou refusé : le jeu continue sans sauvegarder
    }
  }

  loadReglages(touch: boolean): Reglages {
    const d = defaultReglages(touch);
    const raw = this.read(K_REGLAGES);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return d;
    const o = raw as Record<string, unknown>;
    return {
      mode: MODE_IDS.includes(o.mode as ModeId) ? (o.mode as ModeId) : d.mode,
      voiture: CAR_IDS.includes(o.voiture as CarId) ? (o.voiture as CarId) : d.voiture,
      couleur: typeof o.couleur === 'string' && /^#[0-9a-f]{6}$/i.test(o.couleur) ? o.couleur : d.couleur,
      skins: validerSkins(o.skins),
      fumee: validerFumee(o.fumee),
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : d.volume,
      muet: typeof o.muet === 'boolean' ? o.muet : d.muet,
      ambianceDecor: typeof o.ambianceDecor === 'boolean' ? o.ambianceDecor : d.ambianceDecor,
      qualite: QUALITES.includes(o.qualite as Qualite) ? (o.qualite as Qualite) : d.qualite,
      // avant la v2 des réglages, accelAuto valait true par défaut sans choix du joueur : on l'ignore
      accelAuto: o.v === VERSION_REGLAGES && typeof o.accelAuto === 'boolean' ? o.accelAuto : d.accelAuto,
      // avant la 0.5.12 : simple choix « caméra éloignée »
      camera: lireVue(o.camera, o.cameraLoin),
      detailPoints: typeof o.detailPoints === 'boolean' ? o.detailPoints : d.detailPoints,
      indicateurAngle: typeof o.indicateurAngle === 'boolean' ? o.indicateurAngle : d.indicateurAngle,
      manette: lireManette(o.manette),
      touches: lireTouches(o.touches),
      fantome: typeof o.fantome === 'boolean' ? o.fantome : d.fantome,
    };
  }

  saveReglages(r: Reglages): void {
    this.write(K_REGLAGES, { ...r, v: VERSION_REGLAGES });
  }

  /**
   * Progression (clés, livrées gagnées). Absente : première fois → les livrées déjà choisies (`skinsChoisies`) restent
   * débloquées. La caisse offerte est créditée une seule fois ; la valeur lue est toujours validée.
   */
  loadProgression(skinsChoisies?: SkinsChoisies): Progression {
    const raw = this.read(K_PROGRESSION);
    const existe = typeof raw === 'object' && raw !== null && !Array.isArray(raw);
    const p = offrirCaisse(existe ? validerProgression(raw) : progressionInitiale(skinsChoisies));
    if (!existe || !(raw as Record<string, unknown>).caisseOfferte) this.saveProgression(p);
    return p;
  }

  saveProgression(p: Progression): void {
    this.write(K_PROGRESSION, p);
  }

  /** Identifiant du compte dont la progression est gardée sur cet appareil (null si aucun). */
  idProgressionCompte(): string | null {
    const raw = this.read(K_PROGRESSION_COMPTE);
    return typeof raw === 'object' && raw !== null && typeof (raw as Record<string, unknown>).id === 'string' ? (raw as { id: string }).id : null;
  }

  /** Dernière progression du compte `id` reçue du serveur, ou null (absente, ou d'un autre compte). */
  loadProgressionCompte(id: string): Progression | null {
    const raw = this.read(K_PROGRESSION_COMPTE);
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    return o.id === id ? validerProgression(o.progression) : null;
  }

  saveProgressionCompte(e: Pick<EtatProgressionCompte, 'id' | 'progression'>): void {
    this.write(K_PROGRESSION_COMPTE, { id: e.id, progression: e.progression });
  }

  /** Dernières livrées de l'Atelier reçues du serveur (lignes brutes, re-validées à la lecture par l'appelant). */
  /** Fantôme (replay du record) d'un niveau dans un mode, ou null. */
  loadFantome(levelKey: string, mode: ModeId): Fantome | null {
    const f = this.fantomes()[`${levelKey}|${mode}`];
    return f && typeof f.replay === 'string' && CAR_IDS.includes(f.voiture) && typeof f.score === 'number' ? f : null;
  }

  /** Garde le replay du nouveau record ; les plus anciens fantômes partent au-delà de FANTOMES_MAX. */
  saveFantome(levelKey: string, mode: ModeId, f: Fantome): void {
    const tous = this.fantomes();
    delete tous[`${levelKey}|${mode}`];
    tous[`${levelKey}|${mode}`] = f;
    const cles = Object.keys(tous);
    for (const k of cles.slice(0, Math.max(0, cles.length - FANTOMES_MAX))) delete tous[k];
    this.write(K_FANTOMES, tous);
  }

  private fantomes(): Record<string, Fantome> {
    const r = this.read(K_FANTOMES);
    return typeof r === 'object' && r !== null && !Array.isArray(r) ? (r as Record<string, Fantome>) : {};
  }

  /** Statistiques du pilote (relues et validées par `lireStatistiques`). */
  loadStatistiques(): unknown {
    return this.read(K_STATISTIQUES);
  }

  saveStatistiques(s: unknown): void {
    this.write(K_STATISTIQUES, s);
  }

  /** Données brutes gardées pour un compte (total connu ou ajouts en attente), relues par `lireStatistiques`. */
  loadStatsCompte(quoi: 'total' | 'attente', id: string): unknown {
    const raw = this.read(quoi === 'total' ? K_STATS_COMPTE : K_STATS_ATTENTE);
    return typeof raw === 'object' && raw !== null && (raw as { id?: unknown }).id === id ? (raw as { stats?: unknown }).stats ?? null : null;
  }

  saveStatsCompte(quoi: 'total' | 'attente', id: string, stats: unknown): void {
    this.write(quoi === 'total' ? K_STATS_COMPTE : K_STATS_ATTENTE, { id, stats });
  }

  /** Comptes qui ont déjà reçu l'historique de cet appareil (une seule fois par compte). */
  statsImportees(): string[] {
    const r = this.read(K_STATS_IMPORTEES);
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === 'string').slice(-20) : [];
  }

  marquerStatsImportees(id: string): void {
    this.write(K_STATS_IMPORTEES, [...this.statsImportees().filter((x) => x !== id), id]);
  }

  loadLivreesAtelier(): unknown[] {
    const raw = this.read(K_LIVREES_ATELIER);
    return Array.isArray(raw) ? raw.slice(0, 2000) : [];
  }

  saveLivreesAtelier(lignes: unknown[]): void {
    this.write(K_LIVREES_ATELIER, lignes);
  }

  /** Livrée en cours dans l'éditeur de l'Atelier (relue et re-validée par l'écran). */
  loadBrouillonAtelier(): unknown {
    return this.read(K_BROUILLON_ATELIER);
  }

  saveBrouillonAtelier(b: unknown): void {
    this.write(K_BROUILLON_ATELIER, b);
  }

  private records(): RecordsMap {
    const r = this.read(K_RECORDS);
    return typeof r === 'object' && r !== null && !Array.isArray(r) ? (r as RecordsMap) : {};
  }

  getRecord(levelKey: string, mode: ModeId): RecordEntry | null {
    const e = this.records()[levelKey]?.[mode];
    return e && typeof e.score === 'number' ? e : null;
  }

  /** Enregistre si c'est un nouveau record ; renvoie true dans ce cas. */
  submitRecord(levelKey: string, mode: ModeId, entry: RecordEntry): boolean {
    const all = this.records();
    const cur = all[levelKey]?.[mode];
    if (cur && typeof cur.score === 'number' && cur.score >= entry.score) return false;
    all[levelKey] = { ...(all[levelKey] ?? {}), [mode]: entry };
    this.write(K_RECORDS, all);
    return true;
  }

  private niveaux(): Record<string, MonNiveau> {
    const n = this.read(K_NIVEAUX);
    return typeof n === 'object' && n !== null && !Array.isArray(n) ? (n as Record<string, MonNiveau>) : {};
  }

  /** Liste les niveaux personnalisés triés par date de modification (plus récents en premier). */
  listNiveaux(): MonNiveau[] {
    const all = this.niveaux();
    const valid = Object.values(all).filter((n: MonNiveau) => {
      try {
        const v = validateLevel(n.level);
        return v.ok;
      } catch {
        return false;
      }
    });
    return valid.sort((a: MonNiveau, b: MonNiveau) => {
      return new Date(b.maj).getTime() - new Date(a.maj).getTime();
    });
  }

  /** Récupère un niveau par ID. */
  getNiveau(id: string): MonNiveau | null {
    const n = this.niveaux()[id];
    return n ?? null;
  }

  /** Sauvegarde un niveau (insert ou replace). */
  saveNiveau(n: MonNiveau): void {
    const all = this.niveaux();
    all[n.id] = n;
    this.write(K_NIVEAUX, all);
  }

  /** Supprime un niveau par ID. */
  deleteNiveau(id: string): void {
    const all = this.niveaux();
    delete all[id];
    this.write(K_NIVEAUX, all);
  }

  /** Génère un nouvel ID aléatoire. */
  nouvelId(): string {
    return Math.random().toString(36).slice(2, 10);
  }
}

/** Génère une clé pour enregistrer les records d'un niveau personnalisé. */
export function cleNiveauPerso(empreinte: string): string {
  return `perso:${empreinte}`;
}
