import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';

import assert from 'node:assert/strict';

import { InputResolver, TextSource } from './inputResolver.js';

function createTempFile(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mask-cut-cli-'));
  const file = join(dir, 'input.txt');
  writeFileSync(file, content, 'utf-8');
  return file;
}

function cleanupTempFile(filePath: string): void {
  const dir = filePath.replace(/\/[^/]+$/, '');
  rmSync(dir, { recursive: true, force: true });
}

test('InputResolver resolves inline text source', async () => {
  const resolver = new InputResolver();
  const source: TextSource = { kind: 'inline', value: 'Hello' };

  const result = await resolver.resolve(source);

  assert.equal(result.text, 'Hello');
  assert.equal(result.metadata.source, 'inline');
});

test('InputResolver resolves file source', async () => {
  const filePath = createTempFile('File Content');
  const resolver = new InputResolver();
  const source: TextSource = { kind: 'file', path: filePath };

  try {
    const result = await resolver.resolve(source);
    assert.equal(result.text, 'File Content');
    assert.equal(result.metadata.source, 'file');
    assert.equal(result.metadata.filePath, filePath);
  } finally {
    cleanupTempFile(filePath);
  }
});

test('InputResolver reads from stdin stream', async () => {
  const resolver = new InputResolver({
    stdinFactory: () =>
      Readable.from(['stream ', 'chunk']),
  });

  const source: TextSource = { kind: 'stdin' };

  const result = await resolver.resolve(source);

  assert.equal(result.text, 'stream chunk');
  assert.equal(result.metadata.source, 'stdin');
});

test('InputResolver throws when stdin not available', async () => {
  const resolver = new InputResolver({
    stdinFactory: () => {
      const s = new Readable();
      s.push(null);
      return s;
    },
  });

  const source: TextSource = { kind: 'stdin' };

  await assert.rejects(
    resolver.resolve(source),
    /stdin provided no data/,
  );
});
