import type { PluginOption } from 'vite';

export function createHoistJestMockPlugin(): PluginOption {
  return {
    name: 'hoist-jest-mock',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules')) return;

      const codeWithoutLineComments = code.replace(/\/\/[^\n]*/g, '');
      const hasMock = /\bjest\s*\.\s*(mock|unmock|hoisted)\s*\(/.test(
        codeWithoutLineComments,
      );
      if (!hasMock) return;

      const replaced = code
        .replace(/\bjest\s*\.\s*mock\s*\(/g, 'vi.mock(')
        .replace(/\bjest\s*\.\s*unmock\s*\(/g, 'vi.unmock(')
        .replace(/\bjest\s*\.\s*hoisted\s*\(/g, 'vi.hoisted(');

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
  };
}

export function createAsyncRelativeRequireActualPlugin(): PluginOption {
  return {
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
  };
}
