import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import pkg from './package.json';

/** Détail de la compilation (infobulle de la version) : commit publié (GitHub Actions) et date. */
function build(): string {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const sha = env.GITHUB_SHA?.slice(0, 7) ?? 'local';
  return `${sha} · ${new Date().toISOString().slice(0, 10)}`;
}

/** Identifiant de cette compilation (commit publié) : le jeu le compare à `version.json` pour se mettre à jour tout seul. */
function buildId(): string {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  return env.GITHUB_SHA ?? 'local';
}

/** Écrit `version.json` dans le site publié. */
function fichierVersion(): Plugin {
  return {
    name: 'drift-club-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: buildId(), version: pkg.version }) });
    },
  };
}

export default defineConfig({
  base: '/drift-club/',
  define: { __VERSION__: JSON.stringify(`v${pkg.version}`), __BUILD__: JSON.stringify(build()), __BUILD_ID__: JSON.stringify(buildId()) },
  plugins: [fichierVersion()],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
