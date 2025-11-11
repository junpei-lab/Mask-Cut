import { randomUUID } from 'node:crypto';

import { OpenAICompatibleClient, maskSensitiveInfo, type LLMClient, type MaskingOptions } from '@mask-cut/text-llm-core';

import { MaskingCache, type MaskingResultSnapshot } from './maskingCache';
import { MaskingJobQueue } from './maskingJobQueue';
import type {
  MaskingJob,
  MaskingJobError,
  MaskingJobProcessorResult,
  MaskingStatusListener,
} from './types';

const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ECONNRESET',
]);

type MaskingServiceDeps = {
  cache: MaskingCache;
  settingsProvider: MaskingSettingsProvider;
  maskSensitiveInfo?: typeof maskSensitiveInfo;
  llmFactory?: (settings: ResolvedMaskingSettings) => LLMClient;
  idFactory?: () => string;
};

export type ResolvedMaskingSettings = {
  endpointUrl: string;
  modelName: string;
  apiKey?: string;
  endpointLabel?: string;
  timeoutMs?: number;
};

export interface MaskingSettingsProvider {
  getResolvedSettings(): Promise<ResolvedMaskingSettings>;
}

const defaultIdFactory = () => randomUUID();

function buildEndpointLabel(settings: ResolvedMaskingSettings): string {
  if (settings.endpointLabel) {
    return settings.endpointLabel;
  }
  try {
    const url = new URL(settings.endpointUrl);
    return url.hostname || settings.endpointUrl;
  } catch {
    return settings.endpointUrl;
  }
}

export class MaskingService {
  private readonly queue: MaskingJobQueue;

  private readonly cache: MaskingCache;

  private readonly settingsProvider: MaskingSettingsProvider;

  private readonly maskFn: typeof maskSensitiveInfo;

  private readonly llmFactory: (settings: ResolvedMaskingSettings) => LLMClient;

  private readonly idFactory: () => string;

  constructor(deps: MaskingServiceDeps) {
    this.cache = deps.cache;
    this.settingsProvider = deps.settingsProvider;
    this.maskFn = deps.maskSensitiveInfo ?? maskSensitiveInfo;
    this.llmFactory =
      deps.llmFactory ??
      ((settings) => new OpenAICompatibleClient(settings.endpointUrl, settings.apiKey, settings.modelName));
    this.idFactory = deps.idFactory ?? defaultIdFactory;
    this.queue = new MaskingJobQueue((job) => this.executeJob(job));
  }

  async enqueue(text: string, options?: MaskingOptions): Promise<{ jobId: string }> {
    const normalized = this.normalizeText(text);
    await this.cache.rememberInput(normalized);
    const job: MaskingJob = {
      id: this.idFactory(),
      text: normalized,
      requestedAt: Date.now(),
      options,
    };
    void this.queue.enqueue(job);
    return { jobId: job.id };
  }

  onStatus(listener: MaskingStatusListener): () => void {
    return this.queue.onStatus(listener);
  }

  isLocked(): boolean {
    return this.queue.isLocked();
  }

  waitForIdle(): Promise<void> {
    return this.queue.waitForIdle();
  }

  private normalizeText(text: string): string {
    const normalized = (text ?? '').trim();
    if (!normalized) {
      throw new Error('text is required');
    }
    return normalized;
  }

  private async executeJob(job: MaskingJob): Promise<MaskingJobProcessorResult> {
    try {
      const settings = await this.settingsProvider.getResolvedSettings();
      const client = this.llmFactory(settings);
      const result = await this.maskFn(client, job.text, job.options);
      const snapshot: MaskingResultSnapshot = {
        inputText: job.text,
        maskedText: result.maskedText,
        model: settings.modelName,
        endpoint: buildEndpointLabel(settings),
        finishedAt: Date.now(),
      };
      await this.cache.rememberResult(snapshot);
      return {
        status: 'succeeded',
        maskedText: snapshot.maskedText,
        model: snapshot.model,
        endpoint: snapshot.endpoint,
        finishedAt: snapshot.finishedAt,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: this.mapError(error),
      };
    }
  }

  private mapError(error: unknown): MaskingJobError {
    const err = error instanceof Error ? error : new Error('Unknown error');
    const codeFromError = (error as NodeJS.ErrnoException)?.code;

    if (codeFromError && NETWORK_ERROR_CODES.has(codeFromError)) {
      return { code: 'E_NETWORK', message: err.message };
    }

    if (codeFromError === 'ETIMEDOUT') {
      return { code: 'E_TIMEOUT', message: err.message };
    }

    if (err.name === 'AbortError' || /timeout/i.test(err.message)) {
      return { code: 'E_TIMEOUT', message: err.message };
    }

    if (/invalid|required|missing/i.test(err.message)) {
      return { code: 'E_USAGE', message: err.message };
    }

    if (/LLM request failed/i.test(err.message)) {
      return { code: 'E_MASK_FAILED', message: err.message };
    }

    return { code: 'E_INTERNAL', message: err.message };
  }
}
