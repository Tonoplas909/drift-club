import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/drift-club/',
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
