import { describe, it, expect } from 'vitest';
import { textePlace } from '../../src/ui/classement';

describe('place affichée sous un niveau', () => {
  it('textes selon l\'état', () => {
    expect(textePlace({ place: { rang: 1, total: 12, score: 5000, mode: 'semi' } })).toBe('Place : 1er sur 12');
    expect(textePlace({ place: { rang: 3, total: 12, score: 5000, mode: 'semi' } })).toBe('Place : 3e sur 12');
    expect(textePlace({ place: null })).toBe('Pas encore classé');
    expect(textePlace('deconnecte')).toBe('Connecte-toi pour voir ta place');
    expect(textePlace('erreur')).toBe('Classement indisponible');
  });
});
