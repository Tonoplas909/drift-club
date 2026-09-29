import { describe, it, expect } from 'vitest';
import { prepareLevel } from '../../src/game/prepare';
import { NIVEAUX_OFFICIELS, cleNiveauOfficiel } from '../../src/levels';

describe('prepareLevel', () => {
  it('prepare un niveau officiel', () => {
    const n = NIVEAUX_OFFICIELS[0];
    const r = prepareLevel(cleNiveauOfficiel(n.id), n.data);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.prepared.key).toBe('off:premiers-virages');
      expect(r.prepared.env.items.length).toBeGreaterThan(0);
    }
  });
  it('renvoie les erreurs d\'un niveau invalide', () => {
    const r = prepareLevel('x', { format: 1, nom: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreurs.length).toBeGreaterThan(0);
  });
});
