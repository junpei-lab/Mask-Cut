import process from 'node:process';

export interface CredentialVault {
  store(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
  delete(key: string): Promise<void>;
}

const importDynamic = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<any>;

interface KeytarModule {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
}

class KeytarVault implements CredentialVault {
  private readonly serviceName: string;

  private keytar?: KeytarModule;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  private async ensureKeytar(): Promise<KeytarModule> {
    if (this.keytar) {
      return this.keytar;
    }

    const module = await importDynamic('keytar');
    this.keytar = module.default ?? module;

    if (!this.keytar) {
      throw new Error('keytar module not available');
    }

    return this.keytar;
  }

  async store(key: string, value: string): Promise<void> {
    const keytar = await this.ensureKeytar();
    await keytar.setPassword(this.serviceName, key, value);
  }

  async get(key: string): Promise<string | undefined> {
    const keytar = await this.ensureKeytar();
    const value = await keytar.getPassword(this.serviceName, key);
    return value ?? undefined;
  }

  async delete(key: string): Promise<void> {
    const keytar = await this.ensureKeytar();
    await keytar.deletePassword(this.serviceName, key);
  }
}

export class InMemoryVault implements CredentialVault {
  private readonly data = new Map<string, string>();

  async store(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async get(key: string): Promise<string | undefined> {
    return this.data.get(key);
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export function createCredentialVault(): CredentialVault {
  const serviceName = process.env.MASK_CUT_VAULT_SERVICE ?? 'mask-cut-cli';
  return new KeytarVault(serviceName);
}
