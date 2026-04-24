/**
 * Jest → Vitest global compatibility shim.
 *
 * Loaded as the very first setupFile so that every subsequent setup file and
 * every test file can call `jest.*` APIs without any per-file changes.
 *
 * `jest.requireMock` is synchronous in Jest; we resolve it from all Vitest mocker
 * registries (including `"global"`) with path heuristics.
 *
 * `jest.requireActual('react')`-style bare specifiers use `createRequire` so they
 * can be spread inside sync mock factories. Relative specifiers load app ESM via
 * `import(fileURL)` and return a Promise — the `async-relative-require-actual`
 * plugin in vitest.config.ts inserts `await` and `async` mock factories.
 */

import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, dirname, resolve as pathResolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseSingleStack } from '@vitest/utils/source-map';
import { vi, afterEach } from 'vitest';

type VitestMockInstance = typeof vi;

type ManualMockEntry = {
  type: 'manual';
  raw: string;
  id: string;
  resolve: () => unknown;
};

function slash(p: string): string {
  return p.replace(/\\/g, '/');
}

function toFsPath(file: string): string {
  const withoutQuery = file.split('?')[0];
  if (withoutQuery.startsWith('file:')) {
    try {
      return fileURLToPath(withoutQuery);
    } catch {
      return withoutQuery;
    }
  }
  return withoutQuery;
}

function stripKnownExtension(p: string): string {
  return p.replace(/\.(mjs|cjs|ts|tsx|js|jsx)$/, '');
}

/** First stack frame after any `vitest-compat` frame (the real caller). */
function getCallerFileAboveCompat(): string | undefined {
  const lines = new Error().stack?.split('\n') ?? [];
  let passedCompat = false;
  for (const line of lines) {
    if (line.includes('vitest-compat')) {
      passedCompat = true;
      continue;
    }
    if (!passedCompat) {
      continue;
    }
    const parsed = parseSingleStack(line);
    const file = parsed?.file;
    if (!file || file.includes('node_modules')) {
      continue;
    }
    return toFsPath(file);
  }
  return undefined;
}

function requireActualBareSpecifierSync<T>(moduleName: string): T {
  const caller = getCallerFileAboveCompat();
  if (!caller) {
    throw new Error(
      '[vitest-compat] jest.requireActual: could not determine caller file from stack',
    );
  }
  const req = createRequire(caller);
  return req(moduleName) as T;
}

function resolveRelativeSpecifierToFile(caller: string, specifier: string): string {
  const base = pathResolve(dirname(caller), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    `${base}/index.ts`,
    `${base}/index.tsx`,
    `${base}/index.js`,
    `${base}/index.jsx`,
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    `[vitest-compat] jest.requireActual: could not resolve "${specifier}" from ${caller}`,
  );
}

async function importActualRelative<T>(moduleName: string): Promise<T> {
  const caller = getCallerFileAboveCompat();
  if (!caller) {
    return vi.importActual<T>(moduleName);
  }
  const file = resolveRelativeSpecifierToFile(caller, moduleName);
  const href = pathToFileURL(file).href;
  return import(/* @vite-ignore */ href) as Promise<T>;
}

/**
 * Bare imports (e.g. `react`) resolve to CJS builds via Node and can be spread
 * synchronously inside mock factories. Relative specifiers point at app ESM;
 * they are loaded via dynamic `import()` from the caller file (see
 * `async-relative-require-actual` transform in vitest.config.ts).
 */
function requireActualJestCompat<T>(moduleName: string): T | Promise<T> {
  if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
    return importActualRelative<T>(moduleName);
  }
  try {
    return requireActualBareSpecifierSync<T>(moduleName);
  } catch {
    return vi.importActual<T>(moduleName);
  }
}

