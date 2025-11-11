export type AppSettingsRecord = {
  endpointUrl: string;
  modelName: string;
  vaultKeyId: string;
  timeoutMs: number;
  lastUpdatedAt: string;
};

export type AppSettingsInput = {
  endpointUrl: string;
  modelName: string;
  vaultKeyId: string;
  timeoutMs?: number;
  apiKey?: string;
};

export type SettingsValidationErrors = Partial<Record<'endpointUrl' | 'modelName' | 'vaultKeyId' | 'timeoutMs', string>>;

export type SettingsSaveSuccess = {
  ok: true;
  settings: AppSettingsRecord;
};

export type SettingsSaveFailure = {
  ok: false;
  validationErrors?: SettingsValidationErrors;
  connectivityError?: string;
};

export type SettingsSaveResult = SettingsSaveSuccess | SettingsSaveFailure;
