import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSettingsAPI } from '../settings';

type Listener = (...args: unknown[]) => void;

function createMockIpc() {
  const invokeCalls: Array<{ channel: string; payload?: unknown }> = [];
  const listeners: Record<string, Listener[]> = {};

  return {
    invoke: async (channel: string, payload?: unknown) => {
      invokeCalls.push({ channel, payload });
      return { channel, payload };
    },
    on: (channel: string, listener: Listener) => {
      listeners[channel] ??= [];
      listeners[channel].push(listener);
    },
    removeListener: (channel: string, listener: Listener) => {
      const arr = listeners[channel];
      if (!arr) return;
      listeners[channel] = arr.filter((l) => l !== listener);
    },
    emit: (channel: string, ...args: unknown[]) => {
      listeners[channel]?.forEach((listener) => listener({}, ...args));
    },
    getInvokeCalls: () => invokeCalls,
  };
}

test('get delegates to settings:get', async () => {
  const ipc = createMockIpc();
  const api = buildSettingsAPI(ipc as never);
  await api.get();

  assert.equal(ipc.getInvokeCalls()[0].channel, 'settings:get');
});

test('save validates required fields before invoking', async () => {
  const ipc = createMockIpc();
  const api = buildSettingsAPI(ipc as never);

  await assert.rejects(
    api.save({ endpointUrl: '', modelName: '', vaultKeyId: '' }),
    /endpointUrl is required/,
  );
  assert.equal(ipc.getInvokeCalls().length, 0);

  await api.save({
    endpointUrl: 'https://example.com',
    modelName: 'gpt',
    vaultKeyId: 'default',
  });

  assert.equal(ipc.getInvokeCalls()[0].channel, 'settings:save');
});

test('onUpdate wires listener and returns unsubscribe', () => {
  const ipc = createMockIpc();
  const api = buildSettingsAPI(ipc as never);
  let payload: unknown;

  const unsubscribe = api.onUpdate((_event, data) => {
    payload = data;
  });

  ipc.emit('settings:update', { foo: 'bar' });
  assert.deepEqual(payload, { foo: 'bar' });

  unsubscribe();
  ipc.emit('settings:update', { ignored: true });
  assert.deepEqual(payload, { foo: 'bar' });
});

test('openWindow invokes settings:open channel', async () => {
  const ipc = createMockIpc();
  const api = buildSettingsAPI(ipc as never);

  await api.openWindow();

  assert.equal(ipc.getInvokeCalls()[0].channel, 'settings:open');
});
