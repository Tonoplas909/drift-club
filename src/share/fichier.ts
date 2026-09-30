import type { Level } from '../core/level/types';
import { jsonLisible, nomFichier } from '../editor/format';

/** Télécharge un niveau au format lisible (§5.1), nommé d'après le niveau. */
export function telechargerJson(level: Level): void {
  const url = URL.createObjectURL(new Blob([jsonLisible(level)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier(level.nom);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
