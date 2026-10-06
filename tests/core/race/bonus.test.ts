import { describe, it, expect } from 'vitest';
import { prepareLevel } from '../../../src/game/prepare';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { conduire } from '../../fixtures/pilote';

describe('bonus de temps sur un niveau officiel', () => {
  it('une course complète avec des drifts rapporte un bonus de temps (il valait toujours 0)', () => {
    const officiel = NIVEAUX_OFFICIELS.find((n) => n.id === 'vallee-des-cretes')!;
    const r = prepareLevel('off:vallee-des-cretes', officiel.data);
    if (!r.ok) throw new Error(r.erreurs.join());
    const { result } = conduire(r.prepared, 'equilibree', 'arcade');
    expect(result).not.toBeNull();
    expect(result!.driftPoints).toBeGreaterThan(0);
    expect(result!.bonus).toBeGreaterThan(0);
    expect(result!.time).toBeLessThan(1.5 * result!.targetTime);
  });
});
