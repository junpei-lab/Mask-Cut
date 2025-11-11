import test from 'node:test';
import assert from 'node:assert/strict';

import { registerPreloadApis } from '../registerApis';

test('registerPreloadApis exposes APIs to renderer globals', () => {
  const exposed: Record<string, unknown> = {};

  const contextBridge = {
    exposeInMainWorld: (key: string, value: unknown) => {
      exposed[key] = value;
    },
  } as const;

  const ipc: any = {
    invoke: async () => {},
    on: () => {},
    removeListener: () => {},
  };

  registerPreloadApis({ contextBridge, ipcRenderer: ipc });

  assert.ok('maskingAPI' in exposed);
  assert.ok('settingsAPI' in exposed);
  assert.ok('clipboardAPI' in exposed);
});
