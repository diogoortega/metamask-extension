/**
 * Vitest equivalent of test/setup.js + the relevant parts of
 * test/helpers/setup-helper.js.
 *
 * Key differences from the Jest version:
 *  - No @babel/register / ts-node (Vitest handles transforms natively).
 *  - The jsdom-window block from setup-helper.js is OMITTED because
 *    Vitest already provides a full browser environment via happy-dom.
 *    Importing setup-helper.js wholesale would overwrite happy-dom's
 *    globals with a second JSDOM instance and fail on Node 24 where
 *    global.navigator is a built-in getter.
 *  - We replicate only the non-DOM parts that tests actually depend on.
 */

import 'fake-indexeddb/auto';
import nock from 'nock';
import log from 'loglevel';
import { URL as NodeURL, URLSearchParams as NodeURLSearchParams } from 'node:url';
import { default as nodeFetch, Headers, Request, Response } from 'node-fetch';

// ─── Environment markers ────────────────────────────────────────────────────

process.env.IN_TEST = 'true';
process.env.METAMASK_BUILD_TYPE = 'main';

// ─── Chrome extension stub ───────────────────────────────────────────────────

global.chrome = {
  runtime: {
    id: 'testid',
    getManifest: () => ({ manifest_version: 2 }),
    sendMessage: () => undefined,
    onMessage: { addListener: () => undefined },
  },
};

// ─── Sentry stub ─────────────────────────────────────────────────────────────

global.sentry = {
  captureException: () => undefined,
  captureFeedback: () => undefined,
  captureMessage: () => undefined,
  lastEventId: () => undefined,
};

// ─── Nock ────────────────────────────────────────────────────────────────────

nock.disableNetConnect();
nock.enableNetConnect('localhost');
beforeEach(() => {
  nock.cleanAll();
});

// ─── Unhandled-rejection tracking ────────────────────────────────────────────

const unhandledRejections = new Map<Promise<unknown>, unknown>();
let ignoreUnhandled = false;

process.on('unhandledRejection', (reason, promise) => {
  if (!ignoreUnhandled) {
    console.log(`Unhandled rejection: ..${process.env.IGNORE_UNHANDLED}`, reason);
    unhandledRejections.set(promise, reason);
  }
});
process.on('rejectionHandled', (promise) => {
  if (!ignoreUnhandled) {
    console.log(`handled: ${unhandledRejections.get(promise)}`);
    unhandledRejections.delete(promise);
  }
});
process.on('exit', () => {
  if (unhandledRejections.size > 0) {
    console.error(`Found ${unhandledRejections.size} unhandled rejections:`);
    for (const reason of unhandledRejections.values()) {
      console.error('Unhandled rejection: ', reason);
    }
    process.exit(1);
  }
});

process.resetIgnoreUnhandled = () => { ignoreUnhandled = false; };
process.setIgnoreUnhandled = (ignore: boolean) => { ignoreUnhandled = ignore; };

// ─── Logging ─────────────────────────────────────────────────────────────────

log.setDefaultLevel(5);
global.log = log;

// ─── Use Node.js native URL so modules using `new URL(path, import.meta.url)`
//     work correctly (happy-dom's URL rejects some valid relative paths).    ──

global.URL = NodeURL as unknown as typeof URL;
global.URLSearchParams = NodeURLSearchParams as unknown as typeof URLSearchParams;

// ─── Fetch ───────────────────────────────────────────────────────────────────

// node-fetch is used as the fetch polyfill (same as original setup-helper.js)
global.fetch = nodeFetch as unknown as typeof fetch;
if (typeof window !== 'undefined') {
  Object.assign(window, { fetch: nodeFetch, Headers, Request, Response });
}

// ─── setImmediate / clearImmediate (not provided by happy-dom) ───────────────

global.setImmediate =
  global.setImmediate ?? ((fn: (...args: unknown[]) => void, ...args: unknown[]) => global.setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate ?? ((id: ReturnType<typeof setTimeout>) => global.clearTimeout(id));

// ─── MetaMask extension globals ───────────────────────────────────────────────

global.platform = {
  openTab: () => undefined,
  getVersion: () => '<version>',
};

global.browser = {
  permissions: {
    request: vi.fn().mockResolvedValue(true),
  },
};

// ─── matchMedia stub (happy-dom implements it but some versions don't) ───────

if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => true,
  });
}

// ─── scrollIntoView stub ─────────────────────────────────────────────────────

if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = () => undefined;
}

// ─── prompt stub ─────────────────────────────────────────────────────────────

global.prompt = () => undefined;
