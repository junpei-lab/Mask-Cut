import { BrowserWindow, clipboard, ipcMain } from 'electron';

import { createMaskingChannelHandlers } from './maskingChannels';
import { MaskingCache } from '../masking/maskingCache';
import { MaskingService } from '../masking/maskingService';
import type { MaskingStatusEvent } from '../masking/types';
import { FetchConnectivityTester } from '../settings/connectivityTester';
import { SecureStoreAdapter } from '../settings/secureStoreAdapter';
import { SettingsRepository } from '../settings/settingsStore';
import { SettingsService } from '../settings/settingsService';
import type { AppSettingsInput } from '../settings/types';
import type { WindowManager } from '../windows/windowManager';

const notImplemented = (channel: string) => async () => {
  const error = new Error(`${channel} not implemented yet`);
  error.name = 'NotImplementedError';
  throw error;
};

let registered = false;

export function registerIpcChannels(deps: { windowManager: WindowManager }): void {
  if (registered) {
    return;
  }

  const settingsService = new SettingsService(
    new SettingsRepository(),
    new SecureStoreAdapter(),
    new FetchConnectivityTester(),
  );

  const maskingService = new MaskingService({
    cache: new MaskingCache(),
    settingsProvider: {
      getResolvedSettings: () => settingsService.getResolvedSettings(),
    },
  });

  const publishStatus = (event: MaskingStatusEvent) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (window.isDestroyed()) {
        return;
      }
      window.webContents.send('masking:status', event);
    });
  };

  const maskingHandlers = createMaskingChannelHandlers({
    maskingService,
    publishStatus,
  });

  ipcMain.handle('masking:run', (event, payload) => maskingHandlers.run(event, payload));

  const broadcastSettingsUpdate = (settings: unknown) => {
    BrowserWindow.getAllWindows().forEach((window) => {
      if (window.isDestroyed()) {
        return;
      }
      window.webContents.send('settings:update', settings);
    });
  };

  settingsService.onChange((settings) => {
    broadcastSettingsUpdate(settings);
  });

  ipcMain.handle('settings:open', () => {
    const window = deps.windowManager.getOrCreateSettingsWindow();
    if (window.isDestroyed()) {
      throw new Error('Settings window is not available');
    }

    if (!window.isVisible()) {
      window.once('ready-to-show', () => {
        if (window.isDestroyed()) {
          return;
        }
        window.show();
        window.focus();
      });
      window.show();
      return true;
    }

    if (window.isMinimized()) {
      window.restore();
    }
    window.focus();
    return true;
  });

  ipcMain.handle('settings:get', async () => settingsService.getSettings());
  ipcMain.handle('settings:save', async (_event, payload: AppSettingsInput) => {
    const result = await settingsService.saveSettings(payload);
    if (result.ok) {
      broadcastSettingsUpdate(result.settings);
    }
    return result;
  });

  ipcMain.handle('clipboard:copy', (_event, payload: { text?: string }) => {
    const text = (payload?.text ?? '').trim();
    if (!text) {
      throw new Error('text is required');
    }
    clipboard.writeText(text);
    return true;
  });

  registered = true;
}
