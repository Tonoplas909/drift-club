import { describe, it, expect } from 'vitest';
import { textesCarte, nomCarte, type InfosCarte } from '../../src/ui/carteScore';
import { formatScore } from '../../src/ui/format';

const infos: InfosCarte = {
  niveau: 'Niveau 3 · Col du Loup', score: 215000, meilleurDrift: 22000, temps: 95, voiture: 'L\'Équilibrée', livree: 'Unie',
  mode: 'Semi-arcade', medaille: 'or', record: true, lien: 'https://tonoplas909.github.io/drift-club/',
};

describe('carte de score', () => {
  it('textes : score, médaille (prioritaire sur le record), voiture sans « Unie », lien court', () => {
    const t = textesCarte(infos);
    expect(t.titre).toBe('Niveau 3 · Col du Loup');
    expect(t.score).toBe(formatScore(215000));
    expect(t.badge).toBe('Médaille d\'or');
    expect(t.lignes).toContainEqual(['Voiture', 'L\'Équilibrée']);
    expect(t.lignes).toContainEqual(['Temps', '1:35.00']);
    expect(t.pied).toBe('tonoplas909.github.io/drift-club');
    expect(textesCarte({ ...infos, medaille: null }).badge).toBe('Nouveau record');
    expect(textesCarte({ ...infos, medaille: null, record: false }).badge).toBeNull();
    expect(textesCarte({ ...infos, livree: 'Flammes' }).lignes).toContainEqual(['Voiture', 'L\'Équilibrée · Flammes']);
  });
  it('nom du fichier sans accents ni espaces', () => {
    expect(nomCarte('Niveau 3 · Col du Loup')).toBe('drift-club-niveau-3-col-du-loup.png');
    expect(nomCarte('···')).toBe('drift-club-course.png');
  });
});
