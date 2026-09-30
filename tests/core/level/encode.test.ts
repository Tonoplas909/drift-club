import { describe, it, expect } from 'vitest';
import { encoderNiveau, decoderNiveau, normaliserNiveau, versBase64url, depuisBase64url, TAILLE_MAX_DECOMPRESSE } from '../../../src/core/level/encode';
import { loadLevel } from '../../../src/core/loadLevel';
import { empreinteNiveau } from '../../../src/core/level/fingerprint';
import { NIVEAUX_OFFICIELS } from '../../../src/levels';
import { ENVIRONNEMENTS, type Level, type TypeObjet } from '../../../src/core/level/types';
import { curveLevel, straightLevel } from '../../fixtures/levels';

const officiel = (i: number): Level => {
  const r = loadLevel(NIVEAUX_OFFICIELS[i].data);
  if (!r.ok) throw new Error(r.erreurs.join());
  return r.level;
};

/** Niveau « typique » : 40 points en S, 30 objets de tous types, quelques barrières (coordonnées à décimales). */
function niveauTypique(): Level {
  const route = Array.from({ length: 40 }, (_, i) => ({
    x: Math.round((i * 32 + Math.sin(i / 3) * 40) * 137.3) / 137.3,
    z: Math.cos(i / 4) * 120 + (i % 7) * 1.37,
    y: 20 + Math.sin(i / 5) * 12.34,
    l: 8 + (i % 5) * 1.5,
  }));
  const types: TypeObjet[] = ['arbre', 'sapin', 'rocher', 'pneus', 'barriere', 'panneau'];
  return {
    format: 1, nom: 'Circuit typique', auteur: 'Macalamar', environnement: 'montagne', ambiance: 'coucher',
    route,
    barrieres: [{ de: 2, a: 6, cote: 'ext' }, { de: 10, a: 14, cote: 'gauche' }, { de: 20, a: 22, cote: 'deux' }],
    decor: { graine: 1234567, densite: 0.55 },
    objets: Array.from({ length: 30 }, (_, i) => ({ type: types[i % 6], x: 100 + i * 37.77, z: -60 + (i % 5) * 41.23, rot: (i * 47) % 360 })),
  };
}

