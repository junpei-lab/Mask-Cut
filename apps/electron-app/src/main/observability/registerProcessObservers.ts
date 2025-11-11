import process from 'node:process';
import { app } from 'electron';

let observersRegistered = false;

export function registerProcessObservers(): void {
  if (observersRegistered) {
    return;
  }

  process.on('uncaughtException', (error) => {
    console.error('[main] uncaught exception', error);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[main] unhandled rejection', reason);
  });

  app.on('render-process-gone', (_event, webContents, details) => {
    console.error('[main] renderer process gone', {
      url: webContents.getURL(),
      reason: details.reason,
      exitCode: details.exitCode,
    });
  });

  observersRegistered = true;
}
