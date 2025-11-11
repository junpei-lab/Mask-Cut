import test from 'node:test';
import assert from 'node:assert/strict';

import { buildClipboardAPI } from '../clipboard';

function createMockIpc() {
  const calls: Array<{ channel: string; payload?: unknown }> = [];
  return {
    invoke: async (channel: string, payload?: unknown) => {
      calls.push({ channel, payload });
    },
    getInvokeCalls: () => calls,
  };
}

test('copy validates input text and invokes clipboard channel', async () => {
  const ipc = createMockIpc();
  const api = buildClipboardAPI(ipc as never);

  await assert.rejects(api.copy(''), /text is required/);
  assert.equal(ipc.getInvokeCalls().length, 0);

  await api.copy('masked text');
  assert.deepEqual(ipc.getInvokeCalls(), [
    { channel: 'clipboard:copy', payload: { text: 'masked text' } },
  ]);
});
