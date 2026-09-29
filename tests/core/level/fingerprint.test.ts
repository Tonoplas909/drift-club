import { describe, it, expect } from 'vitest';
import { empreinteNiveau } from '../../../src/core/level/fingerprint';
import { straightLevel } from '../../fixtures/levels';

describe('empreinteNiveau', () => {
  it('calcule une empreinte SHA-256', async () => {
    const l = straightLevel();
    const empreinte = await empreinteNiveau(l);
    expect(typeof empreinte).toBe('string');
    expect(empreinte.length).toBe(64); // SHA-256 = 32 bytes = 64 hex chars
    expect(/^[0-9a-f]{64}$/.test(empreinte)).toBe(true);
  });

  it('rend la même empreinte pour le même niveau (déterministe)', async () => {
    const l = straightLevel();
    const e1 = await empreinteNiveau(l);
    const e2 = await empreinteNiveau(l);
    expect(e1).toBe(e2);
  });

  it('ignore le nom et l\'auteur', async () => {
    const l1 = straightLevel();
    const l2 = straightLevel();
    l2.nom = 'Autre nom';
    l2.auteur = 'Autre auteur';
    const e1 = await empreinteNiveau(l1);
    const e2 = await empreinteNiveau(l2);
    expect(e1).toBe(e2);
  });

  it('change d\'empreinte si la route change', async () => {
    const l1 = straightLevel();
    const l2 = straightLevel();
    l2.route[0].x += 10;
    const e1 = await empreinteNiveau(l1);
    const e2 = await empreinteNiveau(l2);
    expect(e1).not.toBe(e2);
  });

  it('change d\'empreinte si les barrières changent', async () => {
    const l1 = straightLevel();
    const l2 = straightLevel();
    l2.barrieres.push({ de: 0, a: 1, cote: 'gauche' });
    const e1 = await empreinteNiveau(l1);
    const e2 = await empreinteNiveau(l2);
    expect(e1).not.toBe(e2);
  });

  it('change d\'empreinte si le décor change', async () => {
    const l1 = straightLevel();
    const l2 = straightLevel();
    l2.decor.graine += 1;
    const e1 = await empreinteNiveau(l1);
    const e2 = await empreinteNiveau(l2);
    expect(e1).not.toBe(e2);
  });
});
