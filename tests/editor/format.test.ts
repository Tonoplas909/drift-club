import { describe, it, expect } from 'vitest';
import { resumeValidation, longueurRoute, jsonLisible, nomFichier, dateCourte, formatTempsCible } from '../../src/editor/format';
import { analyseLevel } from '../../src/core/editor/analyse';
import { newLevel, addPoint } from '../../src/core/editor/ops';
import { validateLevel } from '../../src/core/level/validate';

describe('barre de validation', () => {
  it('niveau valide : résumé complet', () => {
    const l = newLevel();
    const r = resumeValidation(l, analyseLevel(l));
    expect(r.ok).toBe(true);
    expect(r.texte).toMatch(/^✔ Niveau valide · \d+ m · 7 points · 0 objet · temps cible \d+/);
    expect(r.compteurs).toMatchObject({ points: '7/150', objets: '0/300' });
    expect(r.messages).toEqual([]);
  });
  it('erreurs structurelles : messages français et compteur', () => {
    const l = newLevel();
    addPoint(l, l.route[6].x + 1, l.route[6].z); // à 1 m du précédent
    const a = analyseLevel(l);
    const r = resumeValidation(l, a);
    expect(r.ok).toBe(false);
    expect(r.texte).toContain('distance au point précédent');
    expect(r.messages.length).toBeGreaterThan(0);
  });
  it('problèmes de géométrie : croisement listé', () => {
    const l = newLevel();
    l.route.push({ x: 40, z: 250, y: 0, l: 10 }, { x: 40, z: 100, y: 0, l: 10 });
    const r = resumeValidation(l, analyseLevel(l));
    expect(r.ok).toBe(false);
    expect(r.messages.join(' ')).toMatch(/croise|serré/);
  });
  it('pluriel des objets et des points', () => {
    const l = newLevel();
    l.objets.push({ type: 'arbre', x: 300, z: 0, rot: 0 });
    expect(resumeValidation(l, analyseLevel(l)).texte).toContain('1 objet ·');
    l.objets.push({ type: 'arbre', x: 310, z: 0, rot: 0 });
    expect(resumeValidation(l, analyseLevel(l)).texte).toContain('2 objets');
  });
  it('longueur de la ligne brisée en 3D', () => {
    const l = newLevel();
    let s = 0;
    for (let i = 1; i < l.route.length; i++) s += Math.hypot(l.route[i].x - l.route[i - 1].x, l.route[i].y - l.route[i - 1].y, l.route[i].z - l.route[i - 1].z);
    expect(longueurRoute(l)).toBeCloseTo(s);
  });
  it('temps cible', () => {
    expect(formatTempsCible(58.4)).toBe('58 s');
    expect(formatTempsCible(125)).toBe('2 min 05 s');
  });
});

describe('export', () => {
  it('JSON lisible indenté sur 2 espaces, relisible', () => {
    const l = newLevel();
    const j = jsonLisible(l);
    expect(j).toContain('\n  "format": 1,');
    expect(j.endsWith('}\n')).toBe(true);
    expect(validateLevel(JSON.parse(j)).ok).toBe(true);
  });
  it('nom de fichier', () => {
    expect(nomFichier('Col du Loup (copie)')).toBe('col-du-loup-copie.json');
    expect(nomFichier('Été à l\'épingle')).toBe('ete-a-l-epingle.json');
    expect(nomFichier('***')).toBe('niveau.json');
  });
  it('date courte', () => {
    expect(dateCourte('2026-09-29T12:00:00.000Z')).toMatch(/^\d{2}\/09\/2026$/);
    expect(dateCourte('n\'importe quoi')).toBe('');
  });
});
