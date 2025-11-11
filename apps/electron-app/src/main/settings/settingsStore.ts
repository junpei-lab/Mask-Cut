import { promises as fs } from 'node:fs';
import path from 'node:path';

import { app } from 'electron';

import type { AppSettingsRecord } from './types';

export interface SettingsStoreBackend {
  read(): Promise<AppSettingsRecord | null>;
  write(record: AppSettingsRecord): Promise<void>;
}

export class JsonFileSettingsStore implements SettingsStoreBackend {
  private readonly filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(app.getPath('userData'), 'settings.json');
  }

  async read(): Promise<AppSettingsRecord | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as AppSettingsRecord;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async write(record: AppSettingsRecord): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(record, null, 2), 'utf-8');
  }
}

export class SettingsRepository {
  constructor(private readonly store: SettingsStoreBackend = new JsonFileSettingsStore()) {}

  async load(): Promise<AppSettingsRecord | null> {
    return this.store.read();
  }

  async save(record: AppSettingsRecord): Promise<void> {
    await this.store.write(record);
  }
}
