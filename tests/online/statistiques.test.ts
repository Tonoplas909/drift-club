import { describe, it, expect } from 'vitest';
import { StatistiquesEnLigne } from '../../src/online/statistiques';
import { statistiquesVides } from '../../src/game/statistiques';
import { faussClient } from './mock';

describe('StatistiquesEnLigne', () => {
  it('lit le total du compte (null s\'il n\'y en a pas) et envoie les ajouts', async () => {
    const m = faussClient({
      'rpc.mes_statistiques': { data: null, error: null },
      'rpc.ajouter_statistiques': { data: { distanceCourse: 120, courses: 2, parVoiture: { kei: 120 }, depuis: '2026-10-07' }, error: null },
    });
    const s = new StatistiquesEnLigne(m.fournisseur);
    expect(await s.charger()).toEqual({ ok: true, valeur: null });
    const ajout = { ...statistiquesVides(), distanceCourse: 120, courses: 2 };
    const r = await s.ajouter(ajout);
    expect(r.ok && r.valeur).toMatchObject({ distanceCourse: 120, courses: 2, parVoiture: { kei: 120 } });
    expect(m.appels.at(-1)?.args).toEqual(['ajouter_statistiques', { p_ajout: ajout }]);
  });
  it('migration 0013 absente : raison « absent »', async () => {
    const m = faussClient({ 'rpc.mes_statistiques': { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } } });
    const r = await new StatistiquesEnLigne(m.fournisseur).charger();
    expect(r).toMatchObject({ ok: false, raison: 'absent' });
  });
});
