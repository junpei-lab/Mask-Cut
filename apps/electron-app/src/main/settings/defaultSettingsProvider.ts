import type { MaskingSettingsProvider, ResolvedMaskingSettings } from '../masking/maskingService';

function parseTimeout(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return undefined;
}

export class DefaultMaskingSettingsProvider implements MaskingSettingsProvider {
  async getResolvedSettings(): Promise<ResolvedMaskingSettings> {
    return {
      endpointUrl: process.env.MASK_CUT_ENDPOINT_URL ?? 'http://localhost:1234/v1',
      modelName: process.env.MASK_CUT_MODEL_NAME ?? 'gpt-4o-mini',
      apiKey: process.env.MASK_CUT_API_KEY,
      endpointLabel: process.env.MASK_CUT_ENDPOINT_LABEL ?? 'local-default',
      timeoutMs: parseTimeout(process.env.MASK_CUT_TIMEOUT_MS) ?? 60_000,
    };
  }
}