function requireMockSync<T>(moduleName: string): T {
  const mocker = (
    globalThis as {
      __vitest_mocker__?: {
        getMockerRegistry: () => {
          registryById: Map<string, ManualMockEntry | { type: string }>;
        };
        /** Hoisted mocks can be registered under `"global"` before Vitest sets the current filepath. */
        registries?: Map<string, { registryById: Map<string, unknown> }>;
      };
    }
  ).__vitest_mocker__;

  if (!mocker?.getMockerRegistry) {
    throw new Error(
      '[vitest-compat] jest.requireMock: __vitest_mocker__ is not available',
    );
  }

  const caller = getCallerFileAboveCompat();
  const resolvedRelative =
    moduleName.startsWith('.') && caller
      ? slash(pathResolve(dirname(caller), moduleName))
      : null;

  let resolvedByNode: string | null = null;
  if (moduleName.startsWith('.') && caller) {
    try {
      resolvedByNode = slash(
        createRequire(caller).resolve(moduleName),
      );
    } catch {
      resolvedByNode = null;
    }
  }

  const registryList = mocker.registries?.size
    ? [...mocker.registries.values()]
    : [mocker.getMockerRegistry()];

  for (const registry of registryList) {
    for (const mock of registry.registryById.values()) {
      if (
        !mock ||
        typeof mock !== 'object' ||
        (mock as { type?: string }).type !== 'manual'
      ) {
        continue;
      }
      const manual = mock as ManualMockEntry;
      if (manual.raw === moduleName) {
        return manual.resolve() as T;
      }
      if (caller && moduleName.startsWith('.')) {
        const idFs = slash(toFsPath(manual.id));
        const candidates = [resolvedRelative, resolvedByNode].filter(Boolean);
        for (const cand of candidates) {
          if (
            cand &&
            (idFs === cand ||
              stripKnownExtension(idFs) === stripKnownExtension(cand))
          ) {
            return manual.resolve() as T;
          }
        }
        // createRequire often cannot resolve extensionless TS specifiers; match
        // by parent folder + basename (Vitest stores resolved absolute ids).
        if (resolvedRelative) {
          const wantBase = stripKnownExtension(basename(resolvedRelative));
          const wantDir = slash(dirname(resolvedRelative));
          const idBase = stripKnownExtension(basename(idFs));
          const idDir = slash(dirname(idFs));
          if (wantBase === idBase && wantDir === idDir) {
            return manual.resolve() as T;
          }
        }
      }
    }
  }

  throw new Error(
    `[vitest-compat] jest.requireMock('${moduleName}'): no matching manual mock (caller: ${caller ?? 'unknown'})`,
  );
}

// ---------------------------------------------------------------------------
// jest.replaceProperty – replaces any property on any object and restores it
// after each test (mirrors Jest 29's jest.replaceProperty behaviour).
// ---------------------------------------------------------------------------

type Replaced<T> = { restore: () => void; value: T };

const _replacements: Array<() => void> = [];

function replaceProperty<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  value: T[K],
): Replaced<T[K]> {
  const descriptor = Object.getOwnPropertyDescriptor(obj, key);
  const originalValue = obj[key];

  Object.defineProperty(obj, key, {
    value,
    writable: true,
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
  });

  const restore = () => {
    if (descriptor) {
      Object.defineProperty(obj, key, descriptor);
    } else {
      // Property didn't exist originally – delete it
      delete obj[key];
    }
  };

  _replacements.push(restore);
  return { restore, value: originalValue };
}

// Auto-restore after every test, matching Jest's behaviour with restoreMocks
afterEach(() => {
  while (_replacements.length) {
    _replacements.pop()?.();
  }
});

// ---------------------------------------------------------------------------
// vi.fn – Vitest rejects `new` on mocks whose implementation is an arrow
// function. Jest allows `jest.fn().mockImplementation(() => ({ ... }))` with
// `new`.  Wrap arrow implementations in a traditional function (same as Jest).
// ---------------------------------------------------------------------------

function wrapArrowImplementation(impl: unknown): unknown {
  if (
    typeof impl === 'function' &&
    !Object.prototype.hasOwnProperty.call(impl, 'prototype')
  ) {
    const fn = impl as (...args: unknown[]) => unknown;
    return function compatConstructorWrapper(this: unknown, ...args: unknown[]) {
      return fn.apply(this, args);
    };
  }
  return impl;
}

const _baseViFn = vi.fn.bind(vi);
vi.fn = function jestCompatibleViFn(
  ...args: unknown[]
): ReturnType<typeof vi.fn> {
  const wrappedArgs = args.map((a) => wrapArrowImplementation(a));
  const mock = _baseViFn(...(wrappedArgs as Parameters<typeof vi.fn>)) as {
    mockImplementation: (impl: unknown) => unknown;
    mockImplementationOnce: (impl: unknown) => unknown;
  };
  const origImpl = mock.mockImplementation.bind(mock);
  const origOnce = mock.mockImplementationOnce.bind(mock);
  mock.mockImplementation = (impl: unknown) =>
    origImpl(wrapArrowImplementation(impl));
  mock.mockImplementationOnce = (impl: unknown) =>
    origOnce(wrapArrowImplementation(impl));
  return mock as ReturnType<typeof vi.fn>;
} as typeof vi.fn;

// ---------------------------------------------------------------------------
// Assemble the shim
// ---------------------------------------------------------------------------

const jestCompat = Object.assign(vi, {
  requireActual: requireActualJestCompat,
  requireMock: requireMockSync,
  replaceProperty,
} as unknown as VitestMockInstance);

// @ts-expect-error – deliberately writing to globalThis for broad compat
globalThis.jest = jestCompat;
