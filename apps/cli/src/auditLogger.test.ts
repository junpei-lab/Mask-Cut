import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { rm } from 'node:fs/promises';
import test from 'node:test';

import assert from 'node:assert/strict';

import { AuditLogger } from './auditLogger.js';
import type { ExecutionTelemetry } from './types.js';

function createTempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mask-cut-audit-'));
  return join(dir, 'audit.log');
}

test('AuditLogger appends telemetry entry to JSONL file', async () => {
  const filePath = createTempFile();
  const logger = new AuditLogger();
  const entry: ExecutionTelemetry = {
    command: 'mask',
    profile: 'default',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    status: 'success',
    inputBytes: 10,
    maskedBytes: 8,
  };

  await logger.record(entry, filePath);

  const content = readFileSync(filePath, 'utf-8').trim();
  assert.equal(content, JSON.stringify(entry));

  await rm(dirname(filePath), { recursive: true, force: true });
});
