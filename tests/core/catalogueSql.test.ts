import { describe, it, expect } from 'vitest';
import fichier from '../../supabase/migrations/0006_catalogue_skins.sql?raw';
import { genererCatalogueSql, lignesCatalogue, sqlTexte } from '../../src/core/catalogueSql';
import { SKINS, SKIN_DEFAUT } from '../../src/core/skins';
import { FUMEES, FUMEE_DEFAUT } from '../../src/core/fumees';
import { contenuCaisses } from '../../src/core/caisses';

describe('sqlTexte', () => {
  it('double les apostrophes et entoure de guillemets simples', () => {
    expect(sqlTexte('abc')).toBe("'abc'");
    expect(sqlTexte("l'or")).toBe("'l''or'");
    expect(sqlTexte("a'; drop table x; --")).toBe("'a''; drop table x; --'");
    expect(sqlTexte('a\\b')).toBe("'a\\b'");
  });
});

describe('lignesCatalogue', () => {
  it('contient toutes les livrées sauf « unie »', () => {
    const l = lignesCatalogue(SKINS, SKIN_DEFAUT);
    const attendu = Object.values(SKINS).reduce((n, liste) => n + liste.filter((s) => s.id !== SKIN_DEFAUT).length, 0);
    expect(l).toHaveLength(attendu);
    expect(l.some((x) => x.id === SKIN_DEFAUT)).toBe(false);
    for (const [voiture, liste] of Object.entries(SKINS)) {
      for (const s of liste.filter((x) => x.id !== SKIN_DEFAUT)) {
        expect(l).toContainEqual({ voiture, id: s.id, rarete: s.rarete });
      }
    }
  });
});

describe('catalogue en ligne : les fumées', () => {
  const l = lignesCatalogue(contenuCaisses(), SKIN_DEFAUT);
  it('contient une ligne (\'fumee\', id, rareté) par fumée, sans « classique »', () => {
    const lignesFumee = l.filter((x) => x.voiture === 'fumee');
    expect(lignesFumee).toHaveLength(FUMEES.length - 1);
    expect(lignesFumee.some((x) => x.id === FUMEE_DEFAUT)).toBe(false);
    for (const f of FUMEES.filter((x) => x.id !== FUMEE_DEFAUT)) expect(l).toContainEqual({ voiture: 'fumee', id: f.id, rarete: f.rarete });
  });
  it('respecte le format imposé par la table (voiture et id : ^[A-Za-z0-9_-]{1,40}$)', () => {
    for (const x of l) { expect(x.voiture).toMatch(/^[A-Za-z0-9_-]{1,40}$/); expect(x.id).toMatch(/^[A-Za-z0-9_-]{1,40}$/); }
  });
  it('les livrées des voitures y sont toujours', () => {
    for (const [voiture, liste] of Object.entries(SKINS)) for (const s of liste.filter((x) => x.id !== SKIN_DEFAUT)) expect(l).toContainEqual({ voiture, id: s.id, rarete: s.rarete });
  });
});

describe('genererCatalogueSql', () => {
  const lignes = lignesCatalogue(contenuCaisses(), SKIN_DEFAUT);
  const sql = genererCatalogueSql(lignes);

  it('écrit un upsert et un nettoyage idempotents avec chaque livrée', () => {
    expect(sql).toContain('insert into public.catalogue_skins (voiture, id, rarete) values');
    expect(sql).toContain('on conflict (voiture, id) do update set rarete = excluded.rarete;');
    expect(sql).toContain('delete from public.catalogue_skins');
    expect(sql).toContain('not in (');
    for (const l of lignes) {
      expect(sql).toContain(`('${l.voiture}', '${l.id}', '${l.rarete}')`);
      expect(sql).toContain(`  ('${l.voiture}', '${l.id}')`);
    }
    expect(sql).not.toContain(`'${SKIN_DEFAUT}'`);
    expect(sql).not.toContain(`('fumee', '${FUMEE_DEFAUT}'`);
  });

  it('échappe les apostrophes et refuse un catalogue vide', () => {
    const s = genererCatalogueSql([{ voiture: 'turbo', id: "l'or", rarete: 'exotique' }]);
    expect(s).toContain("('turbo', 'l''or', 'exotique')");
    expect(() => genererCatalogueSql([])).toThrow();
  });

  it('est déterministe', () => {
    expect(genererCatalogueSql(lignes)).toBe(sql);
  });

  it('le fichier 0006 commité est à jour avec le catalogue (relancer tools/gen-catalogue-sql.ts sinon)', () => {
    expect(fichier).toBe(sql);
  });
});
