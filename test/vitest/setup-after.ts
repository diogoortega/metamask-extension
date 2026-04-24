/**
 * Vitest equivalent of test/jest/setup.js  (setupFilesAfterEnv).
 *
 * Uses vi.* APIs directly so this file is self-contained even without the
 * jest-compat shim.  The custom matchers (toBeFulfilled / toNeverResolve) are
 * copied verbatim – they only depend on expect.extend which Vitest supports.
 */

import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';

vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      getManifest: () => ({ manifest_version: 2 }),
    },
  },
  runtime: {
    getManifest: () => ({ manifest_version: 2 }),
  },
}));

/**
 * Mock BrowserStorageAdapter with InMemoryStorageAdapter globally so tests
 * don't depend on browser.storage.local.
 * Tests that need the real implementation can call vi.unmock() or
 * await vi.importActual() directly.
 */
vi.mock('../../app/scripts/lib/stores/browser-storage-adapter', async () => {
  const { InMemoryStorageAdapter } = await vi.importActual<
    typeof import('@metamask/storage-service')
  >('@metamask/storage-service');
  return { BrowserStorageAdapter: InMemoryStorageAdapter };
});

// ---------------------------------------------------------------------------
// Custom matchers
// ---------------------------------------------------------------------------

const UNRESOLVED = Symbol('timedOut');
const originalSetTimeout = global.setTimeout;
const TIME_TO_WAIT_UNTIL_UNRESOLVED = 100;

function treatUnresolvedAfter(duration: number): Promise<symbol> {
  return new Promise((resolve) => {
    originalSetTimeout(resolve, duration, UNRESOLVED);
  });
}

expect.extend({
  async toBeFulfilled(promise: Promise<unknown>) {
    if (this.isNot) {
      throw new Error(
        "Using `.not.toBeFulfilled(...)` is not supported. Use `.rejects` to test the promise's rejection value instead.",
      );
    }

    let rejectionValue: unknown = UNRESOLVED;
    try {
      await promise;
    } catch (e) {
      rejectionValue = e;
    }

    if (rejectionValue !== UNRESOLVED) {
      return {
        message: () =>
          `Expected promise to be fulfilled, but it was rejected with ${rejectionValue}.`,
        pass: false,
      };
    }

    return {
      message: () =>
        'This message should not be displayed as it is for the negative case, which will never happen.',
      pass: true,
    };
  },

  async toNeverResolve(promise: Promise<unknown>) {
    if (this.isNot) {
      throw new Error(
        'Using `.not.toNeverResolve(...)` is not supported. ' +
          'You probably want to either `await` the promise and test its ' +
          'resolution value or use `.rejects` to test its rejection value instead.',
      );
    }

    let resolutionValue: unknown;
    let rejectionValue: unknown;
    try {
      resolutionValue = await Promise.race([
        promise,
        treatUnresolvedAfter(TIME_TO_WAIT_UNTIL_UNRESOLVED),
      ]);
    } catch (e) {
      rejectionValue = e;
    }

    return resolutionValue === UNRESOLVED
      ? {
          message: () =>
            `Expected promise to resolve after ${TIME_TO_WAIT_UNTIL_UNRESOLVED}ms, but it did not`,
          pass: true,
        }
      : {
          message: () =>
            `Expected promise to never resolve after ${TIME_TO_WAIT_UNTIL_UNRESOLVED}ms, but it ${
              rejectionValue
                ? `was rejected with ${rejectionValue}`
                : `resolved with ${resolutionValue}`
            }`,
          pass: false,
        };
  },
});
