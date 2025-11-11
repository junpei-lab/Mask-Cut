export interface SecretStore {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
}

type KeytarModule = {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
};

async function importKeytar(): Promise<KeytarModule | null> {
  try {
    const mod = (await import('keytar')) as { default?: KeytarModule } & KeytarModule;
    return mod.default ?? (mod as KeytarModule);
  } catch (error) {
    console.warn('keytar module not available, falling back to in-memory secret store', error);
    return null;
  }
}

export class SecureStoreAdapter implements SecretStore {
  private keytarPromise: Promise<KeytarModule | null> | null = null;

  private readonly fallbackStore = new Map<string, string>();

  constructor(private readonly serviceName = 'mask-cut-electron') {}

  private ensureKeytar(): Promise<KeytarModule | null> {
    if (!this.keytarPromise) {
      this.keytarPromise = importKeytar();
    }
    return this.keytarPromise;
  }

  async getSecret(key: string): Promise<string | null> {
    const keytar = await this.ensureKeytar();
    if (!keytar) {
      return this.fallbackStore.get(key) ?? null;
    }
    return keytar.getPassword(this.serviceName, key);
  }

  async setSecret(key: string, value: string): Promise<void> {
    const keytar = await this.ensureKeytar();
    if (!keytar) {
      this.fallbackStore.set(key, value);
      return;
    }
    await keytar.setPassword(this.serviceName, key, value);
  }
}
