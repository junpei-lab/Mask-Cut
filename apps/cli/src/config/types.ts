export interface ProfileConfig {
  endpoint: string;
  model: string;
  logFile?: string;
  vaultKeyId?: string;
  updatedAt: string;
}

export interface LogSettings {
  defaultLogFile?: string;
  append: boolean;
}

export interface CliConfig {
  schemaVersion: number;
  defaultProfile: string;
  profiles: Record<string, ProfileConfig>;
  log: LogSettings;
}

export interface ProfileSummary {
  name: string;
  endpoint: string;
  model: string;
  updatedAt: string;
  isDefault: boolean;
}

export interface UpsertProfileInput {
  endpoint: string;
  model: string;
  logFile?: string;
  vaultKeyId?: string;
  apiKey?: string;
}

export interface ResolvedProfile {
  name: string;
  endpoint: string;
  model: string;
  logFile?: string;
  vaultKeyId?: string;
  apiKey?: string;
}
