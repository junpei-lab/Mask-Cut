import { ConfigStore } from './configStore.js';
import type { CredentialVault } from './credentialVault.js';
import type {
  CliConfig,
  ProfileSummary,
  ResolvedProfile,
  UpsertProfileInput,
} from './types.js';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ConfigService {
  private readonly store: ConfigStore;

  private readonly vault: CredentialVault;

  private cache?: CliConfig;

  constructor(store: ConfigStore, vault: CredentialVault) {
    this.store = store;
    this.vault = vault;
  }

  async initialize(): Promise<void> {
    await this.store.ensureInitialized();
  }

  async ensureConfigFile(): Promise<{ created: boolean; path: string }> {
    const created = await this.store.ensureInitialized();
    return { created, path: this.store.getPath() };
  }

  async getProfile(name?: string): Promise<ResolvedProfile> {
    const config = await this.loadConfig();
    const profileName = name ?? config.defaultProfile;
    const profile = config.profiles[profileName];

    if (!profile) {
      throw new ConfigError(`profile '${profileName}' does not exist`);
    }

    const apiKey = profile.vaultKeyId
      ? await this.vault.get(profile.vaultKeyId)
      : undefined;

    return {
      name: profileName,
      endpoint: profile.endpoint,
      model: profile.model,
      logFile: profile.logFile,
      vaultKeyId: profile.vaultKeyId,
      apiKey,
    };
  }

  async upsertProfile(name: string, input: UpsertProfileInput): Promise<void> {
    const config = await this.loadConfig();
    config.profiles[name] = {
      endpoint: input.endpoint,
      model: input.model,
      logFile: input.logFile,
      vaultKeyId: input.vaultKeyId,
      updatedAt: new Date().toISOString(),
    };

    if (input.apiKey) {
      const vaultKey = input.vaultKeyId ?? `profile:${name}`;
      await this.vault.store(vaultKey, input.apiKey);
      config.profiles[name].vaultKeyId = vaultKey;
    }

    if (!config.defaultProfile) {
      config.defaultProfile = name;
    }

    await this.persist(config);
  }

  async setDefaultProfile(name: string): Promise<void> {
    const config = await this.loadConfig();
    if (!config.profiles[name]) {
      throw new ConfigError(`profile '${name}' does not exist`);
    }

    config.defaultProfile = name;
    await this.persist(config);
  }

  async listProfiles(): Promise<ProfileSummary[]> {
    const config = await this.loadConfig();
    return Object.entries(config.profiles).map(([name, profile]) => ({
      name,
      endpoint: profile.endpoint,
      model: profile.model,
      updatedAt: profile.updatedAt,
      isDefault: name === config.defaultProfile,
    }));
  }

  private async loadConfig(): Promise<CliConfig> {
    if (!this.cache) {
      this.cache = await this.store.load();
    }
    return this.cache;
  }

  private async persist(config: CliConfig): Promise<void> {
    this.cache = config;
    await this.store.save(config);
  }
}
