import { describe, it, expect } from 'vitest';
import { createScore, stepScore, facteursDrift, type ScoreFrame } from '../../src/core/scoring/score';
import { proximiteClipping, zonesPiste, PORTEE_CLIPPING } from '../../src/core/track/clipping';
import { validateLevel } from '../../src/core/level/validate';
import { normaliserNiveau, encoderNiveau, decoderNiveau } from '../../src/core/level/encode';
import { empreinteNiveau } from '../../src/core/level/fingerprint';
import { toggleClipping, clippingAt, insertPoint, deletePoint } from '../../src/core/editor/ops';
import { buildTrack } from '../../src/core/track/buildTrack';
import { NIVEAUX_OFFICIELS } from '../../src/levels';
import { straightLevel } from '../fixtures/levels';
import { DEG } from '../../src/core/math/vec';
import { SIM_DT } from '../../src/core/constants';

const drift = (clipping?: number): ScoreFrame => ({ betaRad: 35 * DEG, speed: 60 / 3.6, onRoad: true, progressRate: 10, crash: false, reset: false, clipping });

describe('zones de clipping', () => {
  it('proximité : 1 au ras du bord, décroît jusqu\'à la portée, 0 hors zone ou de l\'autre côté', () => {
    const zones = [{ i0: 10, i1: 20, cote: 1 as const }];
    const w = 5, demi = 0.9;
    expect(proximiteClipping(zones, 15, w - demi, w, demi)).toBeCloseTo(1);
    expect(proximiteClipping(zones, 15, w, w, demi)).toBe(1); // le flanc dépasse le bord
    expect(proximiteClipping(zones, 15, w - demi - PORTEE_CLIPPING / 2, w, demi)).toBeCloseTo(0.5);
    expect(proximiteClipping(zones, 15, 0, w, demi)).toBe(0);
    expect(proximiteClipping(zones, 15, -(w - demi), w, demi)).toBe(0);
    expect(proximiteClipping(zones, 25, w - demi, w, demi)).toBe(0);
  });
  it('le drift rapporte jusqu\'à 2 fois plus au ras du bord ; sans zone, exactement pareil qu\'avant', () => {
    const sans = createScore(), zero = createScore(), plein = createScore();
    for (let i = 0; i < 120; i++) {
      stepScore(sans, drift(), SIM_DT);
      stepScore(zero, drift(0), SIM_DT);
      stepScore(plein, drift(1), SIM_DT);
    }
    expect(zero.drift).toBe(sans.drift);
    expect(plein.drift).toBeCloseTo(2 * sans.drift, 6);
  });
  it('les facteurs affichés restent exacts, clipping compris', () => {
    const st = createScore();
    for (let i = 0; i < 240; i++) stepScore(st, drift(i < 120 ? 0.8 : 0), SIM_DT);
    const f = facteursDrift(st)!;
    expect(f.clipping).toBeGreaterThan(1.3);
    expect(f.clipping).toBeLessThan(1.5);
    expect(f.base * f.kmh * f.secondes * f.angle * f.clipping * f.combo).toBeCloseTo(st.drift * st.multiplier, 6);
  });
  it('format : validé, encodé dans les liens, compté dans l\'empreinte seulement s\'il y en a', async () => {
    const l = straightLevel(300);
    const avant = await empreinteNiveau(l);
    expect(await empreinteNiveau({ ...l, clipping: [] })).toBe(avant);
    const avec = { ...l, clipping: [{ de: 1, a: 3, cote: 'droite' as const }] };
    expect(validateLevel(avec).ok).toBe(true);
    expect(await empreinteNiveau(avec)).not.toBe(avant);
    expect(validateLevel({ ...l, clipping: [{ de: 2, a: 2, cote: 'droite' }] }).ok).toBe(false);
    expect(validateLevel({ ...l, clipping: [{ de: 0, a: 1, cote: 'ext' }] }).ok).toBe(false);
    const code = await encoderNiveau(avec);
    const r = await decoderNiveau(code);
    expect(r.ok && r.level.clipping).toEqual(normaliserNiveau(avec).clipping);
  });
  it('éditeur : poser, fusionner, retirer, suivre les points insérés ou supprimés', () => {
    const l = straightLevel(300);
    toggleClipping(l, 1, 'gauche');
    toggleClipping(l, 2, 'gauche');
    expect(l.clipping).toEqual([{ de: 1, a: 3, cote: 'gauche' }]);
    expect(clippingAt(l, 2)).toEqual({ gauche: true, droite: false });
    insertPoint(l, 1, 0, 70);
    expect(l.clipping).toEqual([{ de: 1, a: 4, cote: 'gauche' }]);
    deletePoint(l, 2);
    expect(l.clipping).toEqual([{ de: 1, a: 3, cote: 'gauche' }]);
    toggleClipping(l, 1, 'gauche'); toggleClipping(l, 2, 'gauche');
    expect(l.clipping).toBeUndefined();
  });
  it('chaque niveau officiel a des zones valides, sur la piste', () => {
    for (const n of NIVEAUX_OFFICIELS) {
      const v = validateLevel(n.data);
      expect(v.ok, n.id).toBe(true);
      if (!v.ok) continue;
      expect(v.level.clipping?.length ?? 0, n.id).toBeGreaterThan(0);
      const t = buildTrack(v.level);
      for (const z of zonesPiste(v.level, t)) expect(z.i1).toBeGreaterThan(z.i0);
    }
  });
});
