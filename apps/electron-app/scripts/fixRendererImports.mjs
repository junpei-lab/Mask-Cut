#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rendererDir = path.resolve(__dirname, '../dist/renderer');

async function collectJsFiles(dir, acc = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectJsFiles(fullPath, acc);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

const needsExtension = (specifier) =>
  (specifier.startsWith('./') || specifier.startsWith('../')) &&
  !specifier.endsWith('.js') &&
  !specifier.endsWith('.json') &&
  !specifier.endsWith('/');

const appendExtension = (specifier) => {
  if (!needsExtension(specifier)) {
    return specifier;
  }
  return `${specifier}.js`;
};

const importPattern = /(import\s+[^'"]+\s+from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;
const exportPattern = /(export\s+[^'"]+\s+from\s+['"])(\.{1,2}\/[^'"]+)(['"])/g;
const dynamicPattern = /(import\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g;

async function transformFile(file) {
  const original = await fs.readFile(file, 'utf8');
  const replaced = original
    .replace(importPattern, (_, prefix, spec, suffix) => `${prefix}${appendExtension(spec)}${suffix}`)
    .replace(exportPattern, (_, prefix, spec, suffix) => `${prefix}${appendExtension(spec)}${suffix}`)
    .replace(dynamicPattern, (_, prefix, spec, suffix) => `${prefix}${appendExtension(spec)}${suffix}`);

  if (replaced !== original) {
    await fs.writeFile(file, replaced, 'utf8');
  }
}

async function main() {
  try {
    const stats = await fs.stat(rendererDir).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      return;
    }
    const files = await collectJsFiles(rendererDir);
    await Promise.all(files.map(transformFile));
  } catch (error) {
    console.error('Failed to patch renderer imports', error);
    process.exitCode = 1;
  }
}

await main();
