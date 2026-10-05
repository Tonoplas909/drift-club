// Empaquetage de la vérification des courses pour l'Edge Function Supabase `verifier-course`.
// Utilisé par tools/gen-fonction.ts (écriture des fichiers) et par le test qui vérifie qu'ils sont à jour.
import { build } from 'esbuild';

const racine = new URL('..', import.meta.url).pathname;

const paquet = async (entree: string): Promise<string> => (await build({
  absWorkingDir: racine,
  entryPoints: [entree],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  charset: 'utf8',
  legalComments: 'none',
  write: false,
})).outputFiles[0].text;

/**
 * Code de `supabase/functions/verifier-course/course.js` et empreinte de la simulation qu'il contient.
 * L'empreinte ne porte que sur src/serveur/simulation.ts (simulation, niveaux) : le jeu et la fonction doivent
 * rejouer les courses à l'identique, pas forcément traiter les requêtes de la même façon.
 */
export async function empaqueter(): Promise<{ code: string; empreinte: string }> {
  const corps = await paquet('src/serveur/course.ts');
  const simulation = await paquet('src/serveur/simulation.ts');
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(simulation)));
  const empreinte = Array.from(hash.slice(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
  const code = '// Généré par tools/gen-fonction.ts depuis src/serveur/course.ts (simulation et niveaux officiels) : ne pas modifier.\n'
    + '// @ts-nocheck\n'
    + corps
    + `export const EMPREINTE = '${empreinte}';\n`;
  return { code, empreinte };
}

export function fichierEmpreinte(empreinte: string): string {
  return '/** Empreinte de la simulation embarquée dans l\'Edge Function `verifier-course` : générée par tools/gen-fonction.ts, ne pas modifier. */\n'
    + `export const EMPREINTE_SIMULATION = '${empreinte}';\n`;
}
