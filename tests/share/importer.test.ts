import { describe, it, expect } from 'vitest';
import { lireSaisie, lireJson, lireFichier, TAILLE_MAX_FICHIER } from '../../src/share/importer';
import { encoderNiveau, normaliserNiveau } from '../../src/core/level/encode';
import { jsonLisible } from '../../src/editor/format';
import { curveLevel } from '../../tests/fixtures/levels';

const ID = '3f2b8c1e-9d4a-4b6f-8e21-0a7c5d9e1f34';
const fichier = (t: string, size = t.length) => ({ size, text: async () => t });

describe('lireSaisie', () => {
  it('code seul, lien complet, avec espaces', async () => {
    const l = curveLevel();
    const code = await encoderNiveau(l);
    for (const s of [code, `  ${code} \n`, `https://tonoplas909.github.io/drift-club/#n=${code}`]) {
      const r = await lireSaisie(s);
      expect(r).toEqual({ type: 'niveau', level: normaliserNiveau(l) });
    }
  });
  it('lien vers un niveau en ligne : renvoie l\'id, sans réseau', async () => {
    expect(await lireSaisie(`https://x.github.io/drift-club/#en-ligne=${ID}`)).toEqual({ type: 'en-ligne', id: ID });
  });
  it('JSON collé', async () => {
    const l = curveLevel();
    expect(await lireSaisie(jsonLisible(l))).toEqual({ type: 'niveau', level: l });
  });
  it('déchets et codes abîmés : erreurs en français', async () => {
    for (const s of ['', 'bonjour', 'https://exemple.fr', '1.abcdef', '#n=1.AAAA', '{"format":1}', '{pas du json']) {
      const r = await lireSaisie(s);
      expect(r.type, s).toBe('erreur');
      if (r.type === 'erreur') expect(r.erreurs.length).toBeGreaterThan(0);
    }
  });
});

describe('lireJson / lireFichier', () => {
  it('lit un .json exporté', async () => {
    const l = curveLevel();
    expect(await lireFichier(fichier(jsonLisible(l)))).toEqual({ type: 'niveau', level: l });
    expect(await lireFichier(fichier('﻿' + jsonLisible(l)))).toEqual({ type: 'niveau', level: l });
  });
  it('un fichier texte contenant un lien fonctionne aussi', async () => {
    const code = await encoderNiveau(curveLevel());
    expect((await lireFichier(fichier(`https://x/#n=${code}\n`))).type).toBe('niveau');
  });
  it('refuse : trop gros, JSON invalide, niveau invalide', async () => {
    expect(await lireFichier(fichier('{}', TAILLE_MAX_FICHIER + 1))).toEqual({ type: 'erreur', erreurs: ['Ce fichier est trop gros pour être un niveau.'] });
    expect(lireJson('{"a":')).toEqual({ type: 'erreur', erreurs: ["Ce fichier n'est pas un JSON valide."] });
    const r = lireJson(JSON.stringify({ ...curveLevel(), route: [] }));
    expect(r.type).toBe('erreur');
    if (r.type === 'erreur') expect(r.erreurs.join(' ')).toMatch(/route/);
    expect((await lireFichier({ size: 1, text: async () => { throw new Error('x'); } })).type).toBe('erreur');
  });
});
