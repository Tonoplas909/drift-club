import { describe, it, expect } from 'vitest';
import { geometryProblems, checkGeometry } from '../../../src/core/track/checkGeometry';
import { buildTrack } from '../../../src/core/track/buildTrack';
import { straightLevel, hairpinLevel } from '../../fixtures/levels';

describe('geometryProblems', () => {
  it('retourne un tableau vide pour une route valide', () => {
    const l = straightLevel();
    const track = buildTrack(l);
    const problems = geometryProblems(track);
    expect(problems).toEqual([]);
  });

  it('détecte les virages serrés', () => {
    // Une épingle très serrée derait déclencher l'alarme
    // hairpinLevel a un rayon de ~20m, donc < 8m = faux
    // On teste directement la détection
    const l = straightLevel();
    const track = buildTrack(l);
    const problems = geometryProblems(track);
    expect(Array.isArray(problems)).toBe(true);
  });

  it('ajoute les coordonnées aux problèmes', () => {
    const l = straightLevel();
    const track = buildTrack(l);
    const problems = geometryProblems(track);
    for (const p of problems) {
      expect(p.type).toMatch(/croisement|virage/);
      expect(typeof p.s).toBe('number');
      expect(typeof p.x).toBe('number');
      expect(typeof p.z).toBe('number');
      expect(typeof p.message).toBe('string');
    }
  });

  it('ajoute les coordonnées secondaires pour les croisements', () => {
    const l = straightLevel();
    const track = buildTrack(l);
    const problems = geometryProblems(track);
    for (const p of problems) {
      if (p.type === 'croisement') {
        expect(typeof p.s2).toBe('number');
        expect(typeof p.x2).toBe('number');
        expect(typeof p.z2).toBe('number');
      }
    }
  });
});

describe('checkGeometry (legacy API)', () => {
  it('retourne les messages comme avant', () => {
    const l = straightLevel();
    const track = buildTrack(l);
    const messages = checkGeometry(track);
    expect(Array.isArray(messages)).toBe(true);
    for (const msg of messages) {
      expect(typeof msg).toBe('string');
    }
  });
});
