import type { Level, CoteBarriere, TypeObjet } from './types';
import { loadLevel } from '../loadLevel';

/** Codes de partage (§11) : « 1.<base64url(deflate-raw(JSON compact))> ». N'utilise que des globales de la plateforme web. */
export const VERSION_CODE = 1;
/** Taille maximale du JSON décompressé (protège d'une bombe de décompression). */
export const TAILLE_MAX_DECOMPRESSE = 200_000;
/** Longueur maximale de la partie base64url d'un code. */
export const LONGUEUR_MAX_CODE = 150_000;

const AMBIANCES = ['jour', 'coucher'] as const;
const ENVIRONNEMENTS = ['montagne'] as const;
const COTES: readonly CoteBarriere[] = ['gauche', 'droite', 'deux', 'ext'];
const TYPES: readonly TypeObjet[] = ['arbre', 'sapin', 'rocher', 'pneus', 'barriere', 'panneau'];

export type ResultatDecodage = { ok: true; level: Level } | { ok: false; erreurs: string[] };

const MSG_CODE = 'Code de niveau invalide ou abîmé.';
const MSG_NAVIGATEUR = "Ton navigateur ne sait pas compresser les liens de partage (il faut une version récente).";

/** Arrondi à 0,1 (sans « −0 »). */
const d1 = (v: number): number => Math.round(v * 10) / 10 + 0;

/**
 * Niveau tel qu'il sera après un aller-retour par un code : coordonnées, hauteurs et largeurs au 0,1 m,
 * rotations au degré, densité au centième. C'est ce niveau (et son empreinte) que voient tous les destinataires.
 */
export function normaliserNiveau(level: Level): Level {
  return {
    format: 1,
    nom: level.nom.trim(),
    auteur: level.auteur,
    environnement: level.environnement,
    ambiance: level.ambiance,
    route: level.route.map((p) => ({ x: d1(p.x), z: d1(p.z), y: d1(p.y), l: d1(p.l) })),
    barrieres: level.barrieres.map((b) => ({ de: b.de, a: b.a, cote: b.cote })),
    decor: { graine: level.decor.graine, densite: Math.round(level.decor.densite * 100) / 100 + 0 },
    objets: level.objets.map((o) => ({ type: o.type, x: d1(o.x), z: d1(o.z), rot: Math.round(o.rot) + 0 })),
  };
}

// ───────────────────────── JSON compact ─────────────────────────

/** Clés courtes ; la route est stockée en différences successives (x, z, y, l) × 10, ce qui compresse mieux. */
function compacter(l: Level): unknown {
  let px = 0, pz = 0, py = 0, pl = 0;
  const r = l.route.map((p) => {
    const x = Math.round(p.x * 10), z = Math.round(p.z * 10), y = Math.round(p.y * 10), w = Math.round(p.l * 10);
    const d = [x - px, z - pz, y - py, w - pl];
    px = x; pz = z; py = y; pl = w;
    return d;
  });
  return {
    n: l.nom,
    a: l.auteur,
    e: ENVIRONNEMENTS.indexOf(l.environnement),
    m: AMBIANCES.indexOf(l.ambiance),
    r,
    b: l.barrieres.map((b) => [b.de, b.a, COTES.indexOf(b.cote)]),
    d: [l.decor.graine, Math.round(l.decor.densite * 100)],
    o: l.objets.map((o) => [TYPES.indexOf(o.type), Math.round(o.x * 10), Math.round(o.z * 10), Math.round(o.rot)]),
  };
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const estEntier = (v: unknown): v is number => estNombre(v) && Number.isInteger(v);
const tuples = (v: unknown, n: number): v is number[][] =>
  Array.isArray(v) && v.every((t) => Array.isArray(t) && t.length === n && t.every(estNombre));

/** Reconstruit le niveau brut (format §5.1) à partir du JSON compact ; null si la forme est mauvaise. */
function developper(c: unknown): unknown | null {
  if (!estObjet(c)) return null;
  const { n, a, e, m, r, b, d, o } = c;
  if (typeof n !== 'string' || typeof a !== 'string') return null;
  if (!estEntier(e) || !ENVIRONNEMENTS[e] || !estEntier(m) || !AMBIANCES[m]) return null;
  if (!tuples(r, 4) || !tuples(b, 3) || !tuples(o, 4)) return null;
  if (!Array.isArray(d) || d.length !== 2 || !estNombre(d[0]) || !estNombre(d[1])) return null;
  if (!b.every((t) => t.slice(0, 3).every(estEntier) && COTES[t[2]]) || !o.every((t) => estEntier(t[0]) && TYPES[t[0]])) return null;
  let x = 0, z = 0, y = 0, w = 0;
  return {
    format: 1,
    nom: n,
    auteur: a,
    environnement: ENVIRONNEMENTS[e],
    ambiance: AMBIANCES[m],
    route: r.map((t) => {
      x += t[0]; z += t[1]; y += t[2]; w += t[3];
      return { x: x / 10, z: z / 10, y: y / 10, l: w / 10 };
    }),
    barrieres: b.map((t) => ({ de: t[0], a: t[1], cote: COTES[t[2]] })),
    decor: { graine: d[0], densite: d[1] / 100 },
    objets: o.map((t) => ({ type: TYPES[t[0]], x: t[1] / 10, z: t[2] / 10, rot: t[3] })),
  };
}

// ───────────────────────── base64url ─────────────────────────

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export function versBase64url(octets: Uint8Array): string {
  let s = '';
  for (let i = 0; i < octets.length; i += 3) {
    const n = (octets[i] << 16) | ((octets[i + 1] ?? 0) << 8) | (octets[i + 2] ?? 0);
    s += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    if (i + 1 < octets.length) s += ALPHABET[(n >> 6) & 63];
    if (i + 2 < octets.length) s += ALPHABET[n & 63];
  }
  return s;
}

/** null si la chaîne n'est pas du base64url valide (sans remplissage `=`). */
export function depuisBase64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) return null;
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    let n = 0;
    const k = Math.min(4, s.length - i);
    for (let j = 0; j < 4; j++) n = (n << 6) | (j < k ? ALPHABET.indexOf(s[i + j]) : 0);
    out[o++] = (n >> 16) & 255;
    if (k > 2) out[o++] = (n >> 8) & 255;
    if (k > 3) out[o++] = n & 255;
  }
  return out;
}

