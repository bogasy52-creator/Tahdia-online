import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const workerPath = new URL('../public/service-worker.js', import.meta.url);

async function bootWorker({ fetchImpl, cacheMatch }) {
  const source = await readFile(workerPath, 'utf8');
  const listeners = new Map();
  const self = {
    location: { origin: 'https://game.test' },
    clients: { claim() {} },
    skipWaiting() {},
    addEventListener(type, listener) { listeners.set(type, listener); },
  };
  const caches = {
    match: cacheMatch,
    keys: async () => [],
    delete: async () => true,
    open: async () => ({ addAll: async () => {}, match: async () => null, put: async () => {} }),
  };
  vm.runInNewContext(source, { self, caches, fetch: fetchImpl, URL, Response, Promise, Set });
  return listeners.get('fetch');
}

async function dispatchNavigation(handler, pathname) {
  let responsePromise;
  handler({
    request: { method: 'GET', mode: 'navigate', url: `https://game.test${pathname}` },
    respondWith(value) { responsePromise = Promise.resolve(value); },
  });
  assert.ok(responsePromise, 'service worker must respond to same-origin navigation');
  return responsePromise;
}

test('a static-host 404 retries the concrete HTML document', async () => {
  const calls = [];
  const handler = await bootWorker({
    cacheMatch: async () => null,
    fetchImpl: async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      calls.push(url);
      return url.includes('/matchmaking.html')
        ? new Response('<main>matchmaking</main>', { status: 200 })
        : new Response('', { status: 404 });
    },
  });
  const response = await dispatchNavigation(handler, '/matchmaking?game=quiz');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /matchmaking/);
  assert.deepEqual(calls, [
    'https://game.test/matchmaking?game=quiz',
    'https://game.test/matchmaking.html?game=quiz',
  ]);
});

test('an unknown navigation receives a visible recovery page instead of a blank response', async () => {
  const handler = await bootWorker({
    fetchImpl: async () => new Response('', { status: 404 }),
    cacheMatch: async (input) => input === '/navigation-error.html'
      ? new Response('<main>تعذر فتح الصفحة</main>', { status: 200 })
      : null,
  });
  const response = await dispatchNavigation(handler, '/missing-player-route');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /تعذر فتح الصفحة/);
});

test('legacy HTML match destinations stay browser-managed so canonical redirects cannot fail inside the service worker', async () => {
  const handler = await bootWorker({
    fetchImpl: async () => new Response('', { status: 200 }),
    cacheMatch: async () => null,
  });
  for (const pathname of ['/online.html?bot=1', '/snakes.html?room=ABCD']) {
    let intercepted = false;
    handler({
      request: { method: 'GET', mode: 'navigate', url: `https://game.test${pathname}` },
      respondWith() { intercepted = true; },
    });
    assert.equal(intercepted, false, `${pathname} must be handled by the browser`);
  }
});
