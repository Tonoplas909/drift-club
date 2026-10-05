// Régénère l'Edge Function de vérification des scores après un changement de la simulation ou des niveaux officiels.
// Usage : npx vite-node tools/gen-fonction.ts   (puis redéployer la fonction, voir supabase/README.md)
import { writeFileSync } from 'node:fs';
import { empaqueter, fichierEmpreinte } from './fonction';

const { code, empreinte } = await empaqueter();
writeFileSync(new URL('../supabase/functions/verifier-course/course.js', import.meta.url), code);
writeFileSync(new URL('../src/online/empreinteSimulation.ts', import.meta.url), fichierEmpreinte(empreinte));
console.log(`Simulation ${empreinte} (${Math.round(code.length / 1024)} ko) écrite dans supabase/functions/verifier-course/course.js`);
