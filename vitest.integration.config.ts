import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    restoreMocks: true,
    testTimeout: 15000,
    maxWorkers: '50%',

    include: ['test/integration/**/*.test.{js,ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      'test/integration/config/**',
    ],

    setupFiles: [
      'test/vitest-compat.ts',
      'test/integration/config/setup.js',
      'test/integration/config/env.js',
      'test/vitest/integration-setup-after.ts',
    ],

    coverage: {
      provider: 'v8',
      include: [
        'shared/**/*.{js,ts,tsx}',
        'ui/**/*.{js,ts,tsx}',
      ],
      exclude: ['**/*.stories.*', '**/*.snap', '**/*.test.{js,ts,tsx}'],
      reportsDirectory: './coverage/integration',
      reporter: ['html', 'json'],
    },

    pool: 'forks',

    environmentOptions: {
      customExportConditions: ['node', 'node-addons'],
    },
  },
});
