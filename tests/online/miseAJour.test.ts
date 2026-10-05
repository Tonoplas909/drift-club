import { describe, it, expect } from 'vitest';
import { MiseAJour, DELAI_NOUVEL_ESSAI, type OptionsMiseAJour } from '../../src/online/miseAJour';

function banc(publie: string | null | (() => Promise<string | null>), extra: Partial<OptionsMiseAJour> = {}) {
  let memo: string | null = null, t = 1_000_000, recharges = 0, libre = true;
  const m = new MiseAJour({
    actuel: 'abc',
    lire: typeof publie === 'function' ? publie : async () => publie,
    peutRecharger: () => libre,
    recharger: () => { recharges++; },
    memoire: { lire: () => memo, ecrire: (v) => { memo = v; } },
    maintenant: () => t,
    ...extra,
  });
  return {
    m, recharges: () => recharges,
    occupe: (v: boolean) => { libre = !v; },
    avancer: (ms: number) => { t += ms; },
    nouvellePage: () => new MiseAJour({ actuel: 'abc', lire: async () => 'def', peutRecharger: () => libre, recharger: () => { recharges++; }, memoire: { lire: () => memo, ecrire: (v) => { memo = v; } }, maintenant: () => t }),
  };
}

describe('MiseAJour', () => {
  it('même version publiée, ou version illisible : rien à faire', async () => {
    for (const p of ['abc', null, () => Promise.reject(new Error('hors ligne'))]) {
      const b = banc(p as never);
      expect(await b.m.verifier()).toBe(false);
      expect(b.m.appliquer()).toBe(false);
      expect(b.recharges()).toBe(0);
    }
  });
  it('nouvelle version : recharge seulement quand le joueur est dans un menu', async () => {
    const b = banc('def');
    b.occupe(true);
    expect(await b.m.verifier()).toBe(true);
    expect(b.m.disponible).toBe('def');
    expect(b.m.appliquer()).toBe(false);
    expect(b.recharges()).toBe(0);
    b.occupe(false);
    expect(b.m.appliquer()).toBe(true);
    expect(b.recharges()).toBe(1);
  });
  it('pas de boucle : si la page rechargée est encore l\'ancienne (site pas encore propagé), on attend avant de réessayer', async () => {
    const b = banc('def');
    await b.m.verifier();
    expect(b.m.appliquer()).toBe(true);
    // la page rechargée a toujours l'ancienne version
    const p2 = b.nouvellePage();
    await p2.verifier();
    expect(p2.appliquer()).toBe(false);
    b.avancer(DELAI_NOUVEL_ESSAI + 1);
    expect(p2.appliquer()).toBe(true);
    expect(b.recharges()).toBe(2);
  });
});
