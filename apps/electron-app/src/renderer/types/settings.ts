export type SettingsViewModel = {
  endpointUrl: string;
  modelName: string;
  vaultKeyId: string;
  timeoutMs: number;
  lastUpdatedAt: string;
};

export type SettingsSaveResult =
  | { ok: true; settings: SettingsViewModel }
  | { ok: false; validationErrors?: Record<string, string>; connectivityError?: string };
