import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMaskingAPI } from '../masking';

type InvokeCall = { channel: string; payload?: unknown };

type Listener = (...args: unknown[]) => void;

function createMockIpc() {
  const invokeCalls: InvokeCall[] = [];
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

test('run rejects empty text payload', async () => {
  const ipc = createMockIpc();
  const api = buildMaskingAPI(ipc as never);

  await assert.rejects(
    api.run({ text: '   ' }),
    /text is required/,
  );
  assert.equal(ipc.getInvokeCalls().length, 0);
});

test('run forwards sanitized payload to masking channel', async () => {
  const ipc = createMockIpc();
  const api = buildMaskingAPI(ipc as never);
  await api.run({ text: 'hello', options: { model: 'x' } });

  assert.deepEqual(ipc.getInvokeCalls(), [
    {
      channel: 'masking:run',
      payload: { text: 'hello', options: { model: 'x' } },
    },
  ]);
});

test('onStatus wires renderer listeners and allows unsubscribe', () => {
  const ipc = createMockIpc();
  const api = buildMaskingAPI(ipc as never);
  let received: unknown[] = [];

  const unsubscribe = api.onStatus((event, payload) => {
    received = [event, payload];
  });

  ipc.emit('masking:status', { foo: 'bar' });
  assert.equal(received.length, 2);

  unsubscribe();
  ipc.emit('masking:status', { another: 'event' });
  assert.deepEqual(received[1], { foo: 'bar' });
});
