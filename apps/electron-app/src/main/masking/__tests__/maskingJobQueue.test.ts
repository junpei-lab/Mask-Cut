import test from 'node:test';
import assert from 'node:assert/strict';

import { MaskingJobQueue } from '../maskingJobQueue';
import type { MaskingJob, MaskingStatusEvent } from '../types';

const delay = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test('MaskingJobQueue runs jobs sequentially and emits lifecycle events', async () => {
  const processed: string[] = [];
  const queue = new MaskingJobQueue(async (job) => {
    processed.push(job.text);
    await delay();
    return {
      status: 'succeeded',
      maskedText: job.text.toUpperCase(),
      model: 'mock-model',
      endpoint: 'primary',
      finishedAt: Date.now(),
    };
  });

  const events: MaskingStatusEvent[] = [];
  queue.onStatus((event) => events.push(event));

  const now = Date.now();
  const jobA: MaskingJob = { id: 'job-a', text: 'alpha', requestedAt: now };
  const jobB: MaskingJob = { id: 'job-b', text: 'beta', requestedAt: now + 1 };

  const [resultA, resultB] = await Promise.all([
    queue.enqueue(jobA),
    queue.enqueue(jobB),
  ]);

  await queue.waitForIdle();

  assert.deepEqual(processed, ['alpha', 'beta']);
  assert.equal(resultA.status, 'succeeded');
  assert.equal(resultB.status, 'succeeded');

  assert.deepEqual(
    events.map((event) => [event.jobId, event.state]),
    [
      ['job-a', 'queued'],
      ['job-a', 'running'],
      ['job-b', 'queued'],
      ['job-a', 'succeeded'],
      ['job-b', 'running'],
      ['job-b', 'succeeded'],
    ],
  );
  assert.equal(queue.isLocked(), false);
});

test('MaskingJobQueue cancel prevents pending jobs from executing', async () => {
  const executed: string[] = [];
  const queue = new MaskingJobQueue(async (job) => {
    executed.push(job.id);
    await delay();
    return {
      status: 'succeeded',
      maskedText: job.text,
      model: 'mock-model',
      endpoint: 'primary',
      finishedAt: Date.now(),
    };
  });

  const events: MaskingStatusEvent[] = [];
  queue.onStatus((event) => events.push(event));

  const runningPromise = queue.enqueue({ id: 'job-1', text: 'first', requestedAt: Date.now() });
  const cancelledPromise = queue.enqueue({ id: 'job-2', text: 'second', requestedAt: Date.now() + 1 });

  assert.equal(queue.cancel('job-2'), true);

  const [firstResult, cancelledResult] = await Promise.all([
    runningPromise,
    cancelledPromise,
  ]);

  await queue.waitForIdle();

  assert.deepEqual(executed, ['job-1']);
  assert.equal(firstResult.status, 'succeeded');
  assert.equal(cancelledResult.status, 'failed');
  assert.equal(cancelledResult.error?.code, 'E_CANCELLED');

  const job2States = events
    .filter((event) => event.jobId === 'job-2')
    .map((event) => event.state);
  assert.deepEqual(job2States, ['queued', 'failed']);
});
