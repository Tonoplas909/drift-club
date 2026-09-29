import { describe, it, expect } from 'vitest';
import { levelSummary } from '../../src/ui/screens';
import { NIVEAUX_OFFICIELS } from '../../src/levels';

describe('levelSummary', () => {
  it('resume un niveau officiel', () => {
    const s = levelSummary(NIVEAUX_OFFICIELS[2].data);
    expect(s).toMatchObject({ nom: 'Col du Loup', ambiance: 'coucher' });
    expect(s!.longueur).toBeGreaterThan(900);
  });
  it('null pour un niveau invalide', () => {
    expect(levelSummary({ format: 1 })).toBeNull();
  });
});
