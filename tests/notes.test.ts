import { describe, it, expect } from 'vitest';
import { NOTES } from '../src/notes';
import pkg from '../package.json';

const cmp = (a: string, b: string): number => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

describe('notes de version', () => {
  it('la plus récente correspond à la version de package.json (à mettre à jour à chaque mise en ligne)', () => {
    expect(NOTES[0].version).toBe(pkg.version);
  });
  it('versions uniques, de la plus récente à la plus ancienne, dates et notes renseignées', () => {
    for (let i = 1; i < NOTES.length; i++) expect(cmp(NOTES[i - 1].version, NOTES[i].version)).toBeGreaterThan(0);
    for (const n of NOTES) {
      expect(n.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(n.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
      expect(n.titre.length).toBeGreaterThan(0);
      expect(n.notes.length).toBeGreaterThan(0);
    }
  });
});
