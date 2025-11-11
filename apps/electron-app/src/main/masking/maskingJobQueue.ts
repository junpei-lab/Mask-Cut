import { EventEmitter } from 'node:events';

import type {
  MaskingJob,
  MaskingJobProcessorResult,
  MaskingStatusEvent,
  MaskingStatusListener,
} from './types';

export type MaskingJobProcessor = (job: MaskingJob) => Promise<MaskingJobProcessorResult>;

type QueuedJob = {
  job: MaskingJob;
  resolve: (result: MaskingJobProcessorResult) => void;
  cancelled?: boolean;
};

export class MaskingJobQueue {
  private readonly emitter = new EventEmitter();

  private readonly pending: QueuedJob[] = [];

  private running = false;

  private idlePromise: Promise<void> | null = null;

  private idleResolver: (() => void) | null = null;

  constructor(private readonly processor: MaskingJobProcessor) {}

  enqueue(job: MaskingJob): Promise<MaskingJobProcessorResult> {
    return new Promise<MaskingJobProcessorResult>((resolve) => {
      const entry: QueuedJob = { job, resolve };
      this.pending.push(entry);
      this.emitStatus({ jobId: job.id, state: 'queued' });
      this.processNext();
    });
  }

  cancel(jobId: string): boolean {
    const entryIndex = this.pending.findIndex((entry) => entry.job.id === jobId);
    if (entryIndex === -1) {
      return false;
    }

    const [entry] = this.pending.splice(entryIndex, 1);
    entry.cancelled = true;
    const result: MaskingJobProcessorResult = {
      status: 'failed',
      error: {
        code: 'E_CANCELLED',
        message: 'Job was cancelled before execution.',
      },
    };
    entry.resolve(result);
    this.emitStatus({
      jobId,
      state: 'failed',
      errorCode: result.error.code,
      message: result.error.message,
    });
    this.resolveIdleIfNeeded();
    return true;
  }

  onStatus(listener: MaskingStatusListener): () => void {
    this.emitter.on('status', listener);
    return () => {
      this.emitter.off('status', listener);
    };
  }

  isLocked(): boolean {
    return this.running || this.pending.length > 0;
  }

  async waitForIdle(): Promise<void> {
    if (!this.isLocked()) {
      return;
    }
    if (!this.idlePromise) {
      this.idlePromise = new Promise<void>((resolve) => {
        this.idleResolver = resolve;
      });
    }
    return this.idlePromise;
  }

  private emitStatus(event: MaskingStatusEvent): void {
    this.emitter.emit('status', { ...event, locked: this.isLocked() });
  }

  private async processNext(): Promise<void> {
    if (this.running) {
      return;
    }

    const entry = this.pending.shift();
    if (!entry) {
      this.resolveIdleIfNeeded();
      return;
    }

    if (entry.cancelled) {
      entry.resolve({
        status: 'failed',
        error: { code: 'E_CANCELLED', message: 'Job was cancelled before execution.' },
      });
      this.processNext();
      return;
    }

    this.running = true;
    this.emitStatus({ jobId: entry.job.id, state: 'running' });

    let result: MaskingJobProcessorResult;
    try {
      result = await this.processor(entry.job);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown job failure');
      result = {
        status: 'failed',
        error: {
          code: 'E_INTERNAL',
          message: err.message,
        },
      };
    }

    this.running = false;

    if (result.status === 'succeeded') {
      this.emitStatus({
        jobId: entry.job.id,
        state: 'succeeded',
        maskedText: result.maskedText,
        model: result.model,
        endpoint: result.endpoint,
      });
    } else {
      this.emitStatus({
        jobId: entry.job.id,
        state: 'failed',
        errorCode: result.error.code,
        message: result.error.message,
      });
    }

    entry.resolve(result);
    this.processNext();
  }

  private resolveIdleIfNeeded(): void {
    if (!this.isLocked() && this.idleResolver) {
      this.idleResolver();
      this.idleResolver = null;
      this.idlePromise = null;
    }
  }
}
