import test from 'node:test';
import assert from 'node:assert/strict';

import type { MaskingStatusEvent } from '../../masking/types';
import { createMaskingChannelHandlers } from '../maskingChannels';

type EnqueueCall = { text: string; options?: Record<string, unknown> };

type Listener = (event: MaskingStatusEvent) => void;

class FakeMaskingService {
  enqueueCalls: EnqueueCall[] = [];
  listeners = new Set<Listener>();

  async enqueue(text: string, options?: Record<string, unknown>) {
    this.enqueueCalls.push({ text, options });
    return { jobId: `job-${this.enqueueCalls.length}` };
  }

  onStatus(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: MaskingStatusEvent) {
    this.listeners.forEach((listener) => listener(event));
  }
}

test('masking:run handler validates payload and delegates to service', async () => {
  const service = new FakeMaskingService();
  const published: MaskingStatusEvent[] = [];
  const handlers = createMaskingChannelHandlers({
    maskingService: service as never,
    publishStatus: (event) => published.push(event),
  });

  const result = await handlers.run({}, { text: '  hello  ', options: { style: 'block' } });

  assert.equal(result.jobId, 'job-1');
  assert.deepEqual(service.enqueueCalls, [{ text: 'hello', options: { style: 'block' } }]);
  assert.equal(published.length, 0);

  await assert.rejects(() => handlers.run({}, { text: '   ' }), /text is required/);
});

test('masking status events are forwarded to publishStatus', async () => {
  const service = new FakeMaskingService();
  const published: MaskingStatusEvent[] = [];
  const handlers = createMaskingChannelHandlers({
    maskingService: service as never,
    publishStatus: (event) => published.push(event),
  });

  const event: MaskingStatusEvent = { jobId: 'job-x', state: 'running', locked: true };
  service.emit(event);
  assert.deepEqual(published, [event]);
});
