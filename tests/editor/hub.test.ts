import { describe, it, expect } from 'vitest';
import { nomCopie } from '../../src/editor/hub';
import { LIMITES } from '../../src/core/level/types';

describe('nomCopie', () => {
  it('ajoute « (copie) »', () => {
    expect(nomCopie('Col du Loup')).toBe('Col du Loup (copie)');
  });
  it('reste dans la limite de longueur du nom', () => {
    const n = nomCopie('x'.repeat(LIMITES.nomMax));
    expect(n.length).toBeLessThanOrEqual(LIMITES.nomMax);
    expect(n.endsWith(' (copie)')).toBe(true);
  });
});
