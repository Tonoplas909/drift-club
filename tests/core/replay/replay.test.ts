import { describe, it, expect } from 'vitest';
import {
  Enregistreur, lireReplay, quantifier, versBase64, depuisBase64, compresserReplay, decompresserReplay, VERSION_REPLAY, type PasReplay,
} from '../../../src/core/replay/replay';
import { mulberry32 } from '../../../src/core/math/rng';

const lire = (o: Uint8Array, max = 1e7): PasReplay[] | string => {
  const pas: PasReplay[] = [];
  const r = lireReplay(o, max, (p) => { pas.push(p); return true; });
  return typeof r === 'string' ? r : pas;
};

describe('quantifier', () => {
  it('ramène les commandes sur les crans enregistrables, de façon stable', () => {
    const q = quantifier({ gaz: 0.5, frein: 2, direction: -0.333, freinAMain: true });
    expect(q).toEqual({ gaz: 128 / 255, frein: 1, direction: -42 / 127, freinAMain: true });
    expect(quantifier(q)).toEqual(q);
    expect(quantifier({ gaz: NaN, frein: -1, direction: 5, freinAMain: false })).toEqual({ gaz: 0, frein: 0, direction: 1, freinAMain: false });
    expect(Object.is(quantifier({ gaz: 0, frein: 0, direction: -0.001, freinAMain: false }).direction, 0)).toBe(true);
  });
});

describe('Enregistreur / lireReplay', () => {
  it('relit exactement les pas enregistrés (plages identiques regroupées)', () => {
    const r = mulberry32(3);
    const rec = new Enregistreur();
    const attendu: PasReplay[] = [];
    for (let i = 0; i < 5000; i++) {
      // longues plages comme au clavier, puis valeurs analogiques comme au tactile
      const input = quantifier(i < 3000
        ? { gaz: i % 700 < 500 ? 1 : 0, frein: 0, direction: Math.floor(i / 250) % 3 - 1, freinAMain: i % 900 > 850 }
        : { gaz: 1, frein: 0, direction: r() * 2 - 1, freinAMain: false });
      const replacer = i === 1234;
      rec.ajouter(input, replacer);
      attendu.push({ input, replacer });
    }
    const o = rec.octetsReplay();
    expect(o[0]).toBe(VERSION_REPLAY);
    expect(rec.pas).toBe(5000);
    expect(lire(o)).toEqual(attendu);
    expect(o.length).toBeLessThan(2000 * 5 + 200);
  });
  it('plages de plus de 127 pas (longueur sur plusieurs octets)', () => {
    const rec = new Enregistreur();
    for (let i = 0; i < 100_000; i++) rec.ajouter({ gaz: 1, frein: 0, direction: 0, freinAMain: false }, false);
    const o = rec.octetsReplay();
    expect(o.length).toBe(1 + 3 + 4);
    expect((lire(o) as PasReplay[]).length).toBe(100_000);
  });
  it('arrêt demandé par le lecteur, limites et replays mal formés', () => {
    const rec = new Enregistreur();
    for (let i = 0; i < 50; i++) rec.ajouter({ gaz: i % 2, frein: 0, direction: 0, freinAMain: false }, false);
    const o = rec.octetsReplay();
    let n = 0;
    expect(lireReplay(o, 1000, () => ++n < 10)).toBe(10);
    expect(lireReplay(o, 49, () => true)).toBe('Replay trop long.');
    expect(lireReplay(Uint8Array.from([2, 1, 0, 0, 127, 0]), 10, () => true)).toBe('Version de replay inconnue.');
    expect(lireReplay(Uint8Array.from([1, 1, 0, 0]), 10, () => true)).toBe('Replay mal formé.');
    expect(lireReplay(Uint8Array.from([1, 1, 0, 0, 255, 0]), 10, () => true)).toBe('Replay mal formé.');
    expect(lireReplay(Uint8Array.from([1, 0, 0, 0, 127, 0]), 10, () => true)).toBe('Replay mal formé.');
    expect(lireReplay(Uint8Array.from([1, 0x80, 0x80, 0x80, 0x80, 0x80, 1, 0, 0, 127, 0]), 10, () => true)).toBe('Replay mal formé.');
    expect(lireReplay(new Uint8Array(0), 10, () => true)).toBe('Version de replay inconnue.');
  });
});

describe('base64 et compression', () => {
  it('base64 aller-retour, toutes longueurs ; refuse les chaînes invalides', () => {
    for (let n = 0; n < 20; n++) {
      const o = Uint8Array.from({ length: n }, (_, i) => (i * 97 + n) & 255);
      const s = versBase64(o);
      expect(s).toBe(btoa(String.fromCharCode(...o)));
      expect(depuisBase64(s)).toEqual(o);
    }
    for (const s of ['abc', 'ab$=', '====', 'a===']) expect(depuisBase64(s)).toBeNull();
  });
  it('deflate-raw aller-retour, et taille maximale à la décompression', async () => {
    const o = Uint8Array.from({ length: 20000 }, (_, i) => (i >> 6) & 255);
    const c = await compresserReplay(o);
    expect(c).not.toBeNull();
    expect(c!.length).toBeLessThan(o.length / 4);
    expect(await decompresserReplay(c!, 1e6)).toEqual(o);
    expect(await decompresserReplay(c!, 1000)).toBeNull();
    expect(await decompresserReplay(Uint8Array.from([255, 255, 255]), 1000)).toBeNull();
  });
});
