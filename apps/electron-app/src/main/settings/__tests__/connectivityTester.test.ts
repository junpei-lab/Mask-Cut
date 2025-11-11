import test from 'node:test';
import assert from 'node:assert/strict';

import { FetchConnectivityTester } from '../connectivityTester';

type FetchCall = { url: string; method?: string };

function mockResponse(ok: boolean, status = 200): Response {
  return {
    ok,
    status,
    text: async () => '',
    json: async () => ({}),
  } as Response;
}

test('connectivity tester hits /models path for OpenAI compatible endpoints', async () => {
  const tester = new FetchConnectivityTester();
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), method: init?.method });
    return mockResponse(true, 200);
  }) as typeof fetch;

  try {
    await tester.test({ endpointUrl: 'http://localhost:1234/v1', modelName: 'masking' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'http://localhost:1234/v1/models');
  assert.equal(calls[0]?.method, 'GET');
});

test('connectivity tester falls back to base HEAD request when /models fails', async () => {
  const tester = new FetchConnectivityTester();
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;
  let attempt = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), method: init?.method });
    attempt += 1;
    if (attempt === 1) {
      return mockResponse(false, 404);
    }
    return mockResponse(true, 200);
  }) as typeof fetch;

  try {
    await tester.test({ endpointUrl: 'https://api.example.com/v1', modelName: 'masking' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, 'https://api.example.com/v1/models');
  assert.equal(calls[0]?.method, 'GET');
  assert.equal(calls[1]?.url, 'https://api.example.com/v1');
  assert.equal(calls[1]?.method, 'HEAD');
});

test('connectivity tester avoids duplicating /models suffix', async () => {
  const tester = new FetchConnectivityTester();
  const calls: FetchCall[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: typeof input === 'string' ? input : input.toString(), method: init?.method });
    return mockResponse(true, 200);
  }) as typeof fetch;

  try {
    await tester.test({ endpointUrl: 'https://api.example.com/v1/models', modelName: 'masking' });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, 'https://api.example.com/v1/models');
});

test('connectivity tester wraps low-level fetch failures with friendly message', async () => {
  const tester = new FetchConnectivityTester();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async () => {
    throw new TypeError('fetch failed');
  }) as typeof fetch;

  try {
    await assert.rejects(
      tester.test({ endpointUrl: 'http://localhost:1234/v1', modelName: 'masking' }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /接続テストに失敗しました \(fetch failed\)/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
