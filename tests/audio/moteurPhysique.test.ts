import { describe, it, expect } from 'vitest';
import { MoteurPhysiqueDSP } from '../../src/audio/moteurPhysiqueDsp';
import { CLARTE_MOTEUR, NOM_PROCESSEUR, PROFILS_MOTEUR, sourceWorkletMoteur } from '../../src/audio/moteurPhysique';
import { coupurePhysique } from '../../src/audio/voices';
import { CAR_IDS } from '../../src/core/physics/cars';

const SR = 44100;
function rendre(car: keyof typeof PROFILS_MOTEUR, rpm: number, gaz: number, secondes = 3): Float32Array {
  const d = new MoteurPhysiqueDSP(PROFILS_MOTEUR[car], SR);
  const out = new Float32Array(Math.round(SR * secondes));
  for (let i = 0; i < out.length; i += 128) d.rendre(out.subarray(i, i + 128), [rpm], [gaz]);
  return out;
}
const rms = (x: Float32Array, a = 0, b = x.length): number => { let s = 0; for (let i = a; i < b; i++) s += x[i] ** 2; return Math.sqrt(s / (b - a)); };

describe('moteur physique (modèle d\'Antonio-R1)', () => {
  it('un profil par voiture, silencieux sous le seuil de résonance (action ≤ 0,1)', () => {
    expect(Object.keys(PROFILS_MOTEUR).sort()).toEqual([...CAR_IDS].sort());
    expect(Object.keys(CLARTE_MOTEUR).sort()).toEqual([...CAR_IDS].sort());
    for (const p of Object.values(PROFILS_MOTEUR)) expect(p.action).toBeLessThanOrEqual(0.1);
  });

  it('stable et à niveau comparable pour toutes les voitures, du ralenti au rupteur', () => {
    for (const car of CAR_IDS) {
      for (const [rpm, gaz] of [[800, 0], [3500, 1], [7000, 1], [4500, 0]]) {
        const x = rendre(car, rpm, gaz, 4);
        // la dernière seconde n'est pas plus forte que la deuxième : rien ne diverge
        const debut = rms(x, SR, 2 * SR), fin = rms(x, 3 * SR, 4 * SR);
        expect(Number.isFinite(fin), `${car} ${rpm}`).toBe(true);
        expect(fin, `${car} ${rpm}`).toBeLessThan(debut * 1.5 + 0.05);
        expect(fin, `${car} ${rpm}`).toBeGreaterThan(0.1);
        expect(fin, `${car} ${rpm}`).toBeLessThan(1.2);
      }
    }
  });

  it('pas de composante continue', () => {
    const x = rendre('muscle', 3000, 1, 3);
    let m = 0; for (let i = SR; i < x.length; i++) m += x[i];
    expect(Math.abs(m / (x.length - SR))).toBeLessThan(0.02);
  });

  it('le son suit le régime : énergie à la fréquence d\'allumage (cylindres × régime / 120)', () => {
    // amplitude d'une fréquence (Goertzel) sur la dernière seconde
    const raie = (x: Float32Array, f: number): number => {
      const w = 2 * Math.PI * f / SR, c = 2 * Math.cos(w);
      let s1 = 0, s2 = 0;
      for (let i = x.length - SR; i < x.length; i++) { const s0 = x[i] + c * s1 - s2; s2 = s1; s1 = s0; }
      return Math.sqrt(s1 * s1 + s2 * s2 - c * s1 * s2);
    };
    // moteurs à allumages réguliers (le V8 de la Muscle est volontairement irrégulier : énergie étalée)
    for (const car of ['equilibree', 'turbo', 'kei', 'break'] as const) {
      expect(PROFILS_MOTEUR[car].irregularite ?? 0).toBe(0);
      const n = PROFILS_MOTEUR[car].cylindres, bas = 1800, haut = 5400;
      const fBas = n * bas / 120, fHaut = n * haut / 120;
      const xBas = rendre(car, bas, 1, 2), xHaut = rendre(car, haut, 1, 2);
      expect(raie(xBas, fBas), car).toBeGreaterThan(raie(xHaut, fBas));
      expect(raie(xHaut, fHaut), car).toBeGreaterThan(raie(xBas, fHaut));
    }
  });

  it('garde-fou : un profil instable est remis au silence au lieu de saturer', () => {
    const d = new MoteurPhysiqueDSP({ ...PROFILS_MOTEUR.muscle, action: 0.15 }, SR);
    const out = new Float32Array(SR * 4);
    for (let i = 0; i < out.length; i += 128) d.rendre(out.subarray(i, i + 128), [3500], [1]);
    let max = 0; for (const v of out) max = Math.max(max, Math.abs(v));
    expect(max).toBeLessThan(8);
  });

  it('module AudioWorklet : le code recopié enregistre un processeur qui remplit la sortie', () => {
    let classe: (new (o: { processorOptions: unknown }) => { process(e: unknown, s: Float32Array[][], p: Record<string, Float32Array>): boolean; port: { onmessage: ((e: { data: unknown }) => void) | null } }) | null = null;
    let nom = '';
    class AudioWorkletProcessor { port = { onmessage: null as ((e: { data: unknown }) => void) | null }; }
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', sourceWorkletMoteur())(
      AudioWorkletProcessor, (n: string, c: typeof classe) => { nom = n; classe = c; }, SR);
    expect(nom).toBe(NOM_PROCESSEUR);
    const p = new classe!({ processorOptions: PROFILS_MOTEUR.turbo });
    const sortie = [[new Float32Array(128)]];
    let max = 0;
    for (let k = 0; k < 400; k++) { expect(p.process([], sortie, { rpm: new Float32Array([4000]), gaz: new Float32Array([1]) })).toBe(true); for (const v of sortie[0][0]) max = Math.max(max, Math.abs(v)); }
    expect(max).toBeGreaterThan(0.05);
    p.port.onmessage?.({ data: 'stop' });
    expect(p.process([], sortie, { rpm: new Float32Array([4000]), gaz: new Float32Array([1]) })).toBe(false);
  });

  it('passe-bas de la chaîne : sourd en décélération, s\'ouvre avec le régime et la charge', () => {
    expect(coupurePhysique(1000, 0)).toBeLessThan(coupurePhysique(1000, 1));
    expect(coupurePhysique(2000, 1)).toBeLessThan(coupurePhysique(7000, 1));
    expect(coupurePhysique(5000, 1, CLARTE_MOTEUR.muscle)).toBeLessThan(coupurePhysique(5000, 1, CLARTE_MOTEUR.kei));
    expect(coupurePhysique(20000, 1, 2)).toBe(7000);
  });
});
