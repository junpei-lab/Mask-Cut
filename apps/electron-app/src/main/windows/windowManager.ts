import path from 'node:path';

import { app, BrowserWindow } from 'electron';

import {
  buildWindowOptions,
  resolvePreloadEntry,
  resolveRendererEntry,
  type WindowKind,
} from './windowFactory';
import { getMuscatIcon } from './appIcon';

export class WindowManager {
  private mainWindow: BrowserWindow | null = null;
  private settingsWindow: BrowserWindow | null = null;

  constructor(private readonly distMainDir: string = path.resolve(__dirname, '..')) {}

  ensureMainWindow(): BrowserWindow {
    if (this.mainWindow?.isDestroyed() === false) {
      return this.mainWindow;
    }

    this.mainWindow = this.createWindow('main');
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    if (!app.isPackaged) {
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  getOrCreateSettingsWindow(): BrowserWindow {
    if (this.settingsWindow?.isDestroyed() === false) {
      return this.settingsWindow;
    }

    this.settingsWindow = this.createWindow('settings');
    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  private createWindow(kind: WindowKind): BrowserWindow {
    const preloadPath = resolvePreloadEntry(this.distMainDir);
    const options = buildWindowOptions(kind, preloadPath);
    options.icon = options.icon ?? getMuscatIcon();

    if (kind === 'settings') {
      const parent = this.ensureMainWindow();
      options.parent = parent;
      options.modal = true;
    }

    const window = new BrowserWindow(options);
    const entry = resolveRendererEntry(kind, this.distMainDir);

    void window.loadFile(entry);
    return window;
  }
}
