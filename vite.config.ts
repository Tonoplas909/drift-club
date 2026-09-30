import { defineConfig } from 'vitest/config';
import pkg from './package.json';

/** Détail de la compilation (infobulle de la version) : commit publié (GitHub Actions) et date. */
function build(): string {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const sha = env.GITHUB_SHA?.slice(0, 7) ?? 'local';
  return `${sha} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  base: '/drift-club/',
  define: { __VERSION__: JSON.stringify(`v${pkg.version}`), __BUILD__: JSON.stringify(build()) },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
