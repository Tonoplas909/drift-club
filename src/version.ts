declare const __VERSION__: string | undefined;
declare const __BUILD__: string | undefined;
declare const __BUILD_ID__: string | undefined;

/** Version affichée en bas à gauche des menus, ex. « v0.2.0 » (injectée à la compilation par vite.config.ts). */
export const VERSION: string = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
/** Commit et date de compilation, en infobulle de la version. */
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : '';
/** Identifiant de compilation (commit publié, « local » en développement) : comparé à `version.json` pour la mise à jour automatique. */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'local';
