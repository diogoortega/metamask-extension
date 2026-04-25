import 'fake-indexeddb/auto';
import {
  URL as NodeURL,
  URLSearchParams as NodeURLSearchParams,
} from 'node:url';
import nock from 'nock';
import log from 'loglevel';
import nodeFetch, {
  Headers as NodeHeaders,
  Request as NodeRequest,
  Response as NodeResponse,
} from 'node-fetch';

process.env.IN_TEST = 'true';
process.env.METAMASK_BUILD_TYPE = 'main';

global.chrome = {
  runtime: {
    id: 'testid',
    // eslint-disable-next-line @typescript-eslint/naming-convention
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
    console.log(
      `Unhandled rejection: ..${process.env.IGNORE_UNHANDLED}`,
      reason,
    );
    unhandledRejections.set(promise, reason);
  }
});
process.on('rejectionHandled', (promise) => {
  if (!ignoreUnhandled) {
    console.log(`handled: ${String(unhandledRejections.get(promise))}`);
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

process.resetIgnoreUnhandled = () => {
  ignoreUnhandled = false;
};
process.setIgnoreUnhandled = (ignore: boolean) => {
  ignoreUnhandled = ignore;
};

log.setDefaultLevel(5);
global.log = log;

global.URL = NodeURL as unknown as typeof global.URL;
global.URLSearchParams =
  NodeURLSearchParams as unknown as typeof global.URLSearchParams;

global.fetch = nodeFetch as unknown as typeof fetch;
if (typeof window !== 'undefined') {
  Object.assign(window, {
    fetch: nodeFetch,
    Headers: NodeHeaders,
    Request: NodeRequest,
    Response: NodeResponse,
  });
}

global.setImmediate =
  global.setImmediate ??
  ((fn: (...args: unknown[]) => void, ...args: unknown[]) =>
    global.setTimeout(fn, 0, ...args));
global.clearImmediate =
  global.clearImmediate ??
  ((id: ReturnType<typeof setTimeout>) => global.clearTimeout(id));

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
