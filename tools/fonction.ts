// Empaquetage de la vérification des courses pour l'Edge Function Supabase `verifier-course`.
// Utilisé par tools/gen-fonction.ts (écriture des fichiers) et par le test qui vérifie qu'ils sont à jour.
import { build } from 'esbuild';

const racine = new URL('..', import.meta.url).pathname;

/** Code de `supabase/functions/verifier-course/course.js` et empreinte de la simulation qu'il contient. */
export async function empaqueter(): Promise<{ code: string; empreinte: string }> {
  const r = await build({
    absWorkingDir: racine,
    entryPoints: ['src/serveur/course.ts'],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    charset: 'utf8',
    legalComments: 'none',
    write: false,
  });
  const corps = r.outputFiles[0].text;
  const hash = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(corps)));
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
