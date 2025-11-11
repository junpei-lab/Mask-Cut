import { contextBridge, ipcRenderer } from 'electron';

import { registerPreloadApis } from './registerApis';

registerPreloadApis({ contextBridge, ipcRenderer });
