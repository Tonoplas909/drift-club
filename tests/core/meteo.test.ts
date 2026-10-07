import { describe, it, expect } from 'vitest';
import { validateLevel } from '../../src/core/level/validate';
import { encoderNiveau, decoderNiveau } from '../../src/core/level/encode';
import { empreinteNiveau } from '../../src/core/level/fingerprint';
import { adherenceDe, ADHERENCE_PLUIE } from '../../src/core/physics/meteo';
import { prepareLevel } from '../../src/game/prepare';
import { RaceSim } from '../../src/core/race/race';
import { CARS } from '../../src/core/physics/cars';
import { MODES } from '../../src/core/physics/assists';
import { curveLevel } from '../fixtures/levels';

describe('nuit et pluie', () => {
  it('format : nuit et pluie validées, transmises par les liens, comptées dans l\'empreinte', async () => {
    const l = curveLevel();
    expect(validateLevel({ ...l, ambiance: 'nuit' }).ok).toBe(true);
    expect(validateLevel({ ...l, ambiance: 'aube' }).ok).toBe(false);
    expect(validateLevel({ ...l, meteo: 'neige' }).ok).toBe(false);
    const v = validateLevel({ ...l, ambiance: 'nuit', meteo: 'pluie' });
    expect(v.ok && v.level.meteo).toBe('pluie');
    expect(await empreinteNiveau({ ...l, meteo: 'pluie' })).not.toBe(await empreinteNiveau(l));
    const r = await decoderNiveau(await encoderNiveau({ ...l, ambiance: 'nuit', meteo: 'pluie' }));
    expect(r.ok && [r.level.ambiance, r.level.meteo]).toEqual(['nuit', 'pluie']);
    const sec = await decoderNiveau(await encoderNiveau(l));
    expect(sec.ok && sec.level.meteo).toBeUndefined();
  });
  it('sous la pluie, la voiture accroche moins : moins d\'accélération latérale au même coup de volant', () => {
    expect(adherenceDe({})).toBe(1);
    expect(adherenceDe({ meteo: 'pluie' })).toBe(ADHERENCE_PLUIE);
    const derive = (meteo?: 'pluie'): number => {
      const r = prepareLevel('x', { ...curveLevel(), ...(meteo ? { meteo } : {}) });
      if (!r.ok) throw new Error();
      const n = r.prepared;
      const sim = new RaceSim({ level: n.level, track: n.track, terrain: n.terrain, env: n.env, car: CARS.equilibree, assists: MODES.exigeant, countdown: 0 });
      let max = 0;
      for (let k = 0; k < 360; k++) {
        sim.step({ gaz: 0.6, frein: 0, direction: k > 240 ? 1 : 0, freinAMain: false });
        if (k > 240) max = Math.max(max, Math.abs(sim.car.yawRate * sim.car.speed));
      }
      return max;
    };
    expect(derive('pluie')).toBeLessThan(derive() * 0.95);
  });
});
