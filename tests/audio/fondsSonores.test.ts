import { describe, it, expect } from 'vitest';
import { ENVIRONNEMENTS } from '../../src/core/level/types';
import { FONDS_SONORES, delaiEvenement, hasardGraine, ondulationGain } from '../../src/audio/fondsSonores';
import { AudioEngine } from '../../src/audio/audio';

describe('fonds sonores des décors', () => {
  it('chaque décor a un fond sonore discret (sous le moteur)', () => {
    for (const d of ENVIRONNEMENTS) {
      const r = FONDS_SONORES[d];
      expect(r.nappes.length + (r.bourdons?.length ?? 0)).toBeGreaterThan(0);
      const total = [...r.nappes, ...(r.bourdons ?? [])].reduce((a, n) => a + n.gain, 0);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(0.2);
      for (const e of r.evenements ?? []) {
        expect(e.min).toBeGreaterThan(0);
        expect(e.max).toBeGreaterThanOrEqual(e.min);
        expect(e.gain).toBeLessThan(0.05);
      }
    }
  });
  it('ondulation : le volume reste entre gain × (1 − profondeur) et gain', () => {
    const { base, amplitude } = ondulationGain(0.1, 0.6);
    expect(base + amplitude).toBeCloseTo(0.1);
    expect(base - amplitude).toBeCloseTo(0.04);
  });
  it('hasard à graine reproductible, délais dans les bornes', () => {
    const a = hasardGraine(7), b = hasardGraine(7);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
    const e = { type: 'oiseau' as const, min: 2, max: 5, gain: 0.02 };
    const h = hasardGraine(3);
    for (let i = 0; i < 50; i++) { const d = delaiEvenement(e, h); expect(d).toBeGreaterThanOrEqual(2); expect(d).toBeLessThanOrEqual(5); }
  });
  it('sans AudioContext : décor et réglage ne lèvent pas d\'erreur', () => {
    const a = new AudioEngine();
    expect(() => {
      a.setDecor('pirate'); a.startEngine('turbo'); a.setDecor('japon'); a.setFondSonore(false); a.setFondSonore(true); a.stopEngine(); a.setDecor(null);
    }).not.toThrow();
  });
});
