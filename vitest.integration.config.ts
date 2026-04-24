import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    restoreMocks: true,
    testTimeout: 15000,

    include: ['test/integration/**/*.test.{js,ts,tsx}'],

    setupFiles: [
      'test/vitest-compat.ts',
      'test/integration/config/setup.js',
      'test/integration/config/env.js',
      'test/vitest/integration-setup-after.ts',
    ],

    coverage: {
      include: [
        'shared/**/*.{js,ts,tsx}',
        'ui/**/*.{js,ts,tsx}',
      ],
    },

    environmentOptions: {
      customExportConditions: ['node', 'node-addons'],
    },
  },
});
