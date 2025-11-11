import test from 'node:test';
import assert from 'node:assert/strict';

import type { LLMClient } from '@mask-cut/text-llm-core';

import { MaskingCache } from '../maskingCache';
import { MaskingService } from '../maskingService';
import type { MaskingCacheStore } from '../maskingCacheStore';
import type { MaskingResultSnapshot } from '../maskingCache';
import type { MaskingStatusEvent } from '../types';

class FakeStore implements MaskingCacheStore {
  private state: { lastInput?: string; lastResult?: MaskingResultSnapshot } | null = null;

  async read() {
    return this.state ? { ...this.state } : null;
  }

  async write(next: { lastInput?: string; lastResult?: MaskingResultSnapshot } | null) {
    this.state = next ? { ...next } : null;
  }
}

const createService = (options: {
  maskImpl: (llm: LLMClient, text: string) => Promise<{ maskedText: string; originalText: string }>;
  settings?: {
    endpointUrl: string;
    modelName: string;
    apiKey?: string;
    endpointLabel?: string;
    timeoutMs?: number;
  };
  idFactory?: () => string;
}) => {
  const store = new FakeStore();
  const cache = new MaskingCache({ store });
  const settings =
    options.settings ??
    ({
      endpointUrl: 'https://api.example.com',
      modelName: 'gpt-4',
      apiKey: 'secret',
      endpointLabel: 'primary',
      timeoutMs: 30_000,
    } as const);

  const service = new MaskingService({
    cache,
    settingsProvider: {
      async getResolvedSettings() {
        return settings;
      },
    },
    llmFactory: (resolved) => ({
      complete: async () => ({ text: 'LLM result', raw: { resolved } }),
    }),
    maskSensitiveInfo: options.maskImpl,
    idFactory: options.idFactory,
  });

  return { service, cache };
};

const collectEvents = (service: MaskingService) => {
  const events: MaskingStatusEvent[] = [];
  service.onStatus((event) => events.push(event));
  return events;
};

test('MaskingService emits queued/running/succeeded events and stores snapshots', async () => {
  const maskCalls: string[] = [];
  const { service, cache } = createService({
    maskImpl: async (_llm, text) => {
      maskCalls.push(text);
      return { maskedText: '<<masked>>', originalText: text };
    },
    idFactory: () => 'job-success',
  });

  const events = collectEvents(service);
  await service.enqueue('hello world');
  await service.waitForIdle();

  assert.deepEqual(maskCalls, ['hello world']);
  assert.deepEqual(
    events.map((event) => [event.jobId, event.state]),
    [
      ['job-success', 'queued'],
      ['job-success', 'running'],
      ['job-success', 'succeeded'],
    ],
  );
  assert.equal(events.at(-1)?.maskedText, '<<masked>>');
  assert.equal(events.at(-1)?.model, 'gpt-4');
  assert.equal(events.at(-1)?.endpoint, 'primary');

  const snapshot = await cache.getLastResult();
  assert.equal(snapshot?.maskedText, '<<masked>>');
  assert.equal(snapshot?.model, 'gpt-4');
});

test('MaskingService maps network errors to failure events', async () => {
  const { service } = createService({
    maskImpl: async () => {
      const error = new Error('network down');
      (error as NodeJS.ErrnoException).code = 'ECONNRESET';
      throw error;
    },
    idFactory: () => 'job-fail',
  });

  const events = collectEvents(service);
  await service.enqueue('text');
  await service.waitForIdle();

  const failure = events.at(-1);
  assert.equal(failure?.state, 'failed');
  assert.equal(failure?.errorCode, 'E_NETWORK');
});

test('MaskingService exposes lock status while running', async () => {
  let release: (() => void) | undefined;
  const { service } = createService({
    maskImpl: async (_llm, text) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return { maskedText: text, originalText: text };
    },
  });

  await service.enqueue('long job');
  assert.equal(service.isLocked(), true);

  release?.();
  await service.waitForIdle();
  assert.equal(service.isLocked(), false);
});
