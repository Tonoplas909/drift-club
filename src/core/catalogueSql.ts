import type { Rarete } from './raretes';

/** Livrée telle que la voit le catalogue en ligne (table `catalogue_skins`). */
export interface LigneCatalogue { voiture: string; id: string; rarete: Rarete }

/** Littéral SQL texte : apostrophes doublées, rien d'autre n'a de sens spécial entre apostrophes (standard_conforming_strings). */
export const sqlTexte = (s: string): string => `'${s.replace(/'/g, "''")}'`;

/** Lignes du catalogue : tous les objets de toutes les collections (voitures et `fumee`), sauf `defaut` (« unie », toujours débloquée). */
export function lignesCatalogue(skins: Record<string, { id: string; rarete: Rarete }[]>, defaut: string): LigneCatalogue[] {
  const out: LigneCatalogue[] = [];
  for (const voiture of Object.keys(skins).sort()) {
    for (const s of skins[voiture]) if (s.id !== defaut) out.push({ voiture, id: s.id, rarete: s.rarete });
  }
  return out;
}

/** Script SQL idempotent (upsert + suppression des livrées retirées du jeu) qui aligne `catalogue_skins` sur le code. */
export function genererCatalogueSql(lignes: LigneCatalogue[]): string {
  if (lignes.length === 0) throw new Error('Catalogue vide : rien à écrire.');
  const valeurs = lignes.map((l) => `(${sqlTexte(l.voiture)}, ${sqlTexte(l.id)}, ${sqlTexte(l.rarete)})`);
  const cles = lignes.map((l) => `(${sqlTexte(l.voiture)}, ${sqlTexte(l.id)})`);
  return [
    '-- Drift Club : catalogue des livrées qui sortent des caisses (GÉNÉRÉ, ne pas modifier à la main).',
    '-- Produit par : npx vite-node tools/gen-catalogue-sql.ts (à partir de src/core/skins.ts et fumees.ts).',
    '-- À coller dans Supabase → SQL Editor → Run, après 0005. Peut être relancé sans danger.',
    '-- Après avoir ajouté ou retiré des livrées ou des fumées : relancer le générateur et coller de nouveau ce fichier.',
    "-- Les fumées de pneus y figurent sous la voiture « fumee » ; elles sortent des mêmes caisses que les livrées.",
    `-- ${lignes.length} objets (livrées et fumées).`,
    '',
    'insert into public.catalogue_skins (voiture, id, rarete) values',
    valeurs.map((v) => `  ${v}`).join(',\n'),
    'on conflict (voiture, id) do update set rarete = excluded.rarete;',
    '',
    '-- livrées retirées du jeu',
    'delete from public.catalogue_skins',
    ' where (voiture, id) not in (',
    cles.map((k) => `  ${k}`).join(',\n'),
    ');',
    '',
  ].join('\n');
}
