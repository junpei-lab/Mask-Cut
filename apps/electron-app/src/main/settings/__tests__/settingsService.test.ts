import test from 'node:test';
import assert from 'node:assert/strict';

import type { ConnectivityTester } from '../connectivityTester';
import { SettingsRepository } from '../settingsStore';
import type { SettingsStoreBackend } from '../settingsStore';
import { SettingsService } from '../settingsService';
import type { SecretStore } from '../secureStoreAdapter';
import type { AppSettingsRecord, AppSettingsInput } from '../types';

class InMemoryStore implements SettingsStoreBackend {
  constructor(private value: AppSettingsRecord | null = null) {}

  async read(): Promise<AppSettingsRecord | null> {
    return this.value ? { ...this.value } : null;
  }

  async write(record: AppSettingsRecord): Promise<void> {
    this.value = { ...record };
  }
}

class InMemorySecureStore implements SecretStore {
  private store = new Map<string, string>();

  async getSecret(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setSecret(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
}

class StubConnectivityTester implements ConnectivityTester {
  public calls: Array<{ endpointUrl: string; modelName: string; apiKey?: string; timeoutMs?: number }> = [];
  public failWith?: Error;

  async test(payload: { endpointUrl: string; modelName: string; apiKey?: string; timeoutMs?: number }): Promise<void> {
    if (this.failWith) {
      throw this.failWith;
    }
    this.calls.push(payload);
  }
}

function createService(options?: { initial?: AppSettingsRecord | null }) {
  const store = new InMemoryStore(options?.initial ?? null);
  const repo = new SettingsRepository(store as never);
  const secure = new InMemorySecureStore();
  const tester = new StubConnectivityTester();
  const service = new SettingsService(repo, secure, tester, {
    clock: () => 1_700_000_000_000,
    defaultSeedBuilder: async () => ({
      record: {
        endpointUrl: 'http://localhost:4000',
        modelName: 'gpt-mini',
        vaultKeyId: 'local',
        timeoutMs: 45_000,
        lastUpdatedAt: new Date(1_700_000_000_000).toISOString(),
      },
      apiKey: 'default-secret',
    }),
  });
  return { service, secure, tester };
}

const validInput: AppSettingsInput = {
  endpointUrl: 'https://api.example.com',
  modelName: 'gpt-4',
  vaultKeyId: 'team-secret',
  timeoutMs: 30_000,
  apiKey: 'live-secret',
};

test('getSettings seeds defaults and stores secret when repository is empty', async () => {
  const { service, secure } = createService();
  const first = await service.getSettings();
  const second = await service.getSettings();

  assert.equal(first.endpointUrl, 'http://localhost:4000');
  assert.equal(first, second);
  assert.equal(await secure.getSecret('local'), 'default-secret');
});

test('saveSettings validates required fields', async () => {
  const { service } = createService();
  const result = await service.saveSettings({
    endpointUrl: 'not-a-url',
    modelName: '',
    vaultKeyId: '',
  });

  assert.equal(result.ok, false);
  assert.ok(result.validationErrors?.endpointUrl);
  assert.ok(result.validationErrors?.modelName);
  assert.ok(result.validationErrors?.vaultKeyId);
});

test('saveSettings persists record, stores secret, and notifies connectivity tester', async () => {
  const { service, secure, tester } = createService();
  const result = await service.saveSettings(validInput);

  assert.equal(result.ok, true);
  assert.equal(result.settings.endpointUrl, 'https://api.example.com');
  assert.equal((await service.getSettings()).modelName, 'gpt-4');
  assert.equal(await secure.getSecret('team-secret'), 'live-secret');
  assert.deepEqual(tester.calls[0], {
    endpointUrl: 'https://api.example.com',
    modelName: 'gpt-4',
    apiKey: 'live-secret',
    timeoutMs: 30_000,
  });
});

test('connectivity failure is surfaced without saving', async () => {
  const { service, tester } = createService();
  tester.failWith = new Error('network down');

  const result = await service.saveSettings(validInput);

  assert.equal(result.ok, false);
  assert.equal(result.connectivityError, 'network down');
});

test('getResolvedSettings includes stored secret', async () => {
  const { service, secure } = createService({
    initial: {
      endpointUrl: 'https://api.initial',
      modelName: 'masker',
      vaultKeyId: 'cached',
      timeoutMs: 60_000,
      lastUpdatedAt: new Date(1_700_000_000_000).toISOString(),
    },
  });

  await secure.setSecret('cached', 'cached-secret');

  const resolved = await service.getResolvedSettings();
  assert.equal(resolved.endpointUrl, 'https://api.initial');
  assert.equal(resolved.apiKey, 'cached-secret');
});
