import { describe, it, expect } from 'vitest';
import { DefiService } from '../../src/online/defi';
import { faussClient } from './mock';

describe('DefiService', () => {
  it('défis passés : en voiture par défaut, à moto avec p_moto', async () => {
    const m = faussClient({ 'rpc.defis_passes': { data: [{ jour: '2026-10-12', pseudo: 'Kei', score: 1200, voiture: 'sportive', joueurs: 3 }], error: null } });
    const s = new DefiService(m.fournisseur);
    expect(await s.passes(7)).toMatchObject({ ok: true });
    expect(await s.passes(7, true)).toEqual({ ok: true, valeur: [{ jour: '2026-10-12', pseudo: 'Kei', score: 1200, voiture: 'sportive', joueurs: 3 }] });
    expect(m.appels.map((a) => a.args)).toEqual([['defis_passes', { p_jours: 7 }], ['defis_passes', { p_jours: 7, p_moto: true }]]);
  });
  it('défis à moto avant la migration 0016 : message d\'attente, sans erreur', async () => {
    const m = faussClient({ 'rpc.defis_passes': { data: null, error: { code: 'PGRST202', message: 'x' } } });
    expect(await new DefiService(m.fournisseur).passes(7, true)).toEqual({ ok: false, message: 'Historique des défis à moto bientôt disponible.' });
  });
  it('récompenses : podium à moto signalé (absent avant 0016 : voiture)', async () => {
    const m = faussClient({ 'rpc.reclamer_recompenses_defi': { data: [{ jour: '2026-10-12', rang: 1, cles: 5, moto: true }, { jour: '2026-10-11', rang: 2, cles: 3 }], error: null } });
    expect(await new DefiService(m.fournisseur).reclamer()).toEqual({ ok: true, valeur: [
      { jour: '2026-10-12', rang: 1, cles: 5, moto: true }, { jour: '2026-10-11', rang: 2, cles: 3, moto: false },
    ] });
  });
});
