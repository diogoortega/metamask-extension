import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';
import {
  createHoistJestMockPlugin,
  createAsyncRelativeRequireActualPlugin,
} from './test/vitest/plugins';

export default defineConfig({
  plugins: [
    createHoistJestMockPlugin(),
    createAsyncRelativeRequireActualPlugin(),
    {
      name: 'jsx-in-js',
      enforce: 'pre',
      async transform(code, id) {
        if (!id.endsWith('.js') || id.includes('node_modules')) return;
        return transformWithOxc(code, id, { lang: 'jsx' });
      },
    },
    react(),
  ],
  test: {
    globals: true,
    environment: 'happy-dom',
    restoreMocks: true,
    testTimeout: 5500,

    include: [
      'app/scripts/**/*.test.{js,ts,tsx}',
      'app/offscreen/**/*.test.{js,ts,tsx}',
      'shared/**/*.test.{js,ts,tsx}',
      'ui/**/*.test.{js,ts,tsx}',
      'development/**/*.test.{js,ts,tsx}',
      'test/unit-global/**/*.test.{js,ts,tsx}',
      'test/e2e/helpers.test.js',
      'test/e2e/helpers/**/*.test.{js,ts,tsx}',
      'test/e2e/benchmarks/**/*.test.{js,ts,tsx}',
      'test/e2e/feature-flags/**/*.test.{js,ts,tsx}',
      'test/e2e/playwright/llm-workflow/**/*.test.{js,ts,tsx}',
    ],
    exclude: [
      'development/webpack/**',
      'development/build/transforms/utils.test.js',
    ],

    setupFiles: [
      'test/vitest-compat.ts',
      'test/vitest/setup-before.ts',
      'test/env.js',
      'test/vitest/setup-after.ts',
    ],

    coverage: {
      include: [
        'app/scripts/**/*.{js,ts,tsx}',
        'app/offscreen/**/*.{js,ts,tsx}',
        'shared/**/*.{js,ts,tsx}',
        'ui/**/*.{js,ts,tsx}',
        'development/build/transforms/**/*.js',
        'development/metamaskbot-build-announce/**/*.{js,ts}',
      ],
      exclude: ['**/*.stories.*', '**/*.snap'],
      reportsDirectory: './coverage/unit',
      reporter: ['html', 'json'],
    },

    alias: {
      'lightweight-charts': new URL(
        './test/mocks/lightweight-charts.js',
        import.meta.url,
      ).pathname,
    },

    pool: 'vmForks',

    server: {
      deps: {
        inline: [
          '@metamask/design-system-react',
          '@metamask/smart-transactions-controller',
          '@lavamoat/lavadome-react',
          '@lavamoat/lavadome-core',
        ],
      },
    },

    environmentOptions: {
      customExportConditions: ['node', 'node-addons'],
    },
  },
});
