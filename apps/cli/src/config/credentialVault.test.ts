import test from 'node:test';

import assert from 'node:assert/strict';

import { InMemoryVault } from './credentialVault.js';

test('InMemoryVault stores and retrieves secrets', async () => {
  const vault = new InMemoryVault();

  await vault.store('profile:prod', 'secret-key');
  const value = await vault.get('profile:prod');

  assert.equal(value, 'secret-key');
});

test('InMemoryVault deletes secrets and returns undefined', async () => {
  const vault = new InMemoryVault();

  await vault.store('profile:temp', 'value');
  await vault.delete('profile:temp');

  const value = await vault.get('profile:temp');
  assert.equal(value, undefined);
});
