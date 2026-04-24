import 'fake-indexeddb/auto';
import nock from 'nock';
import log from 'loglevel';
import { URL, URLSearchParams } from 'node:url';
import nodeFetch, { Headers, Request, Response } from 'node-fetch';

process.env.IN_TEST = 'true';
process.env.METAMASK_BUILD_TYPE = 'main';

global.chrome = {
  runtime: {
    id: 'testid',
    getManifest: () => ({ manifest_version: 2 }),
    sendMessage: () => undefined,
    onMessage: { addListener: () => undefined },
  },
};

global.sentry = {
  captureException: () => undefined,
  captureFeedback: () => undefined,
  captureMessage: () => undefined,
  lastEventId: () => undefined,
};

nock.disableNetConnect();
nock.enableNetConnect('localhost');
beforeEach(() => nock.cleanAll());

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

log.setDefaultLevel(5);
global.log = log;

global.URL = URL as unknown as typeof global.URL;
global.URLSearchParams = URLSearchParams as unknown as typeof global.URLSearchParams;

global.fetch = nodeFetch as unknown as typeof fetch;
if (typeof window !== 'undefined') {
  Object.assign(window, { fetch: nodeFetch, Headers, Request, Response });
}

global.setImmediate =
  global.setImmediate ?? ((fn: (...args: unknown[]) => void, ...args: unknown[]) => global.setTimeout(fn, 0, ...args));
global.clearImmediate = global.clearImmediate ?? ((id: ReturnType<typeof setTimeout>) => global.clearTimeout(id));

global.platform = {
  openTab: () => undefined,
  getVersion: () => '<version>',
};

global.browser = {
  permissions: {
    request: vi.fn().mockResolvedValue(true),
  },
};

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

if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = () => undefined;
}
