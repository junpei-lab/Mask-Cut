import fs from 'node:fs';
import path from 'node:path';

import { app, nativeImage } from 'electron';
import type { NativeImage } from 'electron';

const FALLBACK_ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="leaf" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6fb64a" />
      <stop offset="100%" stop-color="#3d7a2c" />
    </linearGradient>
    <linearGradient id="grape" x1="25%" y1="25%" x2="75%" y2="75%">
      <stop offset="0%" stop-color="#e3ffd2" />
      <stop offset="100%" stop-color="#9ccf38" />
    </linearGradient>
  </defs>
  <g fill="none" stroke="none" stroke-width="1">
    <path d="M140 42c22-6 34-22 34-22-6 18-4 34 8 46-20-6-36 2-48 14z" fill="url(#leaf)" />
    <path d="M122 32c6 10 6 20 0 32" stroke="#6b4c21" stroke-width="8" stroke-linecap="round" />
    <g fill="url(#grape)" stroke="#7da21f" stroke-width="4">
      <circle cx="128" cy="108" r="34" />
      <circle cx="94" cy="132" r="32" />
      <circle cx="162" cy="132" r="32" />
      <circle cx="106" cy="170" r="32" />
      <circle cx="150" cy="170" r="32" />
      <circle cx="86" cy="200" r="28" />
      <circle cx="170" cy="200" r="28" />
    </g>
    <g fill="#ffffff" fill-opacity="0.2">
      <circle cx="112" cy="96" r="10" />
      <circle cx="148" cy="160" r="8" />
    </g>
  </g>
</svg>`;

const ICON_RELATIVE_PATH = path.join('assets', 'icon.png');

let cachedIcon: NativeImage | null = null;

function resolveIconPath(): string | undefined {
  const candidates: string[] = [];

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, ICON_RELATIVE_PATH));
  }

  candidates.push(path.resolve(__dirname, '..', '..', 'assets', 'icon.png'));
  candidates.push(path.resolve(__dirname, '..', '..', '..', '..', '..', 'assets', 'icon.png'));

  try {
    const appPath = app.getAppPath();
    candidates.push(path.resolve(appPath, '..', '..', 'assets', 'icon.png'));
  } catch {
    // ignore if app path is not available yet
  }

  candidates.push(path.resolve(process.cwd(), 'assets', 'icon.png'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export function getMuscatIcon(): NativeImage {
  if (cachedIcon) {
    return cachedIcon;
  }

  const filePath = resolveIconPath();
  if (filePath) {
    cachedIcon = nativeImage.createFromPath(filePath);
    if (!cachedIcon.isEmpty()) {
      return cachedIcon;
    }
    cachedIcon = null;
  }

  const buffer = Buffer.from(FALLBACK_ICON_SVG, 'utf-8');
  cachedIcon = nativeImage.createFromBuffer(buffer, { width: 256, height: 256 });
  return cachedIcon;
}
