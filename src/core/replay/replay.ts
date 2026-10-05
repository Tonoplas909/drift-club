import type { InputState } from '../input';

/**
 * Enregistrement d'une course : les commandes de CHAQUE pas de simulation (1/120 s), du décompte à l'arrivée.
 * La course est déterministe : rejouer ces commandes redonne exactement le même score. Le serveur s'en sert
 * pour vérifier les scores envoyés (voir `verifier.ts`).
 *
 * Les commandes sont quantifiées AVANT d'être données à la simulation (gaz et frein sur 255 crans, direction
 * sur ±127) : le jeu et le serveur simulent donc exactement les mêmes valeurs.
 *
 * Format binaire (version 1) : un octet de version, puis des plages de pas identiques :
 * longueur (entier variable, 7 bits par octet), gaz (0..255), frein (0..255), direction (0..254, 127 = tout droit),
 * drapeaux (bit 0 : frein à main, bit 1 : replacer).
 */

export const VERSION_REPLAY = 1;

/** Un pas de simulation : commandes quantifiées + demande de replacement. */
export interface PasReplay {
  input: InputState;
  replacer: boolean;
}

const borne = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
// `| 0` : jamais de −0 (relu +0 par le serveur, il pourrait faire diverger la course)
const cranGaz = (v: number): number => Math.round(borne(Number.isFinite(v) ? v : 0, 0, 1) * 255) | 0;
const cranDir = (v: number): number => Math.round(borne(Number.isFinite(v) ? v : 0, -1, 1) * 127) | 0;

/** Commandes telles que la simulation les voit (valeurs ramenées sur les crans enregistrables). */
export function quantifier(i: InputState): InputState {
  return { gaz: cranGaz(i.gaz) / 255, frein: cranGaz(i.frein) / 255, direction: cranDir(i.direction) / 127, freinAMain: i.freinAMain };
}

/** Accumule les pas d'une course et produit le replay binaire. */
export class Enregistreur {
  private octets: number[] = [VERSION_REPLAY];
  private cle = -1;
  private run = 0;
  private enCours: number[] = [];
  /** nombre de pas enregistrés */
  pas = 0;

  ajouter(input: InputState, replacer: boolean): void {
    const g = cranGaz(input.gaz), f = cranGaz(input.frein), d = cranDir(input.direction) + 127;
    const dr = (input.freinAMain ? 1 : 0) | (replacer ? 2 : 0);
    const cle = ((g * 256 + f) * 256 + d) * 4 + dr;
    this.pas++;
    if (cle === this.cle) { this.run++; return; }
    this.vider();
    this.cle = cle;
    this.run = 1;
    this.enCours = [g, f, d, dr];
  }

  private vider(): void {
    if (this.run === 0) return;
    let n = this.run;
    while (n >= 0x80) { this.octets.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
    this.octets.push(n);
    this.octets.push(...this.enCours);
    this.run = 0;
  }

  /** Replay binaire (l'enregistreur reste utilisable). */
  octetsReplay(): Uint8Array {
    const out = [...this.octets];
    if (this.run > 0) {
      let n = this.run;
      while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
      out.push(n, ...this.enCours);
    }
    return Uint8Array.from(out);
  }
}

/**
 * Lit un replay : appelle `pas` pour chaque pas jusqu'à ce qu'il renvoie `false` ou que le replay soit fini.
 * Renvoie le nombre de pas lus, ou un message d'erreur si le replay est mal formé ou dépasse `maxPas`.
 */
export function lireReplay(octets: Uint8Array, maxPas: number, pas: (p: PasReplay) => boolean): number | string {
  if (octets.length < 1 || octets[0] !== VERSION_REPLAY) return 'Version de replay inconnue.';
  let i = 1, total = 0;
  while (i < octets.length) {
    let n = 0, mult = 1, b: number;
    do {
      if (i >= octets.length || mult > 2 ** 28) return 'Replay mal formé.';
      b = octets[i++];
      n += (b & 0x7f) * mult;
      mult *= 128;
    } while (b & 0x80);
    if (n < 1 || i + 4 > octets.length) return 'Replay mal formé.';
    const g = octets[i], f = octets[i + 1], d = octets[i + 2], dr = octets[i + 3];
    i += 4;
    if (d > 254 || dr > 3) return 'Replay mal formé.';
    const input: InputState = { gaz: g / 255, frein: f / 255, direction: (d - 127) / 127, freinAMain: (dr & 1) !== 0 };
    const replacer = (dr & 2) !== 0;
    for (let k = 0; k < n; k++) {
      if (++total > maxPas) return 'Replay trop long.';
      if (!pas({ input, replacer })) return total;
    }
  }
  return total;
}

// --- base64 (sans btoa/atob : identique partout) -----------------------------------------------------------

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function versBase64(o: Uint8Array): string {
  let s = '';
  for (let i = 0; i < o.length; i += 3) {
    const a = o[i], b = i + 1 < o.length ? o[i + 1] : 0, c = i + 2 < o.length ? o[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    s += ALPHABET[(n >> 18) & 63] + ALPHABET[(n >> 12) & 63];
    s += i + 1 < o.length ? ALPHABET[(n >> 6) & 63] : '=';
    s += i + 2 < o.length ? ALPHABET[n & 63] : '=';
  }
  return s;
}

/** null si la chaîne n'est pas du base64 valide. */
export function depuisBase64(s: string): Uint8Array | null {
  if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) return null;
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let j = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n = (ALPHABET.indexOf(s[i]) << 18) | (ALPHABET.indexOf(s[i + 1]) << 12)
      | ((s[i + 2] === '=' ? 0 : ALPHABET.indexOf(s[i + 2])) << 6) | (s[i + 3] === '=' ? 0 : ALPHABET.indexOf(s[i + 3]));
    if (j < out.length) out[j++] = (n >> 16) & 255;
    if (j < out.length) out[j++] = (n >> 8) & 255;
    if (j < out.length) out[j++] = n & 255;
  }
  return out;
}

// --- compression (deflate-raw, si le navigateur la propose) ------------------------------------------------

async function transformer(o: Uint8Array, flux: { readable: ReadableStream<Uint8Array>; writable: WritableStream<BufferSource> }, max: number): Promise<Uint8Array | null> {
  const ecrivain = flux.writable.getWriter();
  void ecrivain.write(new Uint8Array(o)).then(() => ecrivain.close()).catch(() => {});
  const morceaux: Uint8Array[] = [];
  let taille = 0;
  const lecteur = flux.readable.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    taille += value.length;
    if (taille > max) { void lecteur.cancel(); return null; }
    morceaux.push(value);
  }
  const out = new Uint8Array(taille);
  let k = 0;
  for (const m of morceaux) { out.set(m, k); k += m.length; }
  return out;
}

/** Replay compressé, ou null si le navigateur ne sait pas compresser (on l'envoie alors tel quel). */
export async function compresserReplay(o: Uint8Array): Promise<Uint8Array | null> {
  if (typeof globalThis.CompressionStream === 'undefined') return null;
  try {
    return await transformer(o, new CompressionStream('deflate-raw'), Infinity);
  } catch {
    return null;
  }
}

/** Décompresse (au plus `max` octets : protège le serveur d'une « bombe » de compression), null si invalide. */
export async function decompresserReplay(o: Uint8Array, max: number): Promise<Uint8Array | null> {
  if (typeof globalThis.DecompressionStream === 'undefined') return null;
  try {
    return await transformer(o, new DecompressionStream('deflate-raw'), max);
  } catch {
    return null;
  }
}
