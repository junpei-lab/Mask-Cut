import type { ContextBridge, IpcRenderer } from 'electron';

import { buildClipboardAPI } from './apis/clipboard';
import { buildMaskingAPI } from './apis/masking';
import { buildSettingsAPI } from './apis/settings';

export type RegisterDeps = {
  contextBridge: Pick<ContextBridge, 'exposeInMainWorld'>;
  ipcRenderer: Pick<IpcRenderer, 'invoke' | 'on' | 'removeListener'>;
};

export function registerPreloadApis(deps: RegisterDeps): void {
  const maskingAPI = buildMaskingAPI(deps.ipcRenderer);
  const settingsAPI = buildSettingsAPI(deps.ipcRenderer);
  const clipboardAPI = buildClipboardAPI(deps.ipcRenderer);

  deps.contextBridge.exposeInMainWorld('maskingAPI', maskingAPI);
  deps.contextBridge.exposeInMainWorld('settingsAPI', settingsAPI);
  deps.contextBridge.exposeInMainWorld('clipboardAPI', clipboardAPI);
}
