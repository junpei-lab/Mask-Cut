import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import assert from 'node:assert/strict';

import { ConfigService } from './configService.js';
import { InMemoryVault } from './credentialVault.js';
import { ConfigStore } from './configStore.js';

process.on('uncaughtException', (err) => {
  console.error('uncaught in configService.test', err);
});

function createTempPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mask-cut-config-'));
  return join(dir, 'config.json');
}

function cleanupTempPath(configPath: string): void {
  const dir = configPath.replace(/\/[^/]+$/, '');
  rmSync(dir, { recursive: true, force: true });
}

test('ConfigService initializes default config and returns default profile', async () => {
  const configPath = createTempPath();
  try {
    const store = new ConfigStore(configPath);
    const service = new ConfigService(store, new InMemoryVault());

    await service.initialize();
    const profile = await service.getProfile('default');

    assert.equal(profile.name, 'default');
    assert.equal(profile.endpoint, '');
    assert.equal(profile.model, 'llama3');
  } finally {
    cleanupTempPath(configPath);
  }
});

test('ConfigService upserts profile and persists changes', async () => {
  const configPath = createTempPath();
  try {
    const store = new ConfigStore(configPath);
    const service = new ConfigService(store, new InMemoryVault());

    await service.initialize();

    await service.upsertProfile('prod', {
      endpoint: 'https://api.example.com',
      model: 'gpt-4o',
      logFile: '/tmp/mask.log',
      apiKey: 'new-secret',
    });

    const profile = await service.getProfile('prod');
    assert.equal(profile.endpoint, 'https://api.example.com');
    assert.equal(profile.model, 'gpt-4o');
    assert.equal(profile.logFile, '/tmp/mask.log');
    assert.equal(profile.apiKey, 'new-secret');

    const summaries = await service.listProfiles();
    assert.ok(summaries.some((item) => item.name === 'prod'));
  } finally {
    cleanupTempPath(configPath);
  }
});

test('ConfigService allows switching default profile and errors on missing profile', async () => {
  const configPath = createTempPath();
  try {
    const store = new ConfigStore(configPath);
    const service = new ConfigService(store, new InMemoryVault());

    await service.initialize();
    await service.upsertProfile('staging', {
      endpoint: 'https://staging.example.com',
      model: 'gpt-4o-mini',
    });

    await service.setDefaultProfile('staging');
    const profile = await service.getProfile();
    assert.equal(profile.name, 'staging');

    await assert.rejects(
      service.getProfile('missing'),
      /profile 'missing' does not exist/,
    );
  } finally {
    cleanupTempPath(configPath);
  }
});

test('ConfigService listProfiles reports which profile is default', async () => {
  const configPath = createTempPath();
  try {
    const store = new ConfigStore(configPath);
    const service = new ConfigService(store, new InMemoryVault());

    await service.initialize();
    await service.upsertProfile('prod', {
      endpoint: 'https://api.example.com',
      model: 'gpt-4o',
    });

    await service.setDefaultProfile('prod');

    const profiles = await service.listProfiles();

    const defaultProfile = profiles.find((item) => item.name === 'prod');
    const legacyProfile = profiles.find((item) => item.name === 'default');

    assert.equal(defaultProfile?.isDefault, true);
    assert.equal(legacyProfile?.isDefault, false);
  } finally {
    cleanupTempPath(configPath);
  }
});