// ───────────────────────── compression ─────────────────────────

class TropGros extends Error {}

/** Passe `donnees` dans un flux de (dé)compression ; abandonne au-delà de `max` octets en sortie. */
async function traverser(flux: CompressionStream | DecompressionStream, donnees: Uint8Array, max: number): Promise<Uint8Array> {
  const w = flux.writable.getWriter();
  // les erreurs d'écriture (données invalides) ressortent aussi côté lecture : on évite le rejet non géré
  void w.write(donnees as BufferSource).catch(() => undefined);
  void w.close().catch(() => undefined);
  const lecteur = flux.readable.getReader();
  const morceaux: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > max) { void lecteur.cancel().catch(() => undefined); throw new TropGros(); }
    morceaux.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const m of morceaux) { out.set(m, o); o += m.length; }
  return out;
}

// ───────────────────────── API ─────────────────────────

/** Code de partage d'un niveau (arrondi au 0,1 m, voir `normaliserNiveau`). Rejette si le navigateur n'a pas CompressionStream. */
export async function encoderNiveau(level: Level): Promise<string> {
  if (typeof globalThis.CompressionStream === 'undefined') throw new Error(MSG_NAVIGATEUR);
  const json = JSON.stringify(compacter(normaliserNiveau(level)));
  const brut = new TextEncoder().encode(json);
  const comprime = await traverser(new CompressionStream('deflate-raw'), brut, TAILLE_MAX_DECOMPRESSE * 2);
  return `${VERSION_CODE}.${versBase64url(comprime)}`;
}

/** Décode un code de partage puis le passe par la validation complète (§5.6) : aucun niveau invalide n'en sort. */
export async function decoderNiveau(code: string): Promise<ResultatDecodage> {
  const t = code.trim();
  const m = /^(\d{1,3})\.(.*)$/s.exec(t);
  if (!m) return { ok: false, erreurs: [MSG_CODE] };
  if (Number(m[1]) !== VERSION_CODE) return { ok: false, erreurs: ["Ce lien vient d'une version plus récente du jeu."] };
  if (m[2].length > LONGUEUR_MAX_CODE) return { ok: false, erreurs: ['Ce code est trop long pour être un niveau.'] };
  const octets = depuisBase64url(m[2]);
  if (!octets || octets.length === 0) return { ok: false, erreurs: [MSG_CODE] };
  if (typeof globalThis.DecompressionStream === 'undefined') return { ok: false, erreurs: [MSG_NAVIGATEUR] };
  let json: string;
  try {
    const brut = await traverser(new DecompressionStream('deflate-raw'), octets, TAILLE_MAX_DECOMPRESSE);
    json = new TextDecoder('utf-8', { fatal: true }).decode(brut);
  } catch (e) {
    return { ok: false, erreurs: [e instanceof TropGros ? 'Ce code est trop gros pour être un niveau.' : MSG_CODE] };
  }
  let compact: unknown;
  try { compact = JSON.parse(json); } catch { return { ok: false, erreurs: [MSG_CODE] }; }
  const raw = developper(compact);
  if (!raw) return { ok: false, erreurs: [MSG_CODE] };
  const r = loadLevel(raw);
  return r.ok ? { ok: true, level: r.level } : { ok: false, erreurs: r.erreurs };
}
