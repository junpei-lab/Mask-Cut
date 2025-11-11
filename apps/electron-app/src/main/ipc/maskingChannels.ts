import type { MaskingOptions } from '@mask-cut/text-llm-core';

import type { MaskingService } from '../masking/maskingService';
import type { MaskingStatusEvent } from '../masking/types';

export type MaskingChannelDeps = {
  maskingService: Pick<MaskingService, 'enqueue' | 'onStatus'>;
  publishStatus: (event: MaskingStatusEvent) => void;
};

export type MaskingRunPayload = {
  text: string;
  options?: MaskingOptions;
};

export function createMaskingChannelHandlers(deps: MaskingChannelDeps) {
  const unsubscribe = deps.maskingService.onStatus((event) => {
    deps.publishStatus(event);
  });

  const sanitizeText = (payload?: MaskingRunPayload): string => {
    const normalized = (payload?.text ?? '').trim();
    if (!normalized) {
      throw new Error('text is required');
    }
    return normalized;
  };

  return {
    dispose: () => unsubscribe(),
    run: async (_event: unknown, payload: MaskingRunPayload) => {
      const text = sanitizeText(payload);
      return deps.maskingService.enqueue(text, payload?.options);
    },
  };
}
