import type { MaskingOptions } from '@mask-cut/text-llm-core';

export type MaskingJob = {
  id: string;
  text: string;
  requestedAt: number;
  options?: MaskingOptions;
};

export type MaskingJobState = 'queued' | 'running' | 'succeeded' | 'failed';

export type MaskingErrorCode =
  | 'E_USAGE'
  | 'E_NETWORK'
  | 'E_TIMEOUT'
  | 'E_MASK_FAILED'
  | 'E_INTERNAL'
  | 'E_CANCELLED';

export type MaskingJobError = {
  code: MaskingErrorCode;
  message: string;
};

export type MaskingJobProcessorResult =
  | {
      status: 'succeeded';
      maskedText: string;
      model: string;
      endpoint: string;
      finishedAt: number;
    }
  | {
      status: 'failed';
      error: MaskingJobError;
    };

export type MaskingStatusEvent = {
  jobId: string;
  state: MaskingJobState;
  maskedText?: string;
  model?: string;
  endpoint?: string;
  message?: string;
  errorCode?: MaskingErrorCode;
  locked?: boolean;
};

export type MaskingStatusListener = (event: MaskingStatusEvent) => void;
