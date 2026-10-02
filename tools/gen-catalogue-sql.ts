// Génère supabase/migrations/0006_catalogue_skins.sql depuis le catalogue de livrées du jeu.
// Usage : npx vite-node tools/gen-catalogue-sql.ts   (vite-node vient avec vitest, rien à installer)
import { writeFileSync } from 'node:fs';
import { SKIN_DEFAUT } from '../src/core/skins';
import { contenuCaisses } from '../src/core/caisses';
import { genererCatalogueSql, lignesCatalogue } from '../src/core/catalogueSql';

const lignes = lignesCatalogue(contenuCaisses(), SKIN_DEFAUT);
const sortie = new URL('../supabase/migrations/0006_catalogue_skins.sql', import.meta.url);
writeFileSync(sortie, genererCatalogueSql(lignes));
console.log(`${lignes.length} objets (livrées et fumées) écrits dans supabase/migrations/0006_catalogue_skins.sql`);
