import { describe, it, expect } from 'vitest';
import { SEUILS_MEDAILLES, medaille, prochaineMedaille } from '../../src/core/medailles';
import { NIVEAUX_OFFICIELS } from '../../src/levels';

describe('médailles', () => {
  it('chaque niveau officiel a des seuils croissants', () => {
    for (const n of NIVEAUX_OFFICIELS) {
      const s = SEUILS_MEDAILLES[n.id];
      expect(s, n.id).toBeDefined();
      expect(s[0]).toBeGreaterThan(0);
      expect(s[1]).toBeGreaterThan(s[0]);
      expect(s[2]).toBeGreaterThan(s[1]);
    }
    expect(Object.keys(SEUILS_MEDAILLES).sort()).toEqual(NIVEAUX_OFFICIELS.map((n) => n.id).sort());
  });
  it('médaille obtenue selon le score', () => {
    const s = [10, 20, 30] as const;
    expect(medaille(9, s)).toBeNull();
    expect(medaille(10, s)).toBe('bronze');
    expect(medaille(29, s)).toBe('argent');
    expect(medaille(30, s)).toBe('or');
  });
  it('prochaine médaille et points manquants', () => {
    const s = [10, 20, 30] as const;
    expect(prochaineMedaille(0, s)).toEqual({ medaille: 'bronze', manque: 10 });
    expect(prochaineMedaille(25, s)).toEqual({ medaille: 'or', manque: 5 });
    expect(prochaineMedaille(30, s)).toBeNull();
  });
});
