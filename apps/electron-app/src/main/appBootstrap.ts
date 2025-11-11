import { app } from 'electron';

import { registerIpcChannels } from './ipc/registerIpcChannels';
import { registerProcessObservers } from './observability/registerProcessObservers';
import { WindowManager } from './windows/windowManager';

export function bootstrapApplication(): void {
  const windowManager = new WindowManager();

  registerProcessObservers();

  app.whenReady().then(() => {
    windowManager.ensureMainWindow();
    registerIpcChannels({ windowManager });
  });

  app.on('activate', () => {
    windowManager.ensureMainWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
