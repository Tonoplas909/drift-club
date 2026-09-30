declare const __VERSION__: string | undefined;

/** Version affichée en bas à gauche des menus (injectée à la compilation par vite.config.ts). */
export const VERSION: string = typeof __VERSION__ === 'string' ? __VERSION__ : 'dev';
