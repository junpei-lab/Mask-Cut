import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CliApplication,
  CliCommandContext,
  CommandHandler,
  ProcessIO,
} from './types.js';

import { CliNetworkError, CliTimeoutError, CliUsageError } from './errors.js';
import { createCliApplication } from './cliApplication.js';
import { CommandRouter } from './commandRouter.js';
import { createMaskCommandDescriptor } from './commands/maskCommand.js';
import type { ConfigService } from './config/configService.js';

function createTestIO() {
  const stdout: string[] = [];
  const stderr: string[] = [];
  let exitCode = 0;

  const io: ProcessIO = {
    writeStdout: (message: string) => {
      stdout.push(message);
    },
    writeStderr: (message: string) => {
      stderr.push(message);
    },
    setExitCode: (code: number) => {
      exitCode = code;
    },
  };

  return {
    io,
    stdout,
    stderr,
    getExitCode: () => exitCode,
  };
}

function setupApplication(commands: Array<{
  name: string;
  description: string;
  usage: string;
  handler: CommandHandler;
}>) {
  const router = new CommandRouter();

  for (const command of commands) {
    router.register({
      name: command.name,
      summary: command.description,
      usage: command.usage,
      handler: command.handler,
    });
  }

  const app = createCliApplication({
    name: 'mask-cut',
    description: 'Mask-Cut CLI',
    router,
  });

  return app;
}

test('formats command output and passes parsed globals to handler', async () => {
  let receivedContext: CliCommandContext | undefined;

  const commandHandler: CommandHandler = async (context) => {
    receivedContext = context;
    return {
      exitCode: 0,
      output: { kind: 'text', text: 'result\n' },
      telemetry: { inputBytes: 10 },
    };
  };

  const app = setupApplication([
    {
      name: 'mask',
      description: 'Mask text',
      usage: 'mask [options]',
      handler: commandHandler,
    },
  ]);

  const { io, stdout, stderr } = createTestIO();

  const exitCode = await app.run(
    [
      '/usr/bin/node',
      '/path/mask-cut',
      '--log-file',
      'run.log',
      'mask',
    ],
    io,
  );

  assert.equal(exitCode, 0);
  assert.deepEqual(stderr, []);
  assert.ok(stdout.join('').includes('result'));
  assert.ok(receivedContext);
  assert.equal(receivedContext?.globals.logFile, 'run.log');
});

test('quiet flag suppresses informational output', async () => {
  const commandHandler: CommandHandler = async () => ({
    exitCode: 0,
    output: { kind: 'text', text: 'info\n', scope: 'info' },
  });

  const app = setupApplication([
    { name: 'mask', description: 'Mask text', usage: 'mask', handler: commandHandler },
  ]);

  const { io, stdout } = createTestIO();

  await app.run([
    '/usr/bin/node',
    '/path/mask-cut',
    '--quiet',
    'mask',
  ], io);

  assert.equal(stdout.length, 0);
});

test('maps thrown usage errors to CLI output', async () => {
  const commandHandler: CommandHandler = async () => {
    throw new CliUsageError('invalid combination');
  };

  const app = setupApplication([
    { name: 'mask', description: 'Mask text', usage: 'mask', handler: commandHandler },
  ]);

  const { io, stderr } = createTestIO();

  const exitCode = await app.run([
    '/usr/bin/node',
    '/path/mask-cut',
    'mask',
  ], io);

  assert.equal(exitCode, 2);
  assert.ok(stderr.join('').includes('invalid combination'));
});

test('maps network and timeout errors with dedicated codes', async () => {
  const router = new CommandRouter();
  router.register({
    name: 'mask',
    summary: 'Mask text',
    usage: 'mask',
    handler: async () => {
      throw new CliNetworkError('offline');
    },
  });

  const app = createCliApplication({
    name: 'mask-cut',
    description: 'Mask',
    router,
  });

  const { io, stderr } = createTestIO();
  let exitCode = await app.run([
    '/usr/bin/node',
    '/path/mask-cut',
    'mask',
  ], io);

  assert.equal(exitCode, 1);
  assert.ok(stderr.join('').includes('E_NETWORK'));

  router.register({
    name: 'again',
    summary: 'Mask text',
    usage: 'mask',
    handler: async () => {
      throw new CliTimeoutError('timeout');
    },
  });

  const { io: io2, stderr: stderr2 } = createTestIO();
  exitCode = await app.run([
    '/usr/bin/node',
    '/path/mask-cut',
    'again',
  ], io2);

  assert.equal(exitCode, 1);
  assert.ok(stderr2.join('').includes('E_TIMEOUT'));
});

