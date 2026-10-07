import { describe, it, expect } from 'vitest';
import { defiDuJour, graineDuJour, jourEnClair, cleDefi, estJourValide } from '../../src/core/defi';
import { prepareLevel } from '../../src/game/prepare';
import { analyseLevel } from '../../src/core/editor/analyse';
import { jourParis, decalerJour } from '../../src/jour';
import { traiterCourse } from '../../src/serveur/course';
import { conduire } from '../fixtures/pilote';
import { compresserReplay, versBase64 } from '../../src/core/replay/replay';
import { cleEnLigne } from '../../src/online/classement';

describe('défi du jour', () => {
  it('même date ⇒ même défi ; dates voisines ⇒ défis différents', () => {
    const a = defiDuJour('2026-10-07'), b = defiDuJour('2026-10-07'), c = defiDuJour('2026-10-08');
    expect(a).toEqual(b);
    expect(JSON.stringify(c.level.route)).not.toBe(JSON.stringify(a.level.route));
    expect(graineDuJour('2026-10-07')).not.toBe(graineDuJour('2026-10-08'));
    expect(a.level.nom).toBe('Défi du 7 octobre');
  });
  it('un mois de défis : niveaux valides, sans problème de tracé, avec des zones de clipping', () => {
    for (let i = 0; i < 30; i++) {
      const jour = decalerJour('2026-10-07', i);
      const d = defiDuJour(jour);
      expect(prepareLevel(cleDefi(jour), d.level).ok, jour).toBe(true);
      const a = analyseLevel(d.level);
      expect(a.ok && a.problemes.length, jour).toBe(0);
      expect(d.level.clipping?.length ?? 0, jour).toBeGreaterThan(0);
    }
  });
  it('dates : jour de Paris, veille, validité, libellé', () => {
    expect(jourParis(new Date('2026-10-07T21:59:00Z'))).toBe('2026-10-07');
    expect(jourParis(new Date('2026-10-07T22:01:00Z'))).toBe('2026-10-08'); // minuit à Paris (UTC+2)
    expect(decalerJour('2026-03-01', -1)).toBe('2026-02-28');
    expect(estJourValide('2026-10-07')).toBe(true);
    expect(estJourValide('2026-13-07')).toBe(false);
    expect(jourEnClair('2026-11-01')).toBe('1er novembre');
    expect(cleEnLigne('jour:2026-10-07')).toBe(true);
    expect(cleEnLigne('jour:demain')).toBe(false);
  });
  it('le serveur vérifie la course du défi : voiture imposée, défi du jour ou de la veille seulement', async () => {
    const jour = '2026-10-07';
    const d = defiDuJour(jour);
    const r = prepareLevel(cleDefi(jour), d.level);
    if (!r.ok) throw new Error();
    const course = conduire(r.prepared, d.voiture, 'arcade');
    expect(course.result).not.toBeNull();
    const res = course.result!;
    const demande = async (o: Record<string, unknown> = {}) => ({
      version: 'v1', niveau: cleDefi(jour), mode: 'arcade', voiture: d.voiture, score: res.score, temps: res.time, meilleurDrift: res.bestDrift,
      replay: versBase64((await compresserReplay(course.replay))!), compression: 'deflate-raw', ...o,
    });
    const midi = new Date('2026-10-07T10:00:00Z');
    expect(await traiterCourse(await demande(), 'v1', midi)).toMatchObject({ ok: true, niveau: 'jour:2026-10-07', verdict: { statut: 'conforme' } });
    // le lendemain matin : encore accepté (course commencée avant minuit)
    expect((await traiterCourse(await demande(), 'v1', new Date('2026-10-08T06:00:00Z'))).ok).toBe(true);
    // deux jours plus tard, ou avant le jour : refusé
    expect(await traiterCourse(await demande(), 'v1', new Date('2026-10-09T10:00:00Z'))).toMatchObject({ ok: false, code: 'refuse' });
    expect(await traiterCourse(await demande(), 'v1', new Date('2026-10-06T10:00:00Z'))).toMatchObject({ ok: false, code: 'refuse' });
    // autre voiture que celle imposée
    const autre = d.voiture === 'kei' ? 'turbo' : 'kei';
    expect(await traiterCourse(await demande({ voiture: autre }), 'v1', midi)).toMatchObject({ ok: false, code: 'refuse' });
  }, 60_000);
});
