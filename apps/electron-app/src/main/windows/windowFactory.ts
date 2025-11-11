import type { BrowserWindowConstructorOptions } from 'electron';
import path from 'node:path';

export type WindowKind = 'main' | 'settings';

const COMMON_DIMENSIONS: Record<WindowKind, { width: number; height: number }> = {
  main: { width: 1024, height: 768 },
  settings: { width: 480, height: 640 },
};

export function buildWindowOptions(
  kind: WindowKind,
  preloadPath: string,
): BrowserWindowConstructorOptions {
  const basePreferences: BrowserWindowConstructorOptions['webPreferences'] = {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: false, // preload uses Node require; re-enable once bundled
    nodeIntegration: false,
  };

  if (kind === 'main') {
    return {
      title: 'Mask-Cut',
      width: COMMON_DIMENSIONS.main.width,
      height: COMMON_DIMENSIONS.main.height,
      minWidth: 768,
      minHeight: 600,
      show: true,
      webPreferences: basePreferences,
    };
  }

  return {
    title: 'Mask-Cut Settings',
    width: COMMON_DIMENSIONS.settings.width,
    height: COMMON_DIMENSIONS.settings.height,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    webPreferences: basePreferences,
  };
}

export function resolveRendererEntry(kind: WindowKind, distMainDir: string): string {
  const rendererDir = path.resolve(distMainDir, '../renderer');
  const fileName = kind === 'settings' ? 'settings.html' : 'index.html';
  return path.join(rendererDir, fileName);
}

export function resolvePreloadEntry(distMainDir: string): string {
  return path.resolve(distMainDir, '../preload/index.js');
}
