import type { CarId, ModeId } from '../core/physics/types';
import { CAR_IDS } from '../core/physics/cars';
import { MODE_IDS } from '../core/physics/assists';
import type { Level } from '../core/level/types';
import { validateLevel } from '../core/level/validate';

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type Qualite = 'auto' | 'basse' | 'haute';

export interface Reglages {
  mode: ModeId;
  voiture: CarId;
  couleur: string;
  volume: number;
  muet: boolean;
  qualite: Qualite;
  accelAuto: boolean;
  cameraLoin: boolean;
}

export interface RecordEntry {
  score: number;
  temps: number;
  voiture: CarId;
  meilleurDrift: number;
  date: string;
}

export interface MonNiveau {
  id: string;
  level: Level;
  maj: string;
}

const K_REGLAGES = 'driftclub.v1.reglages';
const K_RECORDS = 'driftclub.v1.records';
const K_NIVEAUX = 'driftclub.v1.niveaux';
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

export function defaultReglages(touch: boolean): Reglages {
  return {
    mode: touch ? 'arcade' : 'semi',
    voiture: 'equilibree',
    couleur: '#e63b2e',
    volume: 0.8,
    muet: false,
    qualite: 'auto',
    accelAuto: true,
    cameraLoin: false,
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
      volume: typeof o.volume === 'number' && o.volume >= 0 && o.volume <= 1 ? o.volume : d.volume,
      muet: typeof o.muet === 'boolean' ? o.muet : d.muet,
      qualite: QUALITES.includes(o.qualite as Qualite) ? (o.qualite as Qualite) : d.qualite,
      accelAuto: typeof o.accelAuto === 'boolean' ? o.accelAuto : d.accelAuto,
      cameraLoin: typeof o.cameraLoin === 'boolean' ? o.cameraLoin : d.cameraLoin,
    };
  }

  saveReglages(r: Reglages): void {
    this.write(K_REGLAGES, r);
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
