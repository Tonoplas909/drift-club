import { describe, it, expect } from 'vitest';
import { verifierCourse, annonceProche, TOLERANCE } from '../../../src/core/replay/verifier';
import { prepareLevel } from '../../../src/game/prepare';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { conduire } from '../../fixtures/pilote';

const niveau = (id: string) => {
  const r = prepareLevel(`off:${id}`, NIVEAUX_OFFICIELS.find((n) => n.id === id)!.data);
  if (!r.ok) throw new Error(r.erreurs.join());
  return r.prepared;
};

describe('verifierCourse : le serveur rejoue la course', () => {
  const n = niveau('col-du-torii');
  const { replay, result } = conduire(n, 'turbo', 'arcade');

  it('le pilote automatique termine avec des points de drift', () => {
    expect(result).not.toBeNull();
    expect(result!.driftPoints).toBeGreaterThan(500);
  });

  it('score honnête : rejoué à l\'identique, score envoyé gardé (conforme)', () => {
    const v = verifierCourse(n, 'turbo', 'arcade', replay, { score: result!.score, temps: result!.time, meilleurDrift: result!.bestDrift });
    expect(v).toEqual({ statut: 'conforme', score: result!.score, temps: result!.time, meilleurDrift: result!.bestDrift, scoreRejoue: result!.score, tempsRejoue: result!.time });
  });

  it('petit écart (différence de calcul entre navigateurs) : le score envoyé reste gardé', () => {
    const v = verifierCourse(n, 'turbo', 'arcade', replay, { score: result!.score + 50, temps: result!.time + 0.2, meilleurDrift: result!.bestDrift });
    expect(v.statut).toBe('conforme');
    expect(v.statut !== 'refuse' && v.score).toBe(result!.score + 50);
  });

  it('score gonflé : le serveur garde le score rejoué (corrige)', () => {
    const v = verifierCourse(n, 'turbo', 'arcade', replay, { score: 999_999, temps: result!.time, meilleurDrift: 5000 });
    expect(v).toMatchObject({ statut: 'corrige', score: result!.score, temps: result!.time, meilleurDrift: result!.bestDrift });
    const t = verifierCourse(n, 'turbo', 'arcade', replay, { score: result!.score, temps: 5, meilleurDrift: result!.bestDrift });
    expect(t.statut).toBe('corrige');
  });

  it('autre voiture ou autre mode annoncés : ce n\'est plus la même course, le score envoyé n\'est pas gardé', () => {
    const v = verifierCourse(n, 'kei', 'exigeant', replay, { score: result!.score, temps: result!.time, meilleurDrift: result!.bestDrift });
    expect(v.statut).not.toBe('conforme');
  });

  it("replay tronqué, vide ou inventé : la course n'atteint pas l'arrivée, rien n'est enregistré", () => {
    const annonce = { score: result!.score, temps: result!.time, meilleurDrift: result!.bestDrift };
    expect(verifierCourse(n, 'turbo', 'arcade', replay.slice(0, Math.floor(replay.length / 2)), annonce).statut).toBe('refuse');
    expect(verifierCourse(n, 'turbo', 'arcade', Uint8Array.from([1]), annonce)).toEqual({ statut: 'refuse', raison: "La course rejouée n'atteint pas l'arrivée." });
    expect(verifierCourse(n, 'turbo', 'arcade', Uint8Array.from([9]), annonce).statut).toBe('refuse');
    expect(verifierCourse(n, 'nope' as never, 'arcade', replay, annonce)).toEqual({ statut: 'refuse', raison: 'Voiture inconnue.' });
    expect(verifierCourse(n, 'turbo', 'toString' as never, replay, annonce)).toEqual({ statut: 'refuse', raison: 'Mode inconnu.' });
  });
});

describe('annonceProche', () => {
  const rejoue = { score: 50_000, temps: 80, meilleurDrift: 9000 };
  it('tolérance : 1 % du score (au moins 100 points) et une demi-seconde', () => {
    expect(TOLERANCE).toEqual({ scoreRelatif: 0.01, scoreAbsolu: 100, temps: 0.5 });
    expect(annonceProche({ ...rejoue, score: 50_500 }, rejoue)).toBe(true);
    expect(annonceProche({ ...rejoue, score: 50_501 }, rejoue)).toBe(false);
    expect(annonceProche({ score: 100, temps: 30, meilleurDrift: 0 }, { score: 0, temps: 30, meilleurDrift: 0 })).toBe(true);
    expect(annonceProche({ ...rejoue, temps: 80.6 }, rejoue)).toBe(false);
    expect(annonceProche({ ...rejoue, meilleurDrift: 60_000 }, rejoue)).toBe(false);
  });
});
