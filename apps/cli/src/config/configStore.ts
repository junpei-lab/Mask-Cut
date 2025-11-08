import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { CliConfig } from './types.js';

const DEFAULT_CONFIG: CliConfig = {
  schemaVersion: 1,
  defaultProfile: 'default',
  profiles: {
    default: {
      endpoint: '',
      model: 'llama3',
      updatedAt: new Date(0).toISOString(),
    },
  },
  log: {
    append: true,
  },
};

export class ConfigStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  getPath(): string {
    return this.filePath;
  }

  async ensureInitialized(): Promise<boolean> {
    try {
      await access(this.filePath);
      return false;
    } catch {
      const seed = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as CliConfig;
      await this.save(seed);
      return true;
    }
  }

  async load(): Promise<CliConfig> {
    const content = await readFile(this.filePath, 'utf-8');
    const parsed = JSON.parse(content) as CliConfig;
    return parsed;
  }

  async save(config: CliConfig): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(config, null, 2), 'utf-8');
  }
}
