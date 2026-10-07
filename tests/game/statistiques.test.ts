import { describe, it, expect } from 'vitest';
import { CompteurPilote, estVide, formatDuree, fusionnerStatistiques, lireStatistiques, statistiquesVides, voiturePreferee } from '../../src/game/statistiques';

describe('statistiques du pilote', () => {
  it('compte la distance (course ou Zen, par voiture), la glisse et le plus long drift', () => {
    const c = new CompteurPilote(statistiquesVides(), () => '2026-10-07');
    for (let i = 0; i < 120; i++) c.pas('legere', 20, 0.5, false, 1 / 120); // 1 s à 20 m/s, en glisse
    for (let i = 0; i < 60; i++) c.pas('legere', 20, 0, false, 1 / 120);
    for (let i = 0; i < 240; i++) c.pas('turbo', 10, 0.5, true, 1 / 120);
    const s = c.stats;
    expect(s.distanceCourse).toBeCloseTo(30);
    expect(s.distanceZen).toBeCloseTo(20);
    expect(s.tempsGlisse).toBeCloseTo(3);
    expect(s.plusLongDrift).toBeCloseTo(2);
    expect(voiturePreferee(s)).toBe('legere');
    expect(s.depuis).toBe('2026-10-07');
  });
  it('lente ou droite : pas de glisse ; replacement : le drift en cours s\'arrête', () => {
    const c = new CompteurPilote(statistiquesVides(), () => '2026-10-07');
    c.pas('legere', 5, 0.8, false, 1);
    expect(c.stats.tempsGlisse).toBe(0);
    c.pas('legere', 20, 0.5, false, 1);
    c.couper();
    c.pas('legere', 20, 0.5, false, 1);
    expect(c.stats.plusLongDrift).toBe(1);
  });
  it('drifts, courses ; relecture prudente', () => {
    const c = new CompteurPilote(statistiquesVides(), () => '2026-10-07');
    c.drift(1200); c.drift(800); c.courseFinie();
    expect(c.stats).toMatchObject({ drifts: 2, meilleurDrift: 1200, courses: 1 });
    expect(lireStatistiques(JSON.parse(JSON.stringify(c.stats)))).toEqual(c.stats);
    expect(lireStatistiques({ distanceZen: -4, courses: 'x', parVoiture: { inconnue: 3, kei: 7 }, depuis: 'hier' }))
      .toEqual({ ...statistiquesVides(), parVoiture: { kei: 7 } });
  });
  it('durées lisibles', () => {
    expect(formatDuree(42)).toBe('42 s');
    expect(formatDuree(600)).toBe('10 min');
    expect(formatDuree(3900)).toBe('1 h 05');
  });
});

describe('statistiques du compte', () => {
  it('les courses jouées connecté vont aussi dans l\'attente du compte, pas avant', () => {
    const c = new CompteurPilote(statistiquesVides(), () => '2026-10-07');
    c.pas('kei', 10, 0, false, 1);
    c.attente = statistiquesVides();
    c.pas('kei', 10, 0.5, false, 1);
    c.drift(500); c.courseFinie();
    expect(c.stats.distanceCourse).toBe(20);
    expect(c.attente).toMatchObject({ distanceCourse: 10, drifts: 1, courses: 1, meilleurDrift: 500, tempsGlisse: 1 });
  });
  it('fusion : sommes, records au maximum, date la plus ancienne', () => {
    const a = { ...statistiquesVides(), distanceZen: 5, plusLongDrift: 3, drifts: 2, parVoiture: { kei: 5 }, depuis: '2026-10-05' };
    const b = { ...statistiquesVides(), distanceZen: 1, plusLongDrift: 2, drifts: 1, parVoiture: { kei: 1, turbo: 2 }, depuis: '2026-10-01' };
    expect(fusionnerStatistiques(a, b)).toMatchObject({ distanceZen: 6, plusLongDrift: 3, drifts: 3, parVoiture: { kei: 6, turbo: 2 }, depuis: '2026-10-01' });
    expect(estVide(statistiquesVides())).toBe(true);
    expect(estVide(a)).toBe(false);
  });
});
