import { describe, it, expect } from 'vitest';
import { analyserSaisie, lireFragment, lienNiveau, lienEnLigne } from '../../src/share/lien';

const ID = '3f2b8c1e-9d4a-4b6f-8e21-0a7c5d9e1f34';

describe('liens', () => {
  it('construit les adresses', () => {
    expect(lienNiveau('https://x.github.io', '/drift-club/', '1.abc')).toBe('https://x.github.io/drift-club/#n=1.abc');
    expect(lienEnLigne('http://localhost:5173', '/drift-club/', ID)).toBe(`http://localhost:5173/drift-club/#en-ligne=${ID}`);
  });
});

describe('lireFragment', () => {
  it('lit n= et en-ligne=, avec ou sans #', () => {
    expect(lireFragment('#n=1.AbC_-9')).toEqual({ type: 'code', code: '1.AbC_-9' });
    expect(lireFragment('n=1.AbC')).toEqual({ type: 'code', code: '1.AbC' });
    expect(lireFragment(`#en-ligne=${ID}`)).toEqual({ type: 'en-ligne', id: ID });
    expect(lireFragment(`#en-ligne=${ID.toUpperCase()}`)).toEqual({ type: 'en-ligne', id: ID });
  });
  it('ignore le reste (jetons d\'authentification, vide, valeurs invalides)', () => {
    for (const f of ['', '#', '#access_token=abc&type=recovery', '#n=', '#n=abc', '#n=1.a b', '#n=1.abc&x=1', '#en-ligne=123', '#en-ligne=', '#autre=1.abc']) {
      expect(lireFragment(f), f).toBeNull();
    }
  });
});

describe('analyserSaisie', () => {
  it('code seul, avec espaces et retours à la ligne', () => {
    expect(analyserSaisie('1.abcDEF-_')).toEqual({ type: 'code', code: '1.abcDEF-_' });
    expect(analyserSaisie('  1.abc\n')).toEqual({ type: 'code', code: '1.abc' });
    expect(analyserSaisie('1.abc\ndef')).toEqual({ type: 'code', code: '1.abcdef' });
  });
  it('lien complet', () => {
    expect(analyserSaisie('https://tonoplas909.github.io/drift-club/#n=1.abc')).toEqual({ type: 'code', code: '1.abc' });
    expect(analyserSaisie('  http://localhost:5173/drift-club/?debug#n=1.abc  ')).toEqual({ type: 'code', code: '1.abc' });
    expect(analyserSaisie(`https://x.github.io/drift-club/#en-ligne=${ID}`)).toEqual({ type: 'en-ligne', id: ID });
  });
  it('fragment collé seul', () => {
    expect(analyserSaisie('#n=1.abc')).toEqual({ type: 'code', code: '1.abc' });
    expect(analyserSaisie('n=1.abc')).toEqual({ type: 'code', code: '1.abc' });
  });
  it('JSON collé', () => {
    expect(analyserSaisie(' {"format":1} ')).toEqual({ type: 'json', texte: '{"format":1}' });
  });
  it('déchets : null', () => {
    for (const s of ['', '   ', 'bonjour', 'https://exemple.fr/', 'https://exemple.fr/#autre', 'https://exemple.fr/#n=zzz', '1.', '.abc', '12345']) {
      expect(analyserSaisie(s), s).toBeNull();
    }
  });
});
