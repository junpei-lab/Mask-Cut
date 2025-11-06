import { app, BrowserWindow } from 'electron';
import * as path from 'node:path';

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // Demo purpose: allow renderer to require workspace packages directly.
    },
  });

  const indexHtml = path.join(__dirname, '../renderer/index.html');
  void window.loadFile(indexHtml);

  if (!app.isPackaged) {
    window.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