test('runs mask command end-to-end and emits telemetry log', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mask-cut-cli-'));
  const logPath = join(dir, 'run.log');

  try {
    const inputBytes = Buffer.byteLength('原文', 'utf-8');
    let executed = 0;

    const router = new CommandRouter();
    router.register(
      createMaskCommandDescriptor({
        inputResolver: {
          async resolve() {
            return {
              text: '原文',
              metadata: {
                source: 'inline' as const,
                bytes: inputBytes,
              },
            };
          },
        } as any,
        configService: {
          async getProfile() {
            return {
              name: 'default',
              endpoint: 'http://localhost:11434/v1',
              model: 'llama3',
            };
          },
        } as ConfigService,
        llmFactory: () => ({}),
        maskingExecutor: async () => {
          executed += 1;
          return { maskedText: '■■■' };
        },
      }),
    );

    const app = createCliApplication({
      name: 'mask-cut',
      description: 'Mask-Cut CLI',
      router,
    });

    const { io, stdout, stderr, getExitCode } = createTestIO();
    const exitCode = await app.run(
      [
        '/usr/bin/node',
        '/path/mask-cut',
        '--log-file',
        logPath,
        'mask',
        '--text',
        '原文',
        '--format',
        'json',
      ],
      io,
    );

    assert.equal(exitCode, 0);
    assert.equal(getExitCode(), 0);
    assert.equal(stderr.length, 0);
    assert.equal(executed, 1);

    const payload = JSON.parse(stdout.join(''));
    assert.equal(payload.maskedText, '■■■');
    assert.equal(payload.metrics.inputBytes, inputBytes);

    const logEntry = JSON.parse(readFileSync(logPath, 'utf-8').trim());
    assert.equal(logEntry.command, 'mask');
    assert.equal(logEntry.status, 'success');
    assert.equal(logEntry.inputBytes, inputBytes);
    assert.equal(logEntry.maskedBytes, Buffer.byteLength('■■■', 'utf-8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('respects global dry-run flag during mask execution', async () => {
  let executed = 0;

  const router = new CommandRouter();
  router.register(
    createMaskCommandDescriptor({
      inputResolver: {
        async resolve() {
          return {
            text: 'dryrun',
            metadata: {
              source: 'inline' as const,
              bytes: 6,
            },
          };
        },
      } as any,
      configService: {
        async getProfile() {
          return {
            name: 'default',
            endpoint: 'http://localhost:11434/v1',
            model: 'llama3',
          };
        },
      } as ConfigService,
      llmFactory: () => ({}),
      maskingExecutor: async () => {
        executed += 1;
        return { maskedText: 'unused' };
      },
    }),
  );

  const app = createCliApplication({
    name: 'mask-cut',
    description: 'Mask-Cut CLI',
    router,
  });

  const { io, stdout, stderr, getExitCode } = createTestIO();
  const exitCode = await app.run(
    [
      '/usr/bin/node',
      '/path/mask-cut',
      '--dry-run',
      'mask',
      '--text',
      'dryrun',
    ],
    io,
  );

  assert.equal(exitCode, 0);
  assert.equal(getExitCode(), 0);
  assert.equal(stderr.length, 0);
  assert.equal(executed, 0);
  assert.ok(stdout.join('').includes('[dry-run]'));
});

test('writes telemetry to log file when requested', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mask-cut-cli-'));
  const logPath = join(dir, 'run.log');

  const commandHandler: CommandHandler = async () => ({
    exitCode: 0,
    telemetry: { profile: 'default', inputBytes: 12 },
  });

  const app = setupApplication([
    { name: 'mask', description: 'Mask text', usage: 'mask', handler: commandHandler },
  ]);

  const { io } = createTestIO();

  await app.run([
    '/usr/bin/node',
    '/path/mask-cut',
    '--log-file',
    logPath,
    'mask',
  ], io);

  const content = readFileSync(logPath, 'utf-8').trim();
  assert.ok(content.includes('"command"'));
  assert.ok(content.includes('"profile":"default"'));

  rmSync(dir, { recursive: true, force: true });
});

test('prints help when no command provided', async () => {
  const app = setupApplication([
    {
      name: 'mask',
      description: 'Mask text',
      usage: 'mask [options]',
      handler: async () => ({ exitCode: 0 }),
    },
    {
      name: 'config',
      description: 'Configure connection',
      usage: 'config <sub-command>',
      handler: async () => ({ exitCode: 0 }),
    },
  ]);

  const { io, stdout, stderr, getExitCode } = createTestIO();

  const exitCode = await app.run(
    ['/usr/bin/node', '/path/mask-cut', '--help'],
    io,
  );

  assert.equal(exitCode, 0);
  assert.equal(getExitCode(), 0);
  assert.deepEqual(stderr, []);
  const output = stdout.join('\n');
  assert.ok(output.includes('Usage: mask-cut <command> [options]'));
  assert.ok(output.includes('mask - Mask text'));
  assert.ok(output.includes('config - Configure connection'));
});

test('reports unknown command usage error', async () => {
  const app = setupApplication([]);
  const { io, stdout, stderr, getExitCode } = createTestIO();

  const exitCode = await app.run(
    ['/usr/bin/node', '/path/mask-cut', 'unknown'],
    io,
  );

  assert.equal(exitCode, 1);
  assert.equal(getExitCode(), 1);
  assert.deepEqual(stdout, []);
  const errorOutput = stderr.join('\n');
  assert.ok(errorOutput.includes("Unknown command 'unknown'"));
  assert.ok(errorOutput.includes('Use --help to list available commands'));
});
