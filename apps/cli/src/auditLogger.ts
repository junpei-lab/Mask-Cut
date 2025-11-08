import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { ExecutionTelemetry } from './types.js';

export class AuditLogger {
  // eslint-disable-next-line class-methods-use-this
  async record(entry: ExecutionTelemetry, filePath?: string): Promise<void> {
    if (!filePath) {
      return;
    }

    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, 'utf-8');
  }
}