describe('base64url', () => {
  it('aller-retour pour toutes les longueurs', () => {
    for (let n = 0; n < 40; n++) {
      const o = Uint8Array.from({ length: n }, (_, i) => (i * 73 + 11) & 255);
      const s = versBase64url(o);
      expect(s).toMatch(/^[A-Za-z0-9_-]*$/);
      expect(Array.from(depuisBase64url(s)!)).toEqual(Array.from(o));
    }
  });
  it('correspond au base64url standard', () => {
    const o = Uint8Array.from([251, 255, 254, 1, 2]);
    expect(versBase64url(o)).toBe(btoa(String.fromCharCode(...o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
  });
  it('refuse les caractères invalides et les longueurs impossibles', () => {
    expect(depuisBase64url('ab+/')).toBeNull();
    expect(depuisBase64url('abc=')).toBeNull();
    expect(depuisBase64url('abcde')).toBeNull();
  });
});

describe('normaliserNiveau', () => {
  it('arrondit au 0,1 m, au degré et au centième sans −0', () => {
    const l = straightLevel();
    l.route[0] = { x: -0.04, z: 0.06, y: 1.26, l: 10.04 };
    l.objets = [{ type: 'arbre', x: 12.34, z: -5.55, rot: 89.6 }];
    l.decor.densite = 0.556;
    const n = normaliserNiveau(l);
    expect(n.route[0]).toEqual({ x: 0, z: 0.1, y: 1.3, l: 10 });
    expect(Object.is(n.route[0].x, 0)).toBe(true);
    expect(n.objets[0]).toEqual({ type: 'arbre', x: 12.3, z: -5.5, rot: 90 });
    expect(n.decor.densite).toBe(0.56);
  });
  it('est idempotent', () => {
    const n = normaliserNiveau(niveauTypique());
    expect(normaliserNiveau(n)).toEqual(n);
  });
});

describe('encoderNiveau / decoderNiveau', () => {
  it('le code commence par « 1. » et ne contient que du base64url', async () => {
    const code = await encoderNiveau(curveLevel());
    expect(code).toMatch(/^1\.[A-Za-z0-9_-]+$/);
  });

  it('aller-retour : le niveau décodé est le niveau normalisé', async () => {
    const l = niveauTypique();
    const r = await decoderNiveau(await encoderNiveau(l));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.level).toEqual(normaliserNiveau(l));
  });

  it('même empreinte après aller-retour : les records sont communs', async () => {
    const l = niveauTypique();
    const r = await decoderNiveau(await encoderNiveau(l));
    if (!r.ok) throw new Error('décodage');
    expect(await empreinteNiveau(r.level)).toBe(await empreinteNiveau(normaliserNiveau(l)));
    // l'empreinte ignore le nom et l'auteur
    const autre = await decoderNiveau(await encoderNiveau({ ...l, nom: 'Autre', auteur: '' }));
    if (!autre.ok) throw new Error('décodage');
    expect(await empreinteNiveau(autre.level)).toBe(await empreinteNiveau(r.level));
  });

  it('nom et auteur avec accents, guillemets et emoji', async () => {
    const l = { ...straightLevel(), nom: 'Col « du Loup » é"\\', auteur: 'Zoé ✨' };
    const r = await decoderNiveau(await encoderNiveau(l));
    expect(r.ok && r.level.nom).toBe(l.nom);
    expect(r.ok && r.level.auteur).toBe(l.auteur);
  });

  it('accepte des espaces autour du code', async () => {
    const code = await encoderNiveau(curveLevel());
    expect((await decoderNiveau(`  ${code}\n`)).ok).toBe(true);
  });

  it('chaque environnement fait l’aller-retour', async () => {
    for (const environnement of ENVIRONNEMENTS) {
      const lv = { ...niveauTypique(), environnement };
      const r = await decoderNiveau(await encoderNiveau(lv));
      if (!r.ok) throw new Error(r.erreurs.join());
      expect(r.level.environnement).toBe(environnement);
      expect(r.level).toEqual(normaliserNiveau(lv));
    }
  });
  it('les codes diffèrent d’un environnement à l’autre', async () => {
    const codes = await Promise.all(ENVIRONNEMENTS.map((environnement) => encoderNiveau({ ...niveauTypique(), environnement })));
    expect(new Set(codes).size).toBe(ENVIRONNEMENTS.length);
  });
  it('un lien « montagne » créé avant les thèmes se décode toujours pareil', async () => {
    // code produit par la version 0.2.x (environnement = indice 0)
    const ancien = '1.NcwxCsJQEIThq8jUU-xmTcjbc4jNsoXBVwQ0glEQJHeXh8pU31_MGwscx7k-X7vLXBcQJzgOdX2sICpciCtciTs8QtimIsmwkVq0hWSojNTB_hqMrfxUlPZFEhM8kjjDQzvbs5ckbu1caSLsRFgkc_sA';
    const attendu = {
      format: 1, nom: 'Vieux lien', auteur: 'Tests', environnement: 'montagne', ambiance: 'coucher',
      route: [{ x: 0, z: 0, y: 0, l: 10 }, { x: 3.8, z: 19.1, y: 0, l: 10 }, { x: 14.6, z: 35.4, y: 0, l: 10 }, { x: 30.9, z: 46.2, y: 0, l: 10 }, { x: 50, z: 50, y: 0, l: 10 }],
      barrieres: [], decor: { graine: 1234, densite: 0.5 }, objets: [{ type: 'sapin', x: 30, z: 20, rot: 90 }],
    };
    const r = await decoderNiveau(ancien);
    if (!r.ok) throw new Error(r.erreurs.join());
    expect(r.level).toEqual(attendu);
  });
  it('les niveaux officiels font l\'aller-retour et donnent des liens courts', async () => {
    const lignes: string[] = [];
    for (let i = 0; i < NIVEAUX_OFFICIELS.length; i++) {
      const l = officiel(i);
      const code = await encoderNiveau(l);
      const lien = `https://tonoplas909.github.io/drift-club/#n=${code}`;
      lignes.push(`${l.nom} : ${lien.length} caractères`);
      const r = await decoderNiveau(code);
      expect(r.ok, l.nom).toBe(true);
      if (r.ok) expect(r.level).toEqual(normaliserNiveau(l));
      expect(lien.length).toBeLessThan(2000);
    }
    console.log(`Longueur des liens des niveaux officiels\n${lignes.join('\n')}`);
  });

  it('un niveau typique (40 points, 30 objets) fait moins de 2000 caractères', async () => {
    const l = niveauTypique();
    const lien = `https://tonoplas909.github.io/drift-club/#n=${await encoderNiveau(l)}`;
    console.log(`Niveau typique (40 points, 30 objets) : ${lien.length} caractères`);
    expect(lien.length).toBeLessThan(2000);
  });

  it('un gros niveau (150 points, 300 objets) reste décodable', async () => {
    const base = niveauTypique();
    const l: Level = {
      ...base,
      route: Array.from({ length: 150 }, (_, i) => ({ x: i * 14, z: Math.sin(i / 6) * 90, y: (i % 10) * 2, l: 10 })),
      barrieres: [{ de: 0, a: 149, cote: 'deux' }],
      objets: Array.from({ length: 300 }, (_, i) => ({ type: 'arbre', x: i * 9.1, z: 50 + (i % 9) * 3.3, rot: i })),
    };
    const code = await encoderNiveau(l);
    const r = await decoderNiveau(code);
    expect(r.ok ? [] : r.erreurs).toEqual([]);
    console.log(`Niveau maximal (150 points, 300 objets) : ${code.length} caractères`);
  });

  describe('erreurs', () => {
    const ko = async (code: string, re: RegExp): Promise<void> => {
      const r = await decoderNiveau(code);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.erreurs.join(' ')).toMatch(re);
    };

    it('préfixe absent ou inconnu', async () => {
      await ko('', /invalide/);
      await ko('abc', /invalide/);
      await ko('.abc', /invalide/);
      await ko('1abc', /invalide/);
      await ko('2.abc', /version plus récente/);
      await ko('0.abc', /version plus récente/);
    });

    it('base64 invalide', async () => {
      await ko('1.', /invalide/);
      await ko('1.a', /invalide/);
      await ko('1.abc+/=', /invalide/);
      await ko('1.é', /invalide/);
    });

    it('données qui ne se décompressent pas', async () => {
      await ko('1.AAAAAAAAAAAA', /invalide/);
      const code = await encoderNiveau(curveLevel());
      await ko(code.slice(0, code.length - 12), /invalide/);
    });

    it('JSON invalide, forme invalide', async () => {
      const cz = async (v: string): Promise<string> => {
        const flux = new CompressionStream('deflate-raw');
        const w = flux.writable.getWriter();
        void w.write(new TextEncoder().encode(v)); void w.close();
        return `1.${versBase64url(new Uint8Array(await new Response(flux.readable).arrayBuffer()))}`;
      };
      await ko(await cz('pas du json'), /invalide/);
      await ko(await cz('[]'), /invalide/);
      await ko(await cz('{"n":"x"}'), /invalide/);
      await ko(await cz('{"n":"x","a":"","e":5,"m":0,"r":[],"b":[],"d":[1,50],"o":[]}'), /invalide/);
    });

    it('trop gros une fois décompressé', async () => {
      const gros = 'x'.repeat(TAILLE_MAX_DECOMPRESSE + 1000);
      const flux = new CompressionStream('deflate-raw');
      const w = flux.writable.getWriter();
      void w.write(new TextEncoder().encode(gros)); void w.close();
      const code = `1.${versBase64url(new Uint8Array(await new Response(flux.readable).arrayBuffer()))}`;
      expect(code.length).toBeLessThan(2000);
      await ko(code, /trop gros/);
    });

    it('niveau bien formé mais refusé par la validation (croisement, largeur, nom)', async () => {
      const l = niveauTypique();
      // nom vide
      const r1 = await decoderNiveau(await encoderNiveau({ ...l, nom: '   ' }));
      expect(r1.ok).toBe(false);
      if (!r1.ok) expect(r1.erreurs.join(' ')).toMatch(/nom/);
      // largeur hors limites
      const r2 = await decoderNiveau(await encoderNiveau({ ...l, route: l.route.map((p) => ({ ...p, l: 50 })) }));
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.erreurs.join(' ')).toMatch(/largeur/);
      // route qui se recoupe
      const boucle = straightLevel();
      boucle.route = [{ x: 0, z: 0, y: 0, l: 10 }, { x: 60, z: 0, y: 0, l: 10 }, { x: 60, z: 60, y: 0, l: 10 }, { x: 0, z: 60, y: 0, l: 10 }, { x: 0, z: 0, y: 0, l: 10 }, { x: 30, z: -50, y: 0, l: 10 }];
      const r3 = await decoderNiveau(await encoderNiveau(boucle));
      expect(r3.ok).toBe(false);
      if (!r3.ok) expect(r3.erreurs.join(' ')).toMatch(/croise/);
    });
  });
});
