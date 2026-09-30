// Génère supabase/migrations/0006_catalogue_skins.sql depuis le catalogue de livrées du jeu.
// Usage : npx vite-node tools/gen-catalogue-sql.ts   (vite-node vient avec vitest, rien à installer)
import { writeFileSync } from 'node:fs';
import { SKINS, SKIN_DEFAUT } from '../src/core/skins';
import { genererCatalogueSql, lignesCatalogue } from '../src/core/catalogueSql';

const lignes = lignesCatalogue(SKINS, SKIN_DEFAUT);
const sortie = new URL('../supabase/migrations/0006_catalogue_skins.sql', import.meta.url);
writeFileSync(sortie, genererCatalogueSql(lignes));
console.log(`${lignes.length} livrées écrites dans supabase/migrations/0006_catalogue_skins.sql`);
