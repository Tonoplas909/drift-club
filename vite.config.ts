import { defineConfig } from 'vitest/config';
import pkg from './package.json';

/** « v0.2.0 · a0998ad · 2026-09-30 » : version du package, commit publié (GitHub Actions) et date de compilation. */
function version(): string {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const sha = env.GITHUB_SHA?.slice(0, 7) ?? 'local';
  return `v${pkg.version} · ${sha} · ${new Date().toISOString().slice(0, 10)}`;
}

export default defineConfig({
  base: '/drift-club/',
  define: { __VERSION__: JSON.stringify(version()) },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
