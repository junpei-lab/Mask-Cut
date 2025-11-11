import test from 'node:test';
import assert from 'node:assert/strict';

import { MaskingCache, type MaskingResultSnapshot } from '../maskingCache';
import type { MaskingCacheStore, MaskingCacheState } from '../maskingCacheStore';

class FakeStore implements MaskingCacheStore {
  private state: MaskingCacheState | null = null;

  async read(): Promise<MaskingCacheState | null> {
    return this.state ? { ...this.state } : null;
  }

  async write(next: MaskingCacheState): Promise<void> {
    this.state = { ...next };
  }
}

test('MaskingCache remembers last input text', async () => {
  const store = new FakeStore();
  const cache = new MaskingCache({ store });

  await cache.rememberInput('  hello world  ');

  assert.equal(await cache.getLastInput(), 'hello world');
});

test('MaskingCache persists last result snapshot', async () => {
  const store = new FakeStore();
  const cache = new MaskingCache({ store });

  const snapshot: MaskingResultSnapshot = {
    inputText: 'original',
    maskedText: 'masked',
    model: 'gpt-4',
    endpoint: 'primary',
    finishedAt: 1700000000000,
  };

  await cache.rememberResult(snapshot);

  const reloaded = new MaskingCache({ store });
  assert.deepEqual(await reloaded.getLastResult(), snapshot);
});

test('MaskingCache clear removes stored data', async () => {
  const store = new FakeStore();
  const cache = new MaskingCache({ store });

  await cache.rememberInput('text');
  await cache.clear();

  assert.equal(await cache.getLastInput(), null);
  assert.equal(await cache.getLastResult(), null);
});
