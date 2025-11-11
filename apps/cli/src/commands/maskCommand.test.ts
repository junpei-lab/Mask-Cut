import assert from 'node:assert/strict';
import test from 'node:test';

type LLMClient = Record<string, never>;

interface MaskingOptions {
  style?: 'block' | 'asterisk' | 'maskTag';
  keepLength?: boolean;
  language?: 'ja' | 'en' | 'auto';
  maskUnknownEntities?: boolean;
}

interface MaskingResult {
  maskedText: string;
  originalText?: string;
}

import { InputResolver } from '../inputResolver.js';
import type { ProcessIO } from '../types.js';
import type { ConfigService } from '../config/configService.js';

import { createMaskCommandHandler } from './maskCommand.js';

function createIO(): ProcessIO {
  return {
    writeStdout: () => {},
    writeStderr: () => {},
    setExitCode: () => {},
  };
}

function createHandler(overrides: {
  inputResolver?: InputResolver;
  maskingExecutor?: (
    client: LLMClient,
    text: string,
    options: MaskingOptions,
  ) => Promise<MaskingResult>;
  configService?: ConfigService;
  llmFactory?: (options: { baseUrl: string; apiKey?: string; model: string }) => any;
} = {}) {
  const inputResolver = overrides.inputResolver ?? new InputResolver();
  const maskingExecutor =
    overrides.maskingExecutor ??
    (async () => ({ maskedText: 'masked', originalText: '' }));
  const configService =
    overrides.configService ??
    ({
      getProfile: async () => ({
        name: 'default',
        endpoint: 'http://localhost:1234/v1',
        model: 'llama3',
      }),
    } as unknown as ConfigService);
  const llmFactory = overrides.llmFactory ?? (() => ({} as LLMClient));

  return createMaskCommandHandler({
    inputResolver,
    configService,
    llmFactory,
    maskingExecutor,
  });
}

function createContext(argv: string[], overrides: { dryRun?: boolean } = {}) {
  return {
    globals: {
      quiet: false,
      dryRun: overrides.dryRun ?? false,
      logFile: undefined,
    },
    argv,
    io: createIO(),
  };
}

test('mask command returns JSON output with metrics when format json', async () => {
  const resolved = {
    text: '原文',
    metadata: {
      source: 'inline' as const,
      bytes: 6,
    },
  };

  const resolver = {
    resolve: async () => resolved,
  } as unknown as InputResolver;

  const handler = createHandler({
    inputResolver: resolver,
    maskingExecutor: async () => ({ maskedText: '■■■' }),
  });

  const result = await handler(createContext(['--text', '原文', '--format', 'json']));

  assert.equal(result.exitCode, 0);
  assert.equal(result.output?.kind, 'json');
  const payload = result.output?.data as any;
  assert.equal(payload.maskedText, '■■■');
  assert.equal(payload.metrics.inputBytes, 6);
  assert.equal(result.telemetry?.inputBytes, 6);
  assert.equal(payload.profile, 'default');
});

test('mask command performs dry run without invoking masking executor', async () => {
  const resolved = {
    text: 'text',
    metadata: {
      source: 'inline' as const,
      bytes: 4,
    },
  };

  const resolver = {
    resolve: async () => resolved,
  } as unknown as InputResolver;

  let invoked = false;
  const handler = createHandler({
    inputResolver: resolver,
    maskingExecutor: async () => {
      invoked = true;
      return { maskedText: 'noop' };
    },
  });

  const result = await handler(
    createContext(['--text', 'text'], { dryRun: true }),
  );

  assert.equal(result.exitCode, 0);
  assert.equal(result.output?.kind, 'dry-run');
  assert.equal((result.output as any).details?.inputBytes, 4);
  assert.equal((result.output as any).details?.profile, 'default');
  assert.equal(invoked, false);
});

test('mask command returns help output without invoking masking flow', async () => {
  const handler = createHandler();
  const result = await handler(createContext(['--help']));

  assert.equal(result.exitCode, 0);
  assert.equal(result.output?.kind, 'text');
  assert.ok(result.output?.text.includes('Mask-Cut CLI - マスキングコマンド'));
  assert.equal(result.output?.scope, 'info');
});

test('mask command uses profile defaults and allows CLI override', async () => {
  const captured: { options?: { baseUrl: string; apiKey?: string; model: string } } = {};
  const handler = createHandler({
    configService: {
      async getProfile(name?: string) {
        assert.equal(name, undefined);
        return {
          name: 'prod',
          endpoint: 'https://api.example.com/v1',
          model: 'gpt-4o-mini',
          apiKey: 'secret',
          logFile: '/tmp/prod.log',
        };
      },
    } as ConfigService,
    llmFactory: (options) => {
      captured.options = options;
      return {} as LLMClient;
    },
  });

  const result = await handler(createContext(['--text', 'hello', '--model', 'override-model']));

  assert.equal(captured.options?.baseUrl, 'https://api.example.com/v1');
  assert.equal(captured.options?.model, 'override-model');
  assert.equal(captured.options?.apiKey, 'secret');
  assert.equal(result.logFile, '/tmp/prod.log');
});
