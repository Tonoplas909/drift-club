import { describe, it, expect } from 'vitest';
import { traiterCourse, type DemandeCourse } from '../../src/serveur/course';
import { prepareLevel } from '../../src/game/prepare';
import { NIVEAUX_OFFICIELS } from '../../src/levels';
import { empreinteNiveau } from '../../src/core/level/fingerprint';
import { compresserReplay, versBase64 } from '../../src/core/replay/replay';
import { EMPREINTE_SIMULATION } from '../../src/online/empreinteSimulation';
import { empaqueter, fichierEmpreinte } from '../../tools/fonction';
import codeFonction from '../../supabase/functions/verifier-course/course.js?raw';
import fichierEmpreinteActuel from '../../src/online/empreinteSimulation.ts?raw';
import { hairpinLevel } from '../fixtures/levels';
import { conduire } from '../fixtures/pilote';

const officiel = NIVEAUX_OFFICIELS.find((n) => n.id === 'col-du-torii')!;
const prep = (cle: string, brut: unknown) => {
  const r = prepareLevel(cle, brut);
  if (!r.ok) throw new Error(r.erreurs.join());
  return r.prepared;
};

describe('traiterCourse (Edge Function verifier-course)', () => {
  const course = conduire(prep('off:col-du-torii', officiel.data), 'turbo', 'arcade');
  const r = course.result!;
  const demande = async (extra: Partial<DemandeCourse> = {}): Promise<DemandeCourse> => ({
    version: 'v1', niveau: 'off:col-du-torii', mode: 'arcade', voiture: 'turbo',
    score: r.score, temps: r.time, meilleurDrift: r.bestDrift,
    replay: versBase64((await compresserReplay(course.replay))!), compression: 'deflate-raw', ...extra,
  });

  it('niveau officiel, replay compressé : conforme', async () => {
    expect(await traiterCourse(await demande(), 'v1')).toEqual({
      ok: true, niveau: 'off:col-du-torii', mode: 'arcade', voiture: 'turbo',
      verdict: { statut: 'conforme', score: r.score, temps: r.time, meilleurDrift: r.bestDrift, scoreRejoue: r.score, tempsRejoue: r.time },
      empreinteReplay: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });
  it("empreinte du replay : la même course, compressée ou non, a la même empreinte (refus des doublons côté SQL)", async () => {
    const a = await traiterCourse(await demande(), 'v1');
    const b = await traiterCourse(await demande({ replay: versBase64(course.replay), compression: 'aucune' }), 'v1');
    expect(a.ok && b.ok && a.empreinteReplay).toBe(b.ok && b.empreinteReplay);
  });
  it('replay non compressé accepté ; score gonflé corrigé', async () => {
    const rep = await traiterCourse(await demande({ replay: versBase64(course.replay), compression: 'aucune', score: 1_500_000 }), 'v1');
    expect(rep.ok && rep.verdict).toMatchObject({ statut: 'corrige', score: r.score });
  });
  it('version différente du serveur : refus explicite (recharger la page)', async () => {
    const rep = await traiterCourse(await demande({ version: 'ancienne' }), 'v1');
    expect(rep).toMatchObject({ ok: false, code: 'version' });
  });
  it('demandes invalides', async () => {
    const cas: Partial<DemandeCourse>[] = [
      { niveau: 'off:inconnu' }, { niveau: 'test:x' }, { mode: 'turbo' }, { voiture: 'fusee' }, { score: Number.NaN },
      { replay: 'pas du base64 !' }, { compression: 'gzip' as never }, { replay: 'A'.repeat(700_000) },
    ];
    for (const c of cas) expect((await traiterCourse(await demande(c), 'v1')).ok, JSON.stringify(c).slice(0, 60)).toBe(false);
    expect(await traiterCourse(null, 'v1')).toMatchObject({ ok: false, code: 'demande' });
    expect(await traiterCourse([], 'v1')).toMatchObject({ ok: false, code: 'demande' });
  });

  it('niveau perso : contenu envoyé, contrôlé par son empreinte', async () => {
    const level = hairpinLevel();
    const p = prep('x', level);
    const cle = `perso:${await empreinteNiveau(p.level)}`;
    const c = conduire(p, 'equilibree', 'semi', 120);
    expect(c.result).not.toBeNull();
    const base = {
      version: 'v1', niveau: cle, mode: 'semi', voiture: 'equilibree', score: c.result!.score, temps: c.result!.time,
      meilleurDrift: c.result!.bestDrift, replay: versBase64(c.replay), compression: 'aucune' as const,
    };
    expect(await traiterCourse({ ...base, level }, 'v1')).toMatchObject({ ok: true, verdict: { statut: 'conforme' } });
    // nom changé : même empreinte (le nom n'y entre pas), la course reste valable
    expect(await traiterCourse({ ...base, level: { ...level, nom: 'Autre nom' } }, 'v1')).toMatchObject({ ok: true });
    // niveau modifié (une barrière retirée, une graine changée…) : il ne correspond plus à la clé
    expect(await traiterCourse({ ...base, level: { ...level, decor: { ...level.decor, graine: 99 } } }, 'v1'))
      .toMatchObject({ ok: false, code: 'refuse', message: 'Le niveau envoyé ne correspond pas à son empreinte.' });
    expect(await traiterCourse(base, 'v1')).toMatchObject({ ok: false, message: 'Contenu du niveau manquant.' });
    expect(await traiterCourse({ ...base, level: { format: 1 } }, 'v1')).toMatchObject({ ok: false, message: 'Niveau invalide.' });
  });
});

describe('Edge Function générée (supabase/functions/verifier-course/course.js)', () => {
  it('à jour avec la simulation et les niveaux (sinon : npx vite-node tools/gen-fonction.ts, puis redéployer)', async () => {
    const { code, empreinte } = await empaqueter();
    expect(codeFonction === code, 'course.js pas à jour : npx vite-node tools/gen-fonction.ts').toBe(true);
    expect(fichierEmpreinteActuel).toBe(fichierEmpreinte(empreinte));
    expect(EMPREINTE_SIMULATION).toBe(empreinte);
  }, 30000);

  it('le paquet tourne seul et rend le même verdict', async () => {
    const mod = await import('../../supabase/functions/verifier-course/course.js');
    expect(mod.EMPREINTE).toBe(EMPREINTE_SIMULATION);
    const level = hairpinLevel();
    const p = prep('x', level);
    const c = conduire(p, 'legere', 'exigeant', 120);
    const rep = await mod.traiterCourse({
      version: mod.EMPREINTE, niveau: `perso:${await empreinteNiveau(p.level)}`, mode: 'exigeant', voiture: 'legere', level,
      score: c.result!.score, temps: c.result!.time, meilleurDrift: c.result!.bestDrift, replay: versBase64(c.replay), compression: 'aucune',
    }, mod.EMPREINTE);
    expect(rep).toMatchObject({ ok: true, verdict: { statut: 'conforme', scoreRejoue: c.result!.score } });
  });
});
