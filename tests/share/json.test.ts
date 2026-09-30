import { describe, it, expect } from 'vitest';
import { jsonLisible, nomFichier } from '../../src/editor/format';
import { loadLevel } from '../../src/core/loadLevel';
import { analyseLevel } from '../../src/core/editor/analyse';
import { copyLevel } from '../../src/core/editor/ops';
import { empreinteNiveau } from '../../src/core/level/fingerprint';
import { nomCopie } from '../../src/editor/hub';
import { NIVEAUX_OFFICIELS } from '../../src/levels';
import type { Level } from '../../src/core/level/types';

const charge = (raw: unknown): Level => {
  const r = loadLevel(raw);
  if (!r.ok) throw new Error(r.erreurs.join());
  return r.level;
};

describe('export / import .json', () => {
  it('le JSON exporté a le format lisible du §5.1 (2 espaces, retour final)', () => {
    const l = charge(NIVEAUX_OFFICIELS[0].data);
    const s = jsonLisible(l);
    expect(s.startsWith('{\n  "format": 1,\n  "nom": ')).toBe(true);
    expect(s.endsWith('}\n')).toBe(true);
  });

  for (const off of NIVEAUX_OFFICIELS) {
    it(`« ${off.id} » : export puis import redonnent exactement le même niveau`, async () => {
      const l = charge(off.data);
      const ré = charge(JSON.parse(jsonLisible(l)));
      expect(ré).toEqual(l);
      expect(await empreinteNiveau(ré)).toBe(await empreinteNiveau(l));
    });

    it(`« ${off.id} » : une copie s'exporte (niveau valide) et se réimporte à l'identique`, () => {
      const l = charge(off.data);
      const copie = copyLevel(l, nomCopie(l.nom));
      expect(analyseLevel(copie).ok).toBe(true);
      expect(charge(JSON.parse(jsonLisible(copie)))).toEqual(copie);
    });
  }

  it('nom de fichier depuis le nom du niveau', () => {
    expect(nomFichier('Col du Loup (copie)')).toBe('col-du-loup-copie.json');
    expect(nomFichier('Vallée des Crêtes')).toBe('vallee-des-cretes.json');
    expect(nomFichier('???')).toBe('niveau.json');
  });
});
