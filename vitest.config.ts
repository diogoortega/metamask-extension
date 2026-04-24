import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    // Rewrites `jest.mock(` → `vi.mock(` at the SOURCE level so that
    // @vitest/mocker's static-analysis hoisting recognises the calls.
    // At runtime jest === vi (via test/vitest-compat.ts), so semantics are
    // identical – this only fixes the hoisting gap.
    //
    // We also add a vi.hoisted() preamble in TEST FILES ONLY (not setup files)
    // that wraps vi.mock factories to inject a `default` export pointing to the
    // mock object when the factory does not provide one. This matches Jest's
    // CJS behaviour where a mock factory return IS the module (default + named).
    {
      name: 'hoist-jest-mock',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('node_modules')) return;

        // Strip line comments before checking so we don't match jest.mock in comments
        const codeWithoutLineComments = code.replace(/\/\/[^\n]*/g, '');
        const hasMock = /\bjest\s*\.\s*(mock|unmock|hoisted)\s*\(/.test(codeWithoutLineComments);
        if (!hasMock) return;

        const replaced = code
          .replace(/\bjest\s*\.\s*mock\s*\(/g, 'vi.mock(')
          .replace(/\bjest\s*\.\s*unmock\s*\(/g, 'vi.unmock(')
          .replace(/\bjest\s*\.\s*hoisted\s*\(/g, 'vi.hoisted(');

        // Only inject the default-interop preamble in test files.
        // In setup files, vi.hoisted() runs immediately and would corrupt
        // the global vi.mock reference for all subsequent test files.
        const isTestFile = /\.(test|spec)\.[jt]sx?$/.test(id);
        if (!isTestFile) return replaced;

        const preamble = `
const __vitest_jest_compat__ = vi.hoisted(() => {
  const _orig = vi.mock.bind(vi);
  vi.mock = function(path, factory, opts) {
    if (typeof factory !== 'function') return _orig(path, factory, opts);
    return _orig(path, function() {
      const _r = factory();
      const normalize = (val) => {
        if (typeof val === 'function') {
          return { __esModule: true, default: val };
        }
        if (val !== null && typeof val !== 'object') {
          return { __esModule: true, default: val };
        }
        if (val && typeof val === 'object' && !('default' in val)) {
          Object.defineProperty(val, 'default', {
            get() {
              return val;
            },
            enumerable: false,
            configurable: true,
          });
        }
        return val;
      };
      if (_r && typeof _r.then === 'function') {
        return _r.then(normalize);
      }
      return normalize(_r);
    }, opts);
  };
});
`;
        return preamble + replaced;
      },
    },
    // Relative `jest.requireActual('../x')` reads app ESM; Node `createRequire`
    // cannot load it synchronously. Await + async mock factories match Vitest.
    {
      name: 'async-relative-require-actual',
      enforce: 'pre',
      transform(code, id) {
        if (id.includes('node_modules')) {
          return;
        }
        if (!/\.(test|spec)\.[jt]sx?$/.test(id)) {
          return;
        }
        const codeWithoutLineComments = code.replace(/\/\/[^\n]*/g, '');
        if (
          !/\bjest\s*\.\s*requireActual\s*\(\s*['"]\.\.?\//.test(
            codeWithoutLineComments,
          )
        ) {
          return;
        }
        let out = code.replace(
          /\bjest\s*\.\s*requireActual\s*\(\s*(['"])((?:\.\.?\/)[^'"]*)\1/g,
          'await jest.requireActual($1$2$1',
        );
        out = out.replace(
          /(\bjest\.mock\([^,]+),\s*\(\)\s*=>/g,
          '$1, async () =>',
        );
        out = out.replace(/(\bvi\.mock\([^,]+),\s*\(\)\s*=>/g, '$1, async () =>');
        return out;
      },
    },
    // Runs BEFORE Vite's built-in OXC transform (enforce:'pre') so project
    // .js files that contain JSX (e.g. ui/contexts/i18n.js,
    // test/lib/render-helpers.js) are parsed as JSX, not plain JS.
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
    // Expose describe/it/expect/vi as globals – no imports needed in test files
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
      '**/node_modules/**',
      'development/webpack/**',
      // CJS `require('eslint')` in utils.js is bound before Vitest can apply
      // `vi.mock('eslint')`; keep this file on Jest until the helper is ESM.
      'development/build/transforms/utils.test.js',
    ],

    // In Vitest there is no setupFilesAfterEnv distinction – all setupFiles
    // run inside the test environment.  Order matters: compat shim first,
    // then env vars, then the after-env equivalents last.
    setupFiles: [
      'test/vitest-compat.ts',
      'vitest-canvas-mock',
      'test/vitest/setup-before.ts',
      'test/env.js',
      'test/vitest/setup-after.ts',
    ],

    coverage: {
      provider: 'v8',
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
      // Mock lightweight-charts since it requires browser/canvas APIs
      'lightweight-charts': new URL(
        './test/mocks/lightweight-charts.ts',
        import.meta.url,
      ).pathname,
    },

    // 'vmThreads' runs each test file in a Node worker thread with a VM
    // context – this gives proper module interception so vi.mock() works for
    // both local files and node_modules (forks only intercepts node_modules).
    // 'vmForks' = child-process isolation (memory-stable for large suites) +
    // VM context (full module interception so vi.mock works for local files).
    pool: 'vmForks',

    // Packages that ship native ESM with extensionless imports (e.g.
    // react/jsx-runtime without .js) must be processed through Vite so
    // module resolution is intercepted and patched correctly.
    server: {
      deps: {
        inline: [
          // Ships native ESM with extensionless react/jsx-runtime imports
          '@metamask/design-system-react',
          // Ships .mjs with `import … assert { type: "json" }` – Node 24
          // removed support for import assertions; inline so Vite strips them
          '@metamask/smart-transactions-controller',
          // Accesses native DOM property descriptors; needs Vite transform so
          // it runs in the same realm as the test environment
          '@lavamoat/lavadome-react',
          '@lavamoat/lavadome-core',
        ],
      },
    },

    environmentOptions: {
      // Equivalent to jest's customExportConditions
      customExportConditions: ['node', 'node-addons'],
    },
  },
});
