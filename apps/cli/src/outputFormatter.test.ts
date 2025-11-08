import assert from 'node:assert/strict';
import test from 'node:test';

import { OutputFormatter } from './outputFormatter.js';
import type { CommandOutput, ProcessIO } from './types.js';

function createIO() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  const io: ProcessIO = {
    writeStdout: (message: string) => stdout.push(message),
    writeStderr: (message: string) => stderr.push(message),
    setExitCode: () => {},
  };

  return { io, stdout, stderr };
}

function emit(output: CommandOutput, options = { quiet: false, dryRun: false }) {
  const { io, stdout, stderr } = createIO();
  const formatter = new OutputFormatter(io, options);
  formatter.emit(output);
  return { stdout, stderr };
}

test('suppresses informational text when quiet mode is enabled', () => {
  const { stdout } = emit(
    { kind: 'text', text: 'info message', scope: 'info' },
    { quiet: true, dryRun: false },
  );
  assert.equal(stdout.length, 0);
});

test('prints JSON payload with newline', () => {
  const { stdout } = emit({ kind: 'json', data: { maskedText: 'abc' } });
  assert.ok(stdout[0].includes('"maskedText"'));
  assert.ok(stdout[0].trim().startsWith('{'));
});

test('prints structured error output with suggestions', () => {
  const { stderr } = emit({
    kind: 'error',
    code: 'E_TIMEOUT',
    message: 'Timed out',
    suggestions: ['Retry later'],
  });
  assert.ok(stderr[0].includes('E_TIMEOUT'));
  assert.ok(stderr[1].includes('Retry later'));
});
